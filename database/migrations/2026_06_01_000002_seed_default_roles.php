<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (Role::defaultRoles() as $role) {
            Role::updateOrCreate(['slug' => $role['slug']], ['name' => $role['name']]);
        }
    }

    public function down(): void {}
};
