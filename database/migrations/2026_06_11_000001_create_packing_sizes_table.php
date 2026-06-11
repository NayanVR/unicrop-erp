<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packing_sizes', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            // How many base inventory units (kg / L / pcs) one unit of this
            // packing size consumes from the finished good's stock.
            $table->decimal('multiplier', 10, 3)->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packing_sizes');
    }
};
