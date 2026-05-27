<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_rates', function (Blueprint $table) {
            $table->id();
            $table->string('our_brand');
            $table->string('party_brand')->nullable();
            $table->string('packing_size', 50);
            $table->decimal('rate', 10, 2)->default(0);
            $table->decimal('gst_percent', 5, 2)->default(18);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['our_brand', 'packing_size']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_rates');
    }
};
