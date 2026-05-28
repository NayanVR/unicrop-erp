<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $allUniques = collect(DB::select(
            "SHOW INDEX FROM product_rates WHERE Non_unique = 0"
        ))->pluck('Key_name')->unique()->values()->all();

        Schema::table('product_rates', function (Blueprint $table) use ($allUniques) {
            // Drop any existing unique index that covers our_brand
            // (handles both old naming conventions and partial-run remnants)
            foreach ($allUniques as $name) {
                if ($name !== 'product_rates_multi_brand_unique' && str_contains($name, 'our_brand')) {
                    $table->dropIndex($name);
                }
            }

            // Only create if not already present (idempotent on re-run)
            if (!in_array('product_rates_multi_brand_unique', $allUniques)) {
                $table->unique(
                    ['party_id', 'our_brand', 'party_brand', 'packing_size'],
                    'product_rates_multi_brand_unique'
                );
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            $allUniques = collect(DB::select(
                "SHOW INDEX FROM product_rates WHERE Non_unique = 0"
            ))->pluck('Key_name')->unique()->values()->all();

            if (in_array('product_rates_multi_brand_unique', $allUniques)) {
                $table->dropUnique('product_rates_multi_brand_unique');
            }
            if (!in_array('product_rates_party_id_our_brand_packing_size_unique', $allUniques)) {
                $table->unique(['party_id', 'our_brand', 'packing_size']);
            }
        });
    }
};
