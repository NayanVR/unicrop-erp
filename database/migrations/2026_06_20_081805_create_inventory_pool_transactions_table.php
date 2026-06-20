<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_pool_transactions')) {
            return;
        }

        Schema::create('inventory_pool_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_pool_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->decimal('qty', 14, 3);
            $table->decimal('previous_stock', 14, 3);
            $table->decimal('new_stock', 14, 3);
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_pool_transactions');
    }
};
