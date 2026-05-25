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
        if (Schema::hasTable('raw_materials')) {
            return;
        }

        Schema::create('raw_materials', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('unit')->default('kg');
            $table->string('category')->nullable();
            $table->decimal('stock_qty', 14, 3)->default(0);
            $table->decimal('min_stock', 14, 3)->default(0);
            $table->decimal('cost_per_unit', 12, 2)->default(0);
            $table->string('supplier')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('raw_materials');
    }
};
