<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bom_recipes', function (Blueprint $table) {
            $table->foreignId('output_raw_material_id')->nullable()->constrained('raw_materials')->nullOnDelete()->after('yield_unit');
        });
    }

    public function down(): void
    {
        Schema::table('bom_recipes', function (Blueprint $table) {
            $table->dropForeign(['output_raw_material_id']);
            $table->dropColumn('output_raw_material_id');
        });
    }
};
