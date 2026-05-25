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
        Schema::create('unit_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_unit');
            $table->string('to_unit');
            $table->enum('item_type', ['raw_material', 'finished_good', 'other'])->default('raw_material');
            $table->string('item_name');
            $table->decimal('quantity', 14, 3);
            $table->string('unit')->default('kg');
            $table->text('notes')->nullable();
            $table->enum('status', ['loading', 'in-transit', 'unloaded', 'cancelled'])->default('loading');
            $table->timestamp('transferred_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('unit_transfers');
    }
};
