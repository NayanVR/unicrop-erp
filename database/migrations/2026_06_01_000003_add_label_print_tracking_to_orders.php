<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('labels_last_printed_by', 100)->nullable()->after('factory_notes');
            $table->timestamp('labels_last_printed_at')->nullable()->after('labels_last_printed_by');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['labels_last_printed_by', 'labels_last_printed_at']);
        });
    }
};
