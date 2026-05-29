<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            if (! Schema::hasColumn('raw_materials', 'dim_l')) {
                $table->decimal('dim_l', 10, 2)->nullable()->after('selling_rate');
            }
            if (! Schema::hasColumn('raw_materials', 'dim_w')) {
                $table->decimal('dim_w', 10, 2)->nullable()->after('dim_l');
            }
            if (! Schema::hasColumn('raw_materials', 'dim_h')) {
                $table->decimal('dim_h', 10, 2)->nullable()->after('dim_w');
            }
        });
    }

    public function down(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            $table->dropColumn(['dim_l', 'dim_w', 'dim_h']);
        });
    }
};
