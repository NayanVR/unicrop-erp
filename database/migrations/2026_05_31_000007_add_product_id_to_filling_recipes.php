<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('filling_recipes', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('filling_recipes', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Product::class);
            $table->dropColumn('product_id');
        });
    }
};
