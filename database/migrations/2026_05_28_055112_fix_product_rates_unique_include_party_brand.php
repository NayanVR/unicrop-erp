<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            $table->dropUnique(['party_id', 'our_brand', 'packing_size']);
            $table->unique(['party_id', 'our_brand', 'party_brand', 'packing_size']);
        });
    }

    public function down(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            $table->dropUnique(['party_id', 'our_brand', 'party_brand', 'packing_size']);
            $table->unique(['party_id', 'our_brand', 'packing_size']);
        });
    }
};
