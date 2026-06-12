<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('packing_sizes', function (Blueprint $table) {
            $table->string('pack_unit', 20)->nullable()->after('pieces_per_box');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('packing_sizes', function (Blueprint $table) {
            $table->dropColumn('pack_unit');
        });
    }
};
