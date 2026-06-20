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
        if (DB::table('companies')->exists()) {
            return;
        }

        DB::table('companies')->insert([
            'name' => 'Default Company',
            'slug' => 'default',
            'is_active' => true,
            'settings' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('companies')->where('slug', 'default')->delete();
    }
};
