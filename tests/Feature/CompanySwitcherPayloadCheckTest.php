<?php

use App\Models\Company;
use App\Models\Policy;
use App\Models\Role;
use App\Models\User;

test('dashboard inertia payload exposes companies and current_company for a multi-company user', function () {
    $companyA = Company::first();
    $companyB = Company::create(['name' => 'Verify Co B', 'slug' => 'verify-co-b-2', 'is_active' => true]);

    $role = Role::firstOrCreate(['slug' => Role::ADMIN], ['name' => 'Admin']);
    $policy = Policy::where('is_system', true)->where('slug', Role::ADMIN)->first();

    $user = User::factory()->create(['is_active' => true]);
    $user->roles()->sync([$role->id]);
    $user->companies()->sync([
        $companyA->id => ['policy_id' => $policy->id, 'is_default' => true],
        $companyB->id => ['policy_id' => $policy->id, 'is_default' => false],
    ]);

    $response = $this->actingAs($user)->get('/dashboard');
    $response->assertOk();
    $response->assertInertia(function ($page) use ($companyA) {
        $page->has('auth.user.companies', 2);
        $page->where('auth.current_company.id', $companyA->id);
    });

    $switchResponse = $this->actingAs($user)->post('/companies/switch', ['company_id' => $companyB->id]);
    $switchResponse->assertRedirect();

    $afterSwitch = $this->actingAs($user)->get('/dashboard');
    $afterSwitch->assertOk();
    $afterSwitch->assertInertia(function ($page) use ($companyB) {
        $page->where('auth.current_company.id', $companyB->id);
    });
});
