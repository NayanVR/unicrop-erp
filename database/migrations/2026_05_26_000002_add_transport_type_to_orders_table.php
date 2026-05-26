<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'transport_type')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('transport_type')->default('transport')->after('transport_name');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('transport_type');
        });
    }
};
