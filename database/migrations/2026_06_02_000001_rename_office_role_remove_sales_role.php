<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Rename "Office / Sales" → "Sales"
        Role::where('slug', 'office')->update(['name' => 'Sales']);

        // Move any users on 'sales' role to 'office' role
        $salesRole  = Role::where('slug', 'sales')->first();
        $officeRole = Role::where('slug', 'office')->first();

        if ($salesRole && $officeRole) {
            foreach ($salesRole->users as $user) {
                $user->roles()->syncWithoutDetaching([$officeRole->id]);
            }
            $salesRole->delete();
        }
    }

    public function down(): void {}
};
