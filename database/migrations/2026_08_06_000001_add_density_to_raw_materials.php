<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            $table->decimal('density', 8, 4)->nullable()->after('unit')
                ->comment('kg per litre (e.g. 0.9 = 1L weighs 900gm), used for weight<->volume conversion in BOMs');
        });
    }

    public function down(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            $table->dropColumn('density');
        });
    }
};
