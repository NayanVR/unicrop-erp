<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 'processing' was merged into the new 'accepted' stage.
        // 'pending' is kept as-is: it now means "new / awaiting acceptance".
        // (status column is NOT NULL, so we never write null here.)
        DB::table('order_items')->where('status', 'processing')->update(['status' => 'accepted']);
    }

    public function down(): void
    {
        DB::table('order_items')->where('status', 'accepted')->update(['status' => 'processing']);
    }
};
