<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $adminRole = Role::where('slug', 'admin')->first();
        if (! $adminRole) {
            return;
        }

        // Assign admin role to any user that currently has no roles
        User::doesntHave('roles')->each(function (User $user) use ($adminRole) {
            $user->roles()->syncWithoutDetaching([$adminRole->id]);
        });
    }

    public function down(): void {}
};
