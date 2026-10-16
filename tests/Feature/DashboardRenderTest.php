<?php

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function dashboardUser(string $slug): User
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

it('renders every role dashboard', function (string $role, string $component) {
    $this->actingAs(dashboardUser($role))
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component($component));
})->with([
    ['sales', 'erp/dashboard'],
    ['admin', 'erp/dashboard'],
    ['factory', 'erp/factory-dashboard'],
    ['design', 'erp/design-dashboard'],
    ['accountant', 'erp/accountant-dashboard'],
]);

it('gives the hero the company and user it greets', function () {
    $user = dashboardUser('sales');

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn ($page) => $page
            ->where('auth.user.name', $user->name)
            ->where('auth.current_company.name', 'Unicrop'));
});
