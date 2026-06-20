<?php

use App\Models\Company;
use App\Models\Policy;
use App\Models\Product;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;

function createCompanyAdmin(Company $company): User
{
    $role = Role::firstOrCreate(['slug' => Role::ADMIN], ['name' => 'Admin']);
    $policy = Policy::where('is_system', true)->where('slug', Role::ADMIN)->first();

    $user = User::factory()->create(['is_active' => true]);
    $user->roles()->sync([$role->id]);
    $user->companies()->sync([
        $company->id => ['policy_id' => $policy->id, 'is_default' => true],
    ]);

    return $user;
}

test('products are isolated per company and can share the same name across companies', function () {
    $companyA = Company::first();
    $companyB = Company::create(['name' => 'Product Test Co B', 'slug' => 'product-test-co-b', 'is_active' => true]);

    $userA = createCompanyAdmin($companyA);
    $userB = createCompanyAdmin($companyB);

    $this->actingAs($userA)->post('/companies/switch', ['company_id' => $companyA->id]);
    $this->actingAs($userA)->post('/products', [
        'name' => 'Shared Name',
        'packing_size' => '1L',
        'gst_percent' => 18,
    ])->assertRedirect()->assertSessionDoesntHaveErrors();

    $this->actingAs($userB)->post('/companies/switch', ['company_id' => $companyB->id]);
    $this->actingAs($userB)->post('/products', [
        'name' => 'Shared Name',
        'packing_size' => '1L',
        'gst_percent' => 18,
    ])->assertRedirect()->assertSessionDoesntHaveErrors();

    expect(Product::withoutGlobalScopes()->count())->toBe(2);

    $this->actingAs($userA)->post('/companies/switch', ['company_id' => $companyA->id]);
    $response = $this->actingAs($userA)->get('/products');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('products', 1));
});

test('product name uniqueness is scoped per company, not global', function () {
    $companyA = Company::first();
    $userA = createCompanyAdmin($companyA);

    session(['current_company_id' => $companyA->id]);
    $this->actingAs($userA)->post('/products', [
        'name' => 'Duplicate Name',
        'packing_size' => '500ml',
        'gst_percent' => 18,
    ])->assertRedirect();

    $response = $this->actingAs($userA)->post('/products', [
        'name' => 'Duplicate Name',
        'packing_size' => '500ml',
        'gst_percent' => 18,
    ]);

    $response->assertSessionHasErrors('name');
});

test('a product can link 1:1 to a raw material', function () {
    $companyA = Company::first();
    $userA = createCompanyAdmin($companyA);

    session(['current_company_id' => $companyA->id]);
    $material = RawMaterial::create([
        'name' => 'Bulk Liquid X',
        'unit' => 'L',
        'stock_qty' => 100,
    ]);

    $this->actingAs($userA)->post('/products', [
        'raw_material_id' => $material->id,
        'name' => 'ABC Brand',
        'packing_size' => '1L',
        'gst_percent' => 18,
    ])->assertRedirect();

    $product = Product::where('name', 'ABC Brand')->first();
    expect($product->raw_material_id)->toBe($material->id);
});
