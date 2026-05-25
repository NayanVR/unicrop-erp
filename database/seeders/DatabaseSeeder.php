<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        if (!User::where('email', 'admin@unicropbiochem.com')->exists()) {
            User::factory()
                ->withRole(Role::ADMIN)
                ->create([
                    'name' => 'Admin User',
                    'email' => 'admin@unicropbiochem.com',
                ]);
        }
    }
}
