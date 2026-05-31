<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('unit_transfers', function (Blueprint $table) {
            $table->string('order_number', 50)->nullable()->after('created_by');
            $table->string('received_by', 100)->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('unit_transfers', function (Blueprint $table) {
            $table->dropColumn(['order_number', 'received_by']);
        });
    }
};
