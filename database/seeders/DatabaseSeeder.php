<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        if (!User::where('email', 'admin@unicropbiochem.com')->exists()) {
            $admin = User::create([
                'name' => 'Admin User',
                'email' => 'admin@unicropbiochem.com',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]);

            $role = Role::where('slug', Role::ADMIN)->first();
            if ($role) {
                $admin->roles()->attach($role->id);
            }
        }
    }
}
