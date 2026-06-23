<?php

use App\Models\Company;
use App\Models\Policy;
use App\Models\Role;
use App\Models\User;

function adminForCompanyAdmin(): User
{
    $company = Company::first();
    $role = Role::firstOrCreate(['slug' => Role::ADMIN], ['name' => 'Admin']);
    $policy = Policy::where('is_system', true)->where('slug', Role::ADMIN)->first();

    $user = User::factory()->create(['is_active' => true]);
    $user->roles()->sync([$role->id]);
    $user->companies()->sync([
        $company->id => ['policy_id' => $policy->id, 'is_default' => true],
    ]);

    return $user;
}

test('admin can create, update and delete a company', function () {
    $admin = adminForCompanyAdmin();

    $this->actingAs($admin)->post('/companies', ['name' => 'New Branch Co'])
        ->assertRedirect();

    $company = Company::where('name', 'New Branch Co')->first();
    expect($company)->not->toBeNull();
    expect($company->slug)->toBe('new-branch-co');

    $this->actingAs($admin)->patch("/companies/{$company->id}", ['name' => 'Renamed Branch Co', 'is_active' => false])
        ->assertRedirect();

    $company->refresh();
    expect($company->name)->toBe('Renamed Branch Co');
    expect($company->is_active)->toBeFalse();

    $this->actingAs($admin)->delete("/companies/{$company->id}")->assertRedirect();
    expect(Company::find($company->id))->toBeNull();
});

test('the last remaining company cannot be deleted', function () {
    $admin = adminForCompanyAdmin();
    Company::query()->where('id', '!=', Company::first()->id)->delete();

    $only = Company::first();
    $this->actingAs($admin)->delete("/companies/{$only->id}")
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Company::find($only->id))->not->toBeNull();
});

test('admin can create a custom policy with a permission subset', function () {
    $admin = adminForCompanyAdmin();

    $this->actingAs($admin)->post('/policies', [
        'name' => 'Limited Sales',
        'permissions' => ['orders.view', 'orders.print'],
    ])->assertRedirect()->assertSessionDoesntHaveErrors();

    $policy = Policy::where('name', 'Limited Sales')->first();
    expect($policy->permissions)->toBe(['orders.view', 'orders.print']);
    expect($policy->is_system)->toBeFalse();
});

test('admin can edit a system policy permissions while its name and slug stay fixed', function () {
    $admin = adminForCompanyAdmin();

    $systemPolicy = Policy::where('is_system', true)->where('slug', '!=', Role::ADMIN)->first();
    $originalName = $systemPolicy->name;
    $originalSlug = $systemPolicy->slug;

    $this->actingAs($admin)->patch("/policies/{$systemPolicy->id}", [
        'name' => 'Renamed System Policy',
        'permissions' => ['orders.view', 'orders.print'],
    ])->assertRedirect()->assertSessionHas('success');

    $systemPolicy->refresh();
    expect($systemPolicy->permissions)->toBe(['orders.view', 'orders.print']);
    expect($systemPolicy->name)->toBe($originalName);
    expect($systemPolicy->slug)->toBe($originalSlug);
    expect($systemPolicy->is_system)->toBeTrue();
});
