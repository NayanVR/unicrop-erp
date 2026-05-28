<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            // Drop whichever old unique exists (name varies depending on when the table was created)
            $indexes = DB::select("SHOW INDEX FROM product_rates WHERE Key_name LIKE '%our_brand%' AND Non_unique = 0");
            $dropped = [];
            foreach ($indexes as $idx) {
                if (!in_array($idx->Key_name, $dropped)) {
                    $dropped[] = $idx->Key_name;
                    $table->dropIndex($idx->Key_name);
                }
            }

            $table->unique(['party_id', 'our_brand', 'party_brand', 'packing_size'], 'product_rates_multi_brand_unique');
        });
    }

    public function down(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            try {
                $table->dropUnique('product_rates_multi_brand_unique');
            } catch (\Throwable) {
                // already gone
            }
            $table->unique(['party_id', 'our_brand', 'packing_size']);
        });
    }
};
