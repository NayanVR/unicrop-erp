<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_photos', function (Blueprint $table) {
            $table->string('mrp', 50)->nullable()->after('packing_size');
        });
    }

    public function down(): void
    {
        Schema::table('product_photos', function (Blueprint $table) {
            $table->dropColumn('mrp');
        });
    }
};
