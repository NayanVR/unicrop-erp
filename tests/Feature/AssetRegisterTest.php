<?php

use App\Models\Company;
use App\Models\CompanyAsset;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** @param array<int, string> $permissions */
function assetUser(string $slug, array $permissions = []): User
{
    $company = Company::firstOrCreate(
        ['slug' => 'unicrop'],
        ['name' => 'Unicrop Biochem', 'is_active' => true],
    );
    $role = Role::firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug)]);

    $user = User::factory()->create(['permissions' => $permissions]);
    $user->roles()->sync([$role->id]);
    $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

    return $user;
}

function assetPayload(array $overrides = []): array
{
    return array_merge([
        'name'     => 'Dell Latitude 5420',
        'category' => 'Laptop / Computer',
        'quantity' => 3,
        'unit'     => 'pcs',
        'status'   => 'in_use',
    ], $overrides);
}

it('keeps the register shut to anyone who was not given access', function (string $role) {
    $this->actingAs(assetUser($role))
        ->get('/assets')
        ->assertForbidden();
})->with(['sales', 'factory', 'design', 'accountant']);

it('lets an admin in without being granted anything', function () {
    $this->actingAs(assetUser('admin'))
        ->get('/assets')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('erp/assets/index')->where('canManage', true));
});

it('opens the register to a user the admin granted view access', function () {
    $this->actingAs(assetUser('sales', ['assets_view']))
        ->get('/assets')
        ->assertOk()
        // Looking is not editing.
        ->assertInertia(fn ($page) => $page->where('canManage', false));
});

it('lets a granted user add an entry', function () {
    $this->actingAs(assetUser('factory', ['assets_manage']))
        ->post('/assets', assetPayload())
        ->assertSessionHasNoErrors();

    expect(CompanyAsset::withoutGlobalScopes()->where('name', 'Dell Latitude 5420')->exists())->toBeTrue();
});

it('refuses an entry from a user who may only look', function () {
    $this->actingAs(assetUser('sales', ['assets_view']))
        ->post('/assets', assetPayload())
        ->assertForbidden();

    expect(CompanyAsset::withoutGlobalScopes()->count())->toBe(0);
});

it('refuses an edit and a delete from a user who may only look', function () {
    $this->actingAs(assetUser('admin'))->post('/assets', assetPayload());
    $asset = CompanyAsset::withoutGlobalScopes()->firstOrFail();

    $this->actingAs(assetUser('sales', ['assets_view']));
    $this->patch("/assets/{$asset->id}", assetPayload(['name' => 'Renamed']))->assertForbidden();
    $this->delete("/assets/{$asset->id}")->assertForbidden();

    expect($asset->fresh()->name)->toBe('Dell Latitude 5420');
});

it('counts how much of each category the company has', function () {
    $this->actingAs(assetUser('admin'));

    $this->post('/assets', assetPayload(['name' => 'Laptops', 'quantity' => 3, 'purchase_cost' => 150000]));
    $this->post('/assets', assetPayload(['name' => 'Spare laptop', 'quantity' => 1, 'purchase_cost' => 50000]));
    $this->post('/assets', assetPayload(['name' => 'Pickup', 'category' => 'Vehicle', 'quantity' => 2]));

    $this->get('/assets')->assertInertia(function ($page) {
        $summary = collect($page->toArray()['props']['summary'])->keyBy('category');

        expect($summary['Laptop / Computer'])
            ->toMatchArray(['entries' => 2, 'quantity' => 4.0, 'value' => 200000.0]);
        expect($summary['Vehicle'])->toMatchArray(['entries' => 1, 'quantity' => 2.0]);
    });
});

it('records what an edit changed', function () {
    $this->actingAs(assetUser('admin'))->post('/assets', assetPayload());
    $asset = CompanyAsset::withoutGlobalScopes()->firstOrFail();

    $this->patch("/assets/{$asset->id}", assetPayload(['assigned_to' => 'Nayan', 'quantity' => 2]))
        ->assertSessionHasNoErrors();

    $labels = collect($asset->fresh()->last_changes['fields'] ?? [])->pluck('label');

    expect($labels)->toContain('Assigned to')->toContain('Quantity');
});

it('shows a company only its own assets', function () {
    $this->actingAs(assetUser('admin'))->post('/assets', assetPayload());

    $other = Company::create(['slug' => 'other', 'name' => 'Other Co', 'is_active' => true]);
    $stranger = assetUser('admin');
    $stranger->companies()->sync([$other->id => ['is_default' => true]]);

    $this->actingAs($stranger->fresh())
        ->get('/assets')
        ->assertInertia(fn ($page) => $page->has('assets', 0));
});

it('rejects a status that is not one of the known ones', function () {
    $this->actingAs(assetUser('admin'))
        ->post('/assets', assetPayload(['status' => 'exploded']))
        ->assertSessionHasErrors('status');
});
