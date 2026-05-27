<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->string('our_brand');
            $table->string('party_brand')->nullable();
            $table->string('packing_size', 100)->nullable();
            $table->string('photo_path');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['party_id', 'party_brand', 'packing_size']);
            $table->index(['our_brand', 'packing_size']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_photos');
    }
};
