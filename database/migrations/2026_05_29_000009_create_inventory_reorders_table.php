<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_reorders')) {
            return;
        }

        Schema::create('inventory_reorders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('raw_material_id')->constrained()->cascadeOnDelete();
            $table->decimal('qty_ordered', 14, 3);
            $table->string('unit');
            $table->string('supplier')->nullable();
            $table->date('order_date');
            $table->date('expected_delivery')->nullable();
            $table->string('transport_name')->nullable();
            $table->string('lr_number')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'received'])->default('pending');
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_reorders');
    }
};
