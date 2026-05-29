<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            if (! Schema::hasColumn('raw_materials', 'sku')) {
                $table->string('sku')->nullable()->after('name');
            }
            if (! Schema::hasColumn('raw_materials', 'hsn')) {
                $table->string('hsn')->nullable()->after('sku');
            }
            if (! Schema::hasColumn('raw_materials', 'gst')) {
                $table->decimal('gst', 5, 2)->default(0)->after('hsn');
            }
            if (! Schema::hasColumn('raw_materials', 'reorder_level')) {
                $table->decimal('reorder_level', 14, 3)->default(0)->after('min_stock');
            }
            if (! Schema::hasColumn('raw_materials', 'selling_rate')) {
                $table->decimal('selling_rate', 12, 2)->default(0)->after('cost_per_unit');
            }
        });
    }

    public function down(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            $columns = [];
            foreach (['sku', 'hsn', 'gst', 'reorder_level', 'selling_rate'] as $col) {
                if (Schema::hasColumn('raw_materials', $col)) {
                    $columns[] = $col;
                }
            }
            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
