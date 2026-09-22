<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The shared inventory pools feature is gone, so the permission that guarded it
 * is now meaningless. Strip it from every stored policy.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('policies')->get(['id', 'permissions'])->each(function ($policy) {
            $permissions = json_decode($policy->permissions ?? '[]', true) ?? [];

            if (! in_array('products.link_inventory', $permissions, true)) {
                return;
            }

            DB::table('policies')->where('id', $policy->id)->update([
                'permissions' => json_encode(array_values(array_diff($permissions, ['products.link_inventory']))),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // The permission no longer exists in the app, so there is nothing to restore.
    }
};
