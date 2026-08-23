<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A material is one physical product shared by the group, but each company
     * may know it by its own name (e.g. "19:19:19" vs "NPK 19-19-19"). This
     * table holds that per-company name; raw_materials.name stays the default
     * used whenever a company has no name of its own for the material.
     */
    public function up(): void
    {
        if (Schema::hasTable('raw_material_names')) {
            return;
        }

        Schema::create('raw_material_names', function (Blueprint $table) {
            $table->id();
            $table->foreignId('raw_material_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();

            $table->unique(['raw_material_id', 'company_id']);
            $table->unique(['company_id', 'name']);
        });

        // Every existing material already belongs to a company and carries the
        // name that company uses, so seed that pairing as its first entry.
        DB::table('raw_materials')
            ->whereNotNull('company_id')
            ->orderBy('id')
            ->chunkById(500, function ($materials) {
                $now = now();

                DB::table('raw_material_names')->insertOrIgnore(
                    $materials->map(fn ($m) => [
                        'raw_material_id' => $m->id,
                        'company_id'      => $m->company_id,
                        'name'            => $m->name,
                        'created_at'      => $now,
                        'updated_at'      => $now,
                    ])->all()
                );
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('raw_material_names');
    }
};
