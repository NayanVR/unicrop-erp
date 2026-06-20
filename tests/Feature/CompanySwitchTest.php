<?php

use App\Models\Company;
use App\Models\Policy;
use App\Models\Role;
use App\Models\User;

test('user can switch between companies they belong to', function () {
    $companyA = Company::first();
    $companyB = Company::create(['name' => 'Company B', 'slug' => 'company-b', 'is_active' => true]);

    $role = Role::firstOrCreate(['slug' => Role::ADMIN], ['name' => 'Admin']);
    $policy = Policy::where('is_system', true)->where('slug', Role::ADMIN)->first();

    $user = User::factory()->create(['is_active' => true]);
    $user->roles()->sync([$role->id]);
    $user->companies()->sync([
        $companyA->id => ['policy_id' => $policy->id, 'is_default' => true],
        $companyB->id => ['policy_id' => $policy->id, 'is_default' => false],
    ]);

    $response = $this->actingAs($user)->post('/companies/switch', ['company_id' => $companyB->id]);
    $response->assertRedirect();

    expect(session('current_company_id'))->toBe($companyB->id);

    $otherCompany = Company::create(['name' => 'Not Mine', 'slug' => 'not-mine', 'is_active' => true]);
    $forbidden = $this->actingAs($user)->post('/companies/switch', ['company_id' => $otherCompany->id]);
    $forbidden->assertForbidden();
});
