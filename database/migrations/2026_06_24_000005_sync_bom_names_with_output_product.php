<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill: make every BOM that is linked to an output product use that
     * product's name, so the BOM name always matches its output product.
     */
    public function up(): void
    {
        DB::table('boms')
            ->whereNotNull('output_raw_material_id')
            ->orderBy('id')
            ->each(function ($bom) {
                $name = DB::table('raw_materials')
                    ->where('id', $bom->output_raw_material_id)
                    ->value('name');

                if ($name !== null && $name !== '' && $name !== $bom->name) {
                    DB::table('boms')->where('id', $bom->id)->update(['name' => $name]);
                }
            });
    }

    public function down(): void
    {
        // No-op: previous custom BOM names are not retained.
    }
};
