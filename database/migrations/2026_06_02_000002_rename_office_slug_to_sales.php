<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Rename the 'office' role slug to 'sales'
        DB::table('roles')->where('slug', 'office')->update([
            'slug' => 'sales',
            'name' => 'Sales',
        ]);
    }

    public function down(): void {}
};
