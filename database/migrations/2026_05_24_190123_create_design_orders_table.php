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
        if (Schema::hasTable('design_orders')) {
            return;
        }

        Schema::create('design_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('party_brand');
            $table->string('product_name');
            $table->string('packing_size')->nullable();
            $table->string('label_dimensions')->nullable();
            $table->text('instructions')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['accepted', 'design-ready', 'approved-party', 'sent-print', 'completed', 'received-factory'])->default('accepted');
            $table->json('stage_log')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('design_orders');
    }
};
