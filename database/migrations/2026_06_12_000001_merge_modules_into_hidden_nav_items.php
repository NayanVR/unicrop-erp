<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Module access and sidebar visibility are now a single setting
     * (hidden_nav_items). Convert existing module restrictions so users
     * keep seeing exactly what they saw before.
     */
    public function up(): void
    {
        $navToModule = [
            'factory'        => 'factory',
            'bom'            => 'bom',
            'filling'        => 'bottle-filling',
            'inventory'      => 'inventory',
            'finished-goods' => 'finished-goods',
        ];

        $adminIds = DB::table('role_user')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->where('roles.slug', 'admin')
            ->pluck('role_user.user_id')
            ->all();

        $users = DB::table('users')->whereNotNull('modules')->get(['id', 'modules', 'hidden_nav_items']);

        foreach ($users as $user) {
            // The old gate only applied to non-admin users with a non-empty module list
            if (in_array($user->id, $adminIds, true)) {
                continue;
            }

            $modules = json_decode($user->modules ?? '[]', true) ?: [];
            if (empty($modules)) {
                continue;
            }

            $hidden = json_decode($user->hidden_nav_items ?? '[]', true) ?: [];
            foreach ($navToModule as $navId => $module) {
                if (! in_array($module, $modules, true)) {
                    $hidden[] = $navId;
                }
            }

            DB::table('users')
                ->where('id', $user->id)
                ->update(['hidden_nav_items' => json_encode(array_values(array_unique($hidden)))]);
        }
    }

    public function down(): void
    {
        // One-way data migration — nothing to restore.
    }
};
