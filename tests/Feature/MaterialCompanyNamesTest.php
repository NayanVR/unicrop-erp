<?php

use App\Models\Company;
use App\Models\Policy;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use App\Services\CurrentCompany;
use Illuminate\Support\Facades\Schema;

/**
 * @return array{0: User, 1: Company, 2: Company}
 */
function makeMaterial(Company $company, string $name, string $unit = 'kg'): RawMaterial
{
    $material = RawMaterial::make(['name' => $name, 'unit' => $unit]);
    $material->company_id = $company->id;
    $material->save();

    return $material;
}

/**
 * @return array{0: User, 1: Company, 2: Company}
 */
function twoCompanyAdmin(): array
{
    $companyA = Company::first();
    $companyB = Company::create(['name' => 'Company B', 'slug' => 'company-b', 'is_active' => true]);

    $role   = Role::firstOrCreate(['slug' => Role::ADMIN], ['name' => 'Admin']);
    $policy = Policy::where('is_system', true)->where('slug', Role::ADMIN)->first();

    $user = User::factory()->create(['is_active' => true]);
    $user->roles()->sync([$role->id]);
    $user->companies()->sync([
        $companyA->id => ['policy_id' => $policy->id, 'is_default' => true],
        $companyB->id => ['policy_id' => $policy->id, 'is_default' => false],
    ]);

    return [$user, $companyA, $companyB];
}

test('a material can carry a different name in each company', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();

    $this->actingAs($user)->post('/inventory/materials', [
        'name'          => '19:19:19',
        'company_id'    => $companyA->id,
        'company_names' => [['company_id' => $companyB->id, 'name' => 'NPK 19-19-19']],
        'description'   => 'NPK water soluble fertiliser',
        'unit'          => 'kg',
    ])->assertRedirect()->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', '19:19:19');

    expect($material->company_id)->toBe($companyA->id)
        ->and($material->description)->toBe('NPK water soluble fertiliser')
        ->and($material->nameForCompany($companyA->id))->toBe('19:19:19')
        ->and($material->nameForCompany($companyB->id))->toBe('NPK 19-19-19');
});

test('display_name follows whichever company is active', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();

    $material = makeMaterial($companyA, '19:19:19');
    $material->companyNames()->createMany([
        ['company_id' => $companyA->id, 'name' => '19:19:19'],
        ['company_id' => $companyB->id, 'name' => 'NPK 19-19-19'],
    ]);

    app(CurrentCompany::class)->set($companyA);
    expect(RawMaterial::find($material->id)->display_name)->toBe('19:19:19');

    app(CurrentCompany::class)->set($companyB);
    expect(RawMaterial::find($material->id)->display_name)->toBe('NPK 19-19-19');
});

test('a material is visible to a company that has named it, and hidden from one that has not', function () {
    [, $companyA, $companyB] = twoCompanyAdmin();
    $companyC = Company::create(['name' => 'Company C', 'slug' => 'company-c', 'is_active' => true]);

    $material = makeMaterial($companyA, 'Emamectin 1.9');
    $material->companyNames()->create(['company_id' => $companyB->id, 'name' => 'EMA 1.9']);

    app(CurrentCompany::class)->set($companyB);
    expect(RawMaterial::whereKey($material->id)->exists())->toBeTrue();

    app(CurrentCompany::class)->set($companyC);
    expect(RawMaterial::whereKey($material->id)->exists())->toBeFalse();
});

test('the named scope matches the default name and every company name', function () {
    [, $companyA, $companyB] = twoCompanyAdmin();

    $material = makeMaterial($companyA, 'Emamectin 1.9');
    $material->companyNames()->create(['company_id' => $companyB->id, 'name' => 'EMA 1.9']);

    app(CurrentCompany::class)->set($companyA);
    expect(RawMaterial::named('emamectin 1.9')->first()?->id)->toBe($material->id)
        ->and(RawMaterial::named(' EMA 1.9 ')->first()?->id)->toBe($material->id)
        ->and(RawMaterial::named('something else')->first())->toBeNull();
});

test('the same name may be reused in a different company but not within one', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();

    $this->actingAs($user)->post('/inventory/materials', [
        'name' => 'Humic Acid', 'company_id' => $companyA->id, 'unit' => 'kg',
    ])->assertSessionHasNoErrors();

    // Same name, different company — fine.
    $this->actingAs($user)->post('/inventory/materials', [
        'name' => 'Humic Acid', 'company_id' => $companyB->id, 'unit' => 'kg',
    ])->assertSessionHasNoErrors();

    // Same name, same company — rejected.
    $this->actingAs($user)->post('/inventory/materials', [
        'name' => 'Humic Acid', 'company_id' => $companyA->id, 'unit' => 'kg',
    ])->assertSessionHasErrors('company_names');

    // Claiming a name another material already answers to in that company — rejected.
    $this->actingAs($user)->post('/inventory/materials', [
        'name'          => 'Potassium Humate',
        'company_id'    => $companyA->id,
        'company_names' => [['company_id' => $companyB->id, 'name' => 'Humic Acid']],
        'unit'          => 'kg',
    ])->assertSessionHasErrors('company_names');

    expect(RawMaterial::withoutGlobalScopes()->where('name', 'Humic Acid')->count())->toBe(2);
});

