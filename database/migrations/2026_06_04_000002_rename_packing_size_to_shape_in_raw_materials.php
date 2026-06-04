<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            if (Schema::hasColumn('raw_materials', 'packing_size') && ! Schema::hasColumn('raw_materials', 'shape')) {
                $table->renameColumn('packing_size', 'shape');
            }
        });
    }

    public function down(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            if (Schema::hasColumn('raw_materials', 'shape') && ! Schema::hasColumn('raw_materials', 'packing_size')) {
                $table->renameColumn('shape', 'packing_size');
            }
        });
    }
};
