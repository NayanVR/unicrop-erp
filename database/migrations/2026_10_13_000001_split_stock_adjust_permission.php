<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The single stock_adjust permission was split into stock_in and stock_out.
 * Anyone who already had it keeps both sides.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->get(['id', 'permissions'])->each(function ($user) {
            $permissions = json_decode($user->permissions ?? '[]', true) ?? [];

            if (! in_array('stock_adjust', $permissions, true)) {
                return;
            }

            $permissions = array_values(array_unique(array_merge(
                array_diff($permissions, ['stock_adjust']),
                ['stock_in', 'stock_out'],
            )));

            DB::table('users')->where('id', $user->id)->update([
                'permissions' => json_encode($permissions),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        DB::table('users')->get(['id', 'permissions'])->each(function ($user) {
            $permissions = json_decode($user->permissions ?? '[]', true) ?? [];

            if (! array_intersect(['stock_in', 'stock_out'], $permissions)) {
                return;
            }

            $permissions = array_values(array_unique(array_merge(
                array_diff($permissions, ['stock_in', 'stock_out']),
                ['stock_adjust'],
            )));

            DB::table('users')->where('id', $user->id)->update([
                'permissions' => json_encode($permissions),
                'updated_at' => now(),
            ]);
        });
    }
};
