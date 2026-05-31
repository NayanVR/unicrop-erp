<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('filling_runs', function (Blueprint $table) {
            $table->id();
            $table->string('our_brand');
            $table->string('packing_size')->nullable();
            $table->decimal('quantity', 14, 2);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('items')->nullable(); // snapshot of materials deducted
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('filling_runs');
    }
};
