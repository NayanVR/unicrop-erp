<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            $table->foreignId('party_id')->nullable()->constrained('parties')->cascadeOnDelete()->after('id');

            $table->dropUnique(['our_brand', 'packing_size']);
            $table->unique(['party_id', 'our_brand', 'packing_size']);
        });
    }

    public function down(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            $table->dropForeign(['party_id']);
            $table->dropUnique(['party_id', 'our_brand', 'packing_size']);
            $table->dropColumn('party_id');
            $table->unique(['our_brand', 'packing_size']);
        });
    }
};
