<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A typed-in rate goes stale the moment someone changes the product's
     * selling rate in inventory. Point a packing at its product instead and
     * the printed list always carries the live rate; the typed rate stays as
     * the fallback for packings that have no product of their own.
     *
     * The section a product prints under now comes from its category and
     * group in inventory, so `section` is only an override and may be empty.
     */
    public function up(): void
    {
        if (Schema::hasTable('price_list_packings') && ! Schema::hasColumn('price_list_packings', 'raw_material_id')) {
            Schema::table('price_list_packings', function (Blueprint $table) {
                $table->foreignId('raw_material_id')->nullable()->after('price_list_item_id')
                    ->constrained()->nullOnDelete();
            });
        }

        if (Schema::hasTable('price_list_items')) {
            Schema::table('price_list_items', function (Blueprint $table) {
                $table->string('section')->nullable()->default(null)->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('price_list_packings') && Schema::hasColumn('price_list_packings', 'raw_material_id')) {
            Schema::table('price_list_packings', function (Blueprint $table) {
                $table->dropConstrainedForeignId('raw_material_id');
            });
        }
    }
};
