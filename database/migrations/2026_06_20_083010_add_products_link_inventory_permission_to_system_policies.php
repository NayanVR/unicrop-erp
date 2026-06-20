<?php

use App\Models\Policy;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $legacyPermissions = Policy::legacyRolePermissions();

        DB::table('policies')->where('is_system', true)->get(['id', 'slug', 'permissions'])->each(function ($policy) use ($legacyPermissions) {
            if (!isset($legacyPermissions[$policy->slug])) {
                return;
            }

            if (!in_array('products.link_inventory', $legacyPermissions[$policy->slug], true)) {
                return;
            }

            $permissions = json_decode($policy->permissions, true) ?? [];

            if (in_array('products.link_inventory', $permissions, true)) {
                return;
            }

            $permissions[] = 'products.link_inventory';

            DB::table('policies')->where('id', $policy->id)->update([
                'permissions' => json_encode($permissions),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        DB::table('policies')->where('is_system', true)->get(['id', 'permissions'])->each(function ($policy) {
            $permissions = array_values(array_diff(json_decode($policy->permissions, true) ?? [], ['products.link_inventory']));

            DB::table('policies')->where('id', $policy->id)->update([
                'permissions' => json_encode($permissions),
                'updated_at' => now(),
            ]);
        });
    }
};
