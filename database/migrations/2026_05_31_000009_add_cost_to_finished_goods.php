<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finished_goods', function (Blueprint $table) {
            $table->decimal('cost_per_unit', 14, 4)->nullable()->after('source');
            $table->decimal('total_cost', 14, 4)->nullable()->after('cost_per_unit');
        });
    }

    public function down(): void
    {
        Schema::table('finished_goods', function (Blueprint $table) {
            $table->dropColumn(['cost_per_unit', 'total_cost']);
        });
    }
};
