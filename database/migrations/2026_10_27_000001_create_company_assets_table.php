<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Everything the company owns that is not stock: instruments, machines,
     * property, vehicles, laptops, phones, furniture. Kept apart from
     * raw_materials because none of it is consumed or sold — it is counted,
     * located and handed to someone.
     */
    public function up(): void
    {
        if (Schema::hasTable('company_assets')) {
            return;
        }

        Schema::create('company_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('name');
            $table->string('category');
            // Serial number, asset tag, IMEI, chassis number — whatever
            // identifies this particular item.
            $table->string('code')->nullable();

            $table->decimal('quantity', 12, 2)->default(1);
            $table->string('unit', 20)->default('pcs');

            $table->string('location')->nullable();
            $table->string('assigned_to')->nullable();
            $table->string('status', 20)->default('in_use');

            $table->date('purchase_date')->nullable();
            $table->decimal('purchase_cost', 14, 2)->nullable();
            $table->text('notes')->nullable();

            $table->json('last_changes')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_assets');
    }
};
