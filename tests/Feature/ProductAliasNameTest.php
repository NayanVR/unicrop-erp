<?php

use App\Models\Company;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function aliasAdmin(): User
{
    $company = Company::firstOrCreate(
        ['slug' => 'unicrop'],
        ['name' => 'Unicrop Biochem', 'is_active' => true],
    );
    $role = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);

    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);
    $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

    return $user;
}

function aliasCompanyId(): int
{
    return (int) Company::where('slug', 'unicrop')->value('id');
}

/** @param array<int, string> $extra */
function aliasPayload(string $name, array $extra = [], array $overrides = []): array
{
    return array_merge([
        'name'          => $name,
        'company_id'    => aliasCompanyId(),
        'company_names' => array_map(
            fn (string $n) => ['company_id' => aliasCompanyId(), 'name' => $n],
            $extra,
        ),
        'unit'     => 'kg',
        'category' => 'Finished Goods',
    ], $overrides);
}

it('stores several names for the same company', function () {
    $this->actingAs(aliasAdmin());

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['NPK 19-19-19', 'Triple Nineteen']))
        ->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', '19:19:19');

    expect($material->namesForCompany(aliasCompanyId()))
        ->toBe(['19:19:19', 'NPK 19-19-19', 'Triple Nineteen']);
});

it('keeps the main name first however the extras are ordered', function () {
    $this->actingAs(aliasAdmin());

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['AAA First Alphabetically']))
        ->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', '19:19:19');

    expect($material->nameForCompany(aliasCompanyId()))->toBe('19:19:19');
});

it('does not store the same name twice for one company', function () {
    $this->actingAs(aliasAdmin());

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['19:19:19', ' npk ', 'NPK']))
        ->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', '19:19:19');

    expect($material->namesForCompany(aliasCompanyId()))->toBe(['19:19:19', 'npk']);
});

it('refuses a name another material in the company already answers to', function () {
    $this->actingAs(aliasAdmin());

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['NPK 19-19-19']))
        ->assertSessionHasNoErrors();

    $this->post('/inventory/materials', aliasPayload('Urea', ['NPK 19-19-19']))
        ->assertSessionHasErrors('company_names');

    expect(RawMaterial::withoutGlobalScopes()->where('name', 'Urea')->exists())->toBeFalse();
});

it('keeps the extra names when a material is edited', function () {
    $this->actingAs(aliasAdmin());

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['NPK 19-19-19']))
        ->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', '19:19:19');

    // An editor that renames the product but leaves the extra name in place.
    $this->patch("/inventory/materials/{$material->id}", aliasPayload('19-19-19', ['NPK 19-19-19']))
        ->assertSessionHasNoErrors();

    expect($material->fresh()->namesForCompany(aliasCompanyId()))
        ->toBe(['19-19-19', 'NPK 19-19-19']);
});

it('shows sales every name a product answers to in the new-order brand picker', function () {
    $this->actingAs(aliasAdmin());

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['NPK 19-19-19'], [
        'stock_qty' => 40,
    ]))->assertSessionHasNoErrors();

    $this->get('/orders/create')
        ->assertOk()
        ->assertInertia(function ($page) {
            $names = collect($page->toArray()['props']['finishGoodBrands'])->pluck('name')->all();

            expect($names)->toContain('19:19:19')->toContain('NPK 19-19-19');
        });
});

it('accepts an order placed under an alternative name', function () {
    $user = aliasAdmin();
    $this->actingAs($user);

    $this->post('/inventory/materials', aliasPayload('19:19:19', ['NPK 19-19-19']))
        ->assertSessionHasNoErrors();

    // The scope that resolves a typed-in product name has to see the alias.
    expect(RawMaterial::withoutGlobalScopes()->named('NPK 19-19-19')->value('name'))
        ->toBe('19:19:19');
});
