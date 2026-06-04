<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('filling_runs', function (Blueprint $table) {
            if (! Schema::hasColumn('filling_runs', 'bottle_shape')) {
                $table->string('bottle_shape', 50)->nullable()->after('packing_size');
            }
        });
    }

    public function down(): void
    {
        Schema::table('filling_runs', function (Blueprint $table) {
            if (Schema::hasColumn('filling_runs', 'bottle_shape')) {
                $table->dropColumn('bottle_shape');
            }
        });
    }
};
