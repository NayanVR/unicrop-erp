<?php
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// Regression: roles other than admin/accountant have no pending materials, and
// the page still calls Eloquent-only helpers on that collection.
it('loads the inventory page for a role that has no pending materials', function () {
    $company = Company::create(['name' => 'Unicrop', 'slug' => 'unicrop', 'is_active' => true]);
    $role = Role::firstOrCreate(['slug' => 'factory'], ['name' => 'Factory']);
    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);
    $user->companies()->attach($company, ['is_default' => true]);

    $res = $this->actingAs($user)->get('/inventory');
    expect($res->status())->toBe(200);
    $res->assertInertia(fn ($page) => $page->component('erp/inventory/index'));
});
