<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_filling_configs', function (Blueprint $table) {
            $table->id();
            $table->string('our_brand');
            $table->string('packing_size')->nullable(); // null = applies to all sizes of this brand
            $table->foreignId('fill_material_id')->nullable()->constrained('raw_materials')->nullOnDelete();
            $table->foreignId('bottle_id')->nullable()->constrained('raw_materials')->nullOnDelete();
            $table->foreignId('label_id')->nullable()->constrained('raw_materials')->nullOnDelete();
            $table->foreignId('outer_box_id')->nullable()->constrained('raw_materials')->nullOnDelete();
            $table->foreignId('printed_box_id')->nullable()->constrained('raw_materials')->nullOnDelete();
            $table->unsignedSmallInteger('carton_size')->default(12); // bottles per outer box
            $table->timestamps();

            $table->unique(['our_brand', 'packing_size']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_filling_configs');
    }
};
