<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_pools')) {
            return;
        }

        Schema::create('inventory_pools', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('stock_qty', 14, 3)->default(0);
            $table->string('unit')->default('L');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_pools');
    }
};
