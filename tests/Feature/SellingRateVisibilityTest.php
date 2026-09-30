<?php

use App\Models\Company;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function sellingRateUser(string $slug): User
{
    $company = Company::firstOrCreate(
        ['slug' => 'unicrop'],
        ['name' => 'Unicrop', 'is_active' => true],
    );
    $role = Role::firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug)]);

    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);
    $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

    return $user;
}

function sellingRateMaterial(): RawMaterial
{
    $material = RawMaterial::create([
        'name' => 'Rolled Oats',
        'unit' => 'kg',
        'stock_qty' => 50,
        'cost_per_unit' => 100,
        'selling_rate' => 145,
        'approval_status' => 'approved',
        'is_active' => true,
    ]);

    // ResolveCurrentCompany only runs for real requests, so set the owner here.
    $material->forceFill(['company_id' => Company::where('slug', 'unicrop')->value('id')])->save();

    return $material;
}

it('keeps selling rates out of the payload for factory users', function () {
    $this->actingAs(sellingRateUser('factory'));
    sellingRateMaterial();

    $this->get('/inventory')
        ->assertInertia(fn ($page) => $page
            ->where('canSeeSellingRate', false)
            ->where('materials.0.selling_rate', null));
});

it('still sends selling rates to admins', function () {
    $this->actingAs(sellingRateUser('admin'));
    sellingRateMaterial();

    $this->get('/inventory')
        ->assertInertia(fn ($page) => $page
            ->where('canSeeSellingRate', true)
            ->where('materials.0.selling_rate', '145.00'));
});

it('does not let a factory save wipe the stored selling rate', function () {
    $this->actingAs(sellingRateUser('factory'));
    $material = sellingRateMaterial();

    // The factory form never holds a rate, so it posts a blank one.
    $this->patch("/inventory/materials/{$material->id}", [
            'name' => 'Rolled Oats',
            'unit' => 'kg',
            'cost_per_unit' => 110,
            'selling_rate' => 0,
        ])->assertRedirect();

    $material->refresh();

    expect($material->selling_rate)->toEqual('145.00')   // untouched
        ->and($material->cost_per_unit)->toEqual('110.00'); // the rest still saves
});

it('lets an admin change the selling rate', function () {
    $this->actingAs(sellingRateUser('admin'));
    $material = sellingRateMaterial();

    $this->patch("/inventory/materials/{$material->id}", [
            'name' => 'Rolled Oats',
            'unit' => 'kg',
            'cost_per_unit' => 100,
            'selling_rate' => 199,
        ])->assertRedirect();

    expect($material->refresh()->selling_rate)->toEqual('199.00');
});
