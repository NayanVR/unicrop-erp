<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_payments', function (Blueprint $table) {
            $table->boolean('tally_entry_done')->default(false)->after('reference_number');
            $table->timestamp('tally_entry_done_at')->nullable()->after('tally_entry_done');
            $table->foreignId('tally_entry_done_by')->nullable()->after('tally_entry_done_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_payments', function (Blueprint $table) {
            $table->dropColumn(['tally_entry_done', 'tally_entry_done_at', 'tally_entry_done_by']);
        });
    }
};
