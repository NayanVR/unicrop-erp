<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // pending items → null (awaiting acceptance)
        DB::table('order_items')->where('status', 'pending')->update(['status' => null]);

        // processing items → accepted (they were already in progress)
        DB::table('order_items')->where('status', 'processing')->update(['status' => 'accepted']);
    }

    public function down(): void
    {
        DB::table('order_items')->whereNull('status')->update(['status' => 'pending']);
        DB::table('order_items')->where('status', 'accepted')->update(['status' => 'processing']);
    }
};
