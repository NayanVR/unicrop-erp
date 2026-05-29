<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_purchase_bill_items')) {
            return;
        }

        Schema::create('inventory_purchase_bill_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_purchase_bill_id')->constrained()->cascadeOnDelete();
            $table->foreignId('raw_material_id')->nullable()->constrained()->nullOnDelete();
            $table->string('material_name');
            $table->string('sku')->nullable();
            $table->string('category')->nullable();
            $table->string('hsn')->nullable();
            $table->decimal('qty', 14, 3);
            $table->string('unit');
            $table->decimal('rate', 12, 2)->default(0);
            $table->decimal('gst', 5, 2)->default(0);
            $table->decimal('amount', 14, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_purchase_bill_items');
    }
};
