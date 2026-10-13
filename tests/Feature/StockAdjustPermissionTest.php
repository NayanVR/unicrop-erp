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

function postStock(User $user, RawMaterial $material, string $type, float $qty)
{
    return test()->actingAs($user)->post("/inventory/materials/{$material->id}/transactions", [
        'type' => $type,
        'qty' => $qty,
    ]);
}

it('lets a factory user with stock-in add but not deduct', function () {
    $user = stockUser('factory', ['stock_in']);

    $material = stockMaterial(50);
    postStock($user, $material, 'purchase', 10)->assertRedirect();
    expect((float) $material->refresh()->stock_qty)->toBe(60.0);

    $material = stockMaterial(50);
    postStock($user, $material, 'issue', 10)->assertForbidden();
    expect((float) $material->refresh()->stock_qty)->toBe(50.0);
});

it('lets a factory user with stock-out deduct but not add', function () {
    $user = stockUser('factory', ['stock_out']);

    $material = stockMaterial(50);
    postStock($user, $material, 'issue', 15)->assertRedirect();
    expect((float) $material->refresh()->stock_qty)->toBe(35.0);

    $material = stockMaterial(50);
    postStock($user, $material, 'purchase', 10)->assertForbidden();
    expect((float) $material->refresh()->stock_qty)->toBe(50.0);
});

it('judges an adjustment by which way it moves the level', function () {
    // Stock-in may correct upwards, not downwards.
    $in = stockUser('factory', ['stock_in']);
    $material = stockMaterial(50);
    postStock($in, $material, 'adjustment', 60)->assertRedirect();
    expect((float) $material->refresh()->stock_qty)->toBe(60.0);

    postStock($in, $material, 'adjustment', 40)->assertForbidden();
    expect((float) $material->refresh()->stock_qty)->toBe(60.0);

    // Stock-out is the mirror image.
    $out = stockUser('factory', ['stock_out']);
    postStock($out, $material, 'adjustment', 40)->assertRedirect();
    expect((float) $material->refresh()->stock_qty)->toBe(40.0);
});

it('blocks a factory user with neither permission', function () {
    $material = stockMaterial(50);

    postStock(stockUser('factory'), $material, 'purchase', 10)->assertForbidden();

    expect((float) $material->refresh()->stock_qty)->toBe(50.0);
});

it('never lets sales move stock, even if the permissions are ticked', function () {
    $sales = stockUser('sales', ['stock_in', 'stock_out']);
    $material = stockMaterial(50);

    postStock($sales, $material, 'purchase', 10)->assertForbidden();
    postStock($sales, $material, 'issue', 10)->assertForbidden();

    expect((float) $material->refresh()->stock_qty)->toBe(50.0);
});

it('leaves admins with both sides', function () {
    $admin = stockUser('admin');

    $material = stockMaterial(50);
    postStock($admin, $material, 'purchase', 10)->assertRedirect();
    expect((float) $material->refresh()->stock_qty)->toBe(60.0);

    postStock($admin, $material, 'issue', 20)->assertRedirect();
    expect((float) $material->refresh()->stock_qty)->toBe(40.0);
});

it('tells the page which sides a user has', function () {
    $this->actingAs(stockUser('factory', ['stock_in']))
        ->get('/inventory')
        ->assertInertia(fn ($page) => $page
            ->where('canStockIn', true)
            ->where('canStockOut', false));

    $this->actingAs(stockUser('sales', ['stock_in', 'stock_out']))
        ->get('/inventory')
        ->assertInertia(fn ($page) => $page
            ->where('canStockIn', false)
            ->where('canStockOut', false));
});
