<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One company often sells the same material under several names, so the
     * one-name-per-company rule has to go. `position` keeps the rows ordered:
     * 0 is the company's main name (the one shown everywhere a single name is
     * needed) and the rest are the alternatives sales may order by.
     */
    public function up(): void
    {
        if (! Schema::hasTable('raw_material_names')) {
            return;
        }

        if (! Schema::hasColumn('raw_material_names', 'position')) {
            Schema::table('raw_material_names', function (Blueprint $table) {
                $table->unsignedSmallInteger('position')->default(0)->after('name');
            });
        }

        Schema::table('raw_material_names', function (Blueprint $table) {
            // Until now every (material, company) pair had exactly one row, so
            // the existing rows are all position 0 already.
            $table->dropUnique(['raw_material_id', 'company_id']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('raw_material_names')) {
            return;
        }

        Schema::table('raw_material_names', function (Blueprint $table) {
            $table->unique(['raw_material_id', 'company_id']);
        });

        if (Schema::hasColumn('raw_material_names', 'position')) {
            Schema::table('raw_material_names', function (Blueprint $table) {
                $table->dropColumn('position');
            });
        }
    }
};
