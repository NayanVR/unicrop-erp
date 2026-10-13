<?php

use App\Models\Company;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function stockUser(string $slug, array $permissions = []): User
{
    $company = Company::firstOrCreate(
        ['slug' => 'unicrop'],
        ['name' => 'Unicrop', 'is_active' => true],
    );
    $role = Role::firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug)]);

    $user = User::factory()->create(['permissions' => $permissions]);
    $user->roles()->sync([$role->id]);
    $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

    return $user;
}

function stockMaterial(float $qty = 50): RawMaterial
{
    $material = RawMaterial::create([
        'name' => 'Rolled Oats',
        'unit' => 'kg',
        'stock_qty' => $qty,
        'cost_per_unit' => 100,
        'approval_status' => 'approved',
        'is_active' => true,
    ]);

    // ResolveCurrentCompany only runs for real requests, so set the owner here.
    $material->forceFill(['company_id' => Company::where('slug', 'unicrop')->value('id')])->save();

    return $material;
}

function addStock(User $user, RawMaterial $material, string $type, float $qty)
{
    return test()->actingAs($user)->post("/inventory/materials/{$material->id}/transactions", [
        'type' => $type,
        'qty' => $qty,
    ]);
}

it('lets a granted user add stock', function () {
    $user = stockUser('sales', ['stock_adjust']);
    $material = stockMaterial(50);

    addStock($user, $material, 'purchase', 10)->assertRedirect();

    expect((float) $material->refresh()->stock_qty)->toBe(60.0);
});

it('lets a granted user deduct stock', function () {
    $user = stockUser('sales', ['stock_adjust']);
    $material = stockMaterial(50);

    addStock($user, $material, 'issue', 15)->assertRedirect();

    expect((float) $material->refresh()->stock_qty)->toBe(35.0);
});

it('blocks a user without the permission', function () {
    $user = stockUser('sales');          // no permissions
    $material = stockMaterial(50);

    addStock($user, $material, 'purchase', 10)->assertForbidden();

    expect((float) $material->refresh()->stock_qty)->toBe(50.0);
});

it('still lets admins and the factory move stock by role alone', function () {
    foreach (['admin', 'factory'] as $slug) {
        $user = stockUser($slug);
        $material = stockMaterial(50);

        addStock($user, $material, 'purchase', 5)->assertRedirect();

        expect((float) $material->refresh()->stock_qty)->toBe(55.0);
    }
});

it('tells the page who may move stock', function () {
    $this->actingAs(stockUser('sales', ['stock_adjust']))
        ->get('/inventory')
        ->assertInertia(fn ($page) => $page->where('canAdjustStock', true));

    $this->actingAs(stockUser('sales'))
        ->get('/inventory')
        ->assertInertia(fn ($page) => $page->where('canAdjustStock', false));
});