test('editing a material rewrites its per-company names', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();

    $material = makeMaterial($companyA, '19:19:19');
    $material->companyNames()->createMany([
        ['company_id' => $companyA->id, 'name' => '19:19:19'],
        ['company_id' => $companyB->id, 'name' => 'NPK 19-19-19'],
    ]);

    $this->actingAs($user)->patch("/inventory/materials/{$material->id}", [
        'name'          => 'NPK 19:19:19',
        'company_id'    => $companyA->id,
        'company_names' => [],
        'unit'          => 'kg',
    ])->assertSessionHasNoErrors();

    $material->refresh()->load('companyNames');

    expect($material->name)->toBe('NPK 19:19:19')
        ->and($material->companyNames)->toHaveCount(1)
        ->and($material->nameForCompany($companyA->id))->toBe('NPK 19:19:19')
        ->and($material->nameForCompany($companyB->id))->toBe('NPK 19:19:19');
});

test('an admin can file a material under a company other than the active one', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();

    $this->actingAs($user)->post('/inventory/materials', [
        'name'       => 'Sulphur 80 WDG',
        'company_id' => $companyB->id,
        'unit'       => 'kg',
    ])->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', 'Sulphur 80 WDG');

    expect($material->company_id)->toBe($companyB->id)
        ->and($material->company_id)->not->toBe($companyA->id)
        ->and($material->nameForCompany($companyB->id))->toBe('Sulphur 80 WDG');
});

test('description replaces alternative names on the material', function () {
    [$user, $companyA] = twoCompanyAdmin();

    $this->actingAs($user)->post('/inventory/materials', [
        'name'        => 'Emamectin Benzoate',
        'company_id'  => $companyA->id,
        'unit'        => 'kg',
        'description' => 'Technical grade, 1.9% EC. Store away from sunlight.',
    ])->assertSessionHasNoErrors();

    $material = RawMaterial::withoutGlobalScopes()->firstWhere('name', 'Emamectin Benzoate');

    expect($material->description)->toBe('Technical grade, 1.9% EC. Store away from sunlight.')
        ->and(Schema::hasColumn('raw_materials', 'alternative_names'))->toBeFalse()
        ->and(Schema::hasColumn('raw_materials', 'description'))->toBeTrue();
});

test('saving does not drop names belonging to companies the user cannot manage', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();
    $companyC = Company::create(['name' => 'Company C', 'slug' => 'company-c', 'is_active' => true]);

    // A non-admin who belongs to A only; C names the material too and is out of reach.
    $user->roles()->sync([Role::firstOrCreate(['slug' => 'factory'], ['name' => 'Factory'])->id]);
    $user->companies()->detach($companyB->id);

    $material = makeMaterial($companyA, '19:19:19');
    $material->companyNames()->createMany([
        ['company_id' => $companyA->id, 'name' => '19:19:19'],
        ['company_id' => $companyC->id, 'name' => 'Grade-A NPK'],
    ]);

    $this->actingAs($user)->patch("/inventory/materials/{$material->id}", [
        'name'          => '19:19:19',
        'company_id'    => $companyA->id,
        'company_names' => [],
        'unit'          => 'kg',
    ])->assertSessionHasNoErrors();

    $material->refresh()->load('companyNames');

    expect($material->nameForCompany($companyC->id))->toBe('Grade-A NPK');
});

test('a user cannot file a material under a company they do not belong to', function () {
    [$user, $companyA] = twoCompanyAdmin();
    $outsider = Company::create(['name' => 'Outsider', 'slug' => 'outsider', 'is_active' => true]);

    // Drop admin so the "every company" shortcut does not apply.
    $user->roles()->sync([Role::firstOrCreate(['slug' => 'factory'], ['name' => 'Factory'])->id]);

    $this->actingAs($user)->post('/inventory/materials', [
        'name' => 'Zinc Sulphate', 'company_id' => $outsider->id, 'unit' => 'kg',
    ])->assertSessionHasErrors('company_id');

    expect(RawMaterial::withoutGlobalScopes()->where('name', 'Zinc Sulphate')->exists())->toBeFalse()
        ->and($companyA->id)->not->toBe($outsider->id);
});

test('an update that omits company_names leaves the other names in place', function () {
    [$user, $companyA, $companyB] = twoCompanyAdmin();

    $material = makeMaterial($companyA, '19:19:19');
    $material->companyNames()->createMany([
        ['company_id' => $companyA->id, 'name' => '19:19:19'],
        ['company_id' => $companyB->id, 'name' => 'NPK 19-19-19'],
    ]);

    // An old cached tab posts the pre-overhaul payload: no company_names key.
    $this->actingAs($user)->patch("/inventory/materials/{$material->id}", [
        'name' => '19:19:19', 'unit' => 'kg',
    ])->assertSessionHasNoErrors();

    $material->refresh()->load('companyNames');

    expect($material->nameForCompany($companyB->id))->toBe('NPK 19-19-19')
        ->and($material->companyNames)->toHaveCount(2);

    // An explicit empty list from the editor still clears them.
    $this->actingAs($user)->patch("/inventory/materials/{$material->id}", [
        'name' => '19:19:19', 'unit' => 'kg', 'company_names' => [],
    ])->assertSessionHasNoErrors();

    $material->refresh()->load('companyNames');

    expect($material->companyNames)->toHaveCount(1)
        ->and($material->nameForCompany($companyB->id))->toBe('19:19:19');
});
