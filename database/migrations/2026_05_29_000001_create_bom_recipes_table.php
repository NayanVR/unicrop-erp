<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bom_recipes')) {
            return;
        }

        Schema::create('bom_recipes', function (Blueprint $table) {
            $table->string('id')->primary();          // BOM-001, BOM-002
            $table->string('name');
            $table->decimal('yield_qty', 10, 3);      // e.g. 100
            $table->string('yield_unit');             // ltr / kg / pcs / gm
            $table->json('ingredients');              // [{invId, name, qty, unit, cost}]
            $table->text('notes')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bom_recipes');
    }
};
