<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('allows admins to view user management', function () {
    $adminRole = Role::query()->create(['name' => 'Admin', 'slug' => Role::ADMIN]);
    $admin = User::factory()->create();
    $admin->roles()->sync([$adminRole->id]);

    $this->actingAs($admin)
        ->get(route('users.index'))
        ->assertOk();
});

it('blocks non-admins from user management', function () {
    $officeRole = Role::query()->create(['name' => 'Office', 'slug' => Role::OFFICE]);
    $user = User::factory()->create();
    $user->roles()->sync([$officeRole->id]);

    $this->actingAs($user)
        ->get(route('users.index'))
        ->assertForbidden();
});

it('lets admins create users with roles', function () {
    $adminRole = Role::query()->create(['name' => 'Admin', 'slug' => Role::ADMIN]);
    $officeRole = Role::query()->create(['name' => 'Office', 'slug' => Role::OFFICE]);

    $admin = User::factory()->create();
    $admin->roles()->sync([$adminRole->id]);

    $payload = [
        'name' => 'Office User',
        'email' => 'office@unicropbiochem.com',
        'password' => 'Password123!',
        'roles' => [$officeRole->id],
        'status' => 'active',
        'phone' => '1234567890',
        'notes' => 'Sales team',
        'modules' => ['inventory'],
        'permissions' => ['confirm'],
        'company_access' => ['Unicrop'],
        'cost_access' => false,
    ];

    $this->actingAs($admin)
        ->post(route('users.store'), $payload)
        ->assertRedirect();

    $created = User::query()->where('email', 'office@unicropbiochem.com')->first();

    expect($created)->not->toBeNull();
    expect($created->roles->pluck('id')->all())->toContain($officeRole->id);
});

it('lets admins update users', function () {
    $adminRole = Role::query()->create(['name' => 'Admin', 'slug' => Role::ADMIN]);
    $officeRole = Role::query()->create(['name' => 'Office', 'slug' => Role::OFFICE]);
    $factoryRole = Role::query()->create(['name' => 'Factory', 'slug' => Role::FACTORY]);

    $admin = User::factory()->create();
    $admin->roles()->sync([$adminRole->id]);

    $user = User::factory()->create([
        'email' => 'update@unicropbiochem.com',
    ]);
    $user->roles()->sync([$officeRole->id]);

    $payload = [
        'name' => 'Updated User',
        'email' => 'update@unicropbiochem.com',
        'password' => 'NewPassword123!',
        'roles' => [$factoryRole->id],
        'status' => 'inactive',
        'phone' => '9998887770',
        'notes' => 'Updated notes',
        'modules' => ['factory'],
        'permissions' => ['processing'],
        'company_access' => ['Unicrop'],
        'cost_access' => true,
    ];

    $this->actingAs($admin)
        ->put(route('users.update', $user), $payload)
        ->assertRedirect();

    $user->refresh();

    expect($user->name)->toBe('Updated User');
    expect($user->is_active)->toBeFalse();
    expect(Hash::check('NewPassword123!', $user->password))->toBeTrue();
    expect($user->roles->pluck('id')->all())->toContain($factoryRole->id);
});
