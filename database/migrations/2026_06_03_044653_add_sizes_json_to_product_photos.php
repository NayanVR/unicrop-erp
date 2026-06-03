<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_photos', function (Blueprint $table) {
            $table->json('sizes')->nullable()->after('mrp');
        });

        // Migrate existing rows: pack their packing_size + mrp into the sizes JSON
        DB::table('product_photos')->whereNull('sizes')->chunkById(200, function ($rows) {
            foreach ($rows as $row) {
                DB::table('product_photos')->where('id', $row->id)->update([
                    'sizes' => json_encode([[
                        'packing_size' => $row->packing_size ?? '',
                        'mrp'          => $row->mrp ?? '',
                    ]]),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_photos', function (Blueprint $table) {
            $table->dropColumn('sizes');
        });
    }
};
