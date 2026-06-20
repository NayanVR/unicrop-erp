<?php

use App\Models\Policy;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::table('policies')->where('is_system', true)->exists()) {
            return;
        }

        $now = now();

        foreach (Policy::legacyRolePermissions() as $roleSlug => $permissions) {
            DB::table('policies')->insert([
                'company_id' => null,
                'name' => ucfirst($roleSlug).' (system)',
                'slug' => $roleSlug,
                'permissions' => json_encode($permissions),
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('policies')->where('is_system', true)->delete();
    }
};
