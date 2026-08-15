<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            // Assay / purity of the stock currently held, e.g. 70 = 70% a.i.
            $table->decimal('potency', 6, 3)->nullable()->after('density')
                ->comment('Actual assay %% of technical material, e.g. 70 for 70% a.i.');
        });

        Schema::table('bom_items', function (Blueprint $table) {
            // When set, qty_per_batch is the amount required AT this assay.
            // Actual qty = qty_per_batch * base_potency / material.potency
            $table->decimal('base_potency', 6, 3)->nullable()->after('qty_per_batch')
                ->comment('Assay %% the recipe qty assumes; enables potency-adjusted dosing');
        });
    }

    public function down(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            $table->dropColumn('potency');
        });
        Schema::table('bom_items', function (Blueprint $table) {
            $table->dropColumn('base_potency');
        });
    }
};
