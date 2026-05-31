<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('filling_recipes', function (Blueprint $table) {
            $table->foreignId('output_raw_material_id')->nullable()->after('id')->constrained('raw_materials')->nullOnDelete();
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });
    }

    public function down(): void
    {
        Schema::table('filling_recipes', function (Blueprint $table) {
            $table->dropForeign(['output_raw_material_id']);
            $table->dropColumn('output_raw_material_id');
            $table->foreignId('product_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });
    }
};
