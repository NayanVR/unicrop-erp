<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_purchase_bills')) {
            return;
        }

        Schema::create('inventory_purchase_bills', function (Blueprint $table) {
            $table->id();
            $table->string('vendor_name');
            $table->string('bill_number')->nullable();
            $table->date('bill_date')->nullable();
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->string('bill_file')->nullable();
            $table->string('bill_name')->nullable();
            $table->boolean('add_to_stock')->default(false);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_purchase_bills');
    }
};
