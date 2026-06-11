<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedSmallInteger('urgent_days')->nullable()->after('urgent_approved_at');
            $table->string('urgent_reject_reason', 500)->nullable()->after('urgent_days');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['urgent_days', 'urgent_reject_reason']);
        });
    }
};
