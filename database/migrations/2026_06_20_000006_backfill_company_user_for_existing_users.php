<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::table('company_user')->exists()) {
            return;
        }

        $company = DB::table('companies')->orderBy('id')->first();

        if (! $company) {
            return;
        }

        $policiesBySlug = DB::table('policies')
            ->where('is_system', true)
            ->get(['id', 'slug'])
            ->pluck('id', 'slug');

        $now = now();

        $users = DB::table('users')->pluck('id');

        foreach ($users as $userId) {
            $firstRole = DB::table('role_user')
                ->join('roles', 'roles.id', '=', 'role_user.role_id')
                ->where('role_user.user_id', $userId)
                ->orderBy('role_user.id')
                ->first(['roles.id as role_id', 'roles.slug as role_slug']);

            DB::table('company_user')->insert([
                'company_id' => $company->id,
                'user_id' => $userId,
                'policy_id' => $firstRole ? ($policiesBySlug[$firstRole->role_slug] ?? null) : null,
                'role_id' => $firstRole?->role_id,
                'is_default' => true,
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
        DB::table('company_user')->truncate();
    }
};
