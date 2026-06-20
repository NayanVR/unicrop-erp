<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products')) {
            return;
        }

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('raw_material_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('finished_good_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('our_brand')->nullable();
            $table->string('sku')->nullable();
            $table->string('hsn_code')->nullable();
            $table->decimal('gst_percent', 5, 2)->default(18.00);
            $table->string('category')->nullable();
            $table->string('packing_size')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name', 'packing_size']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
