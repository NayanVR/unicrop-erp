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

        $indexes = collect(Schema::getIndexes('raw_material_names'));

        // MySQL leans on the unique index to satisfy the raw_material_id
        // foreign key, and refuses to drop an index a constraint still needs.
        // Give the column an index of its own first so the constraint has
        // somewhere else to look.
        $hasOwnIndex = $indexes->contains(fn ($i) => ($i['columns'] ?? []) === ['raw_material_id']);

        if (! $hasOwnIndex) {
            Schema::table('raw_material_names', function (Blueprint $table) {
                $table->index('raw_material_id', 'raw_material_names_raw_material_id_index');
            });
        }

        // Until now every (material, company) pair had exactly one row, so the
        // existing rows are all position 0 already. The index is only dropped
        // if it is actually there — a database built before this table was a
        // migration may not carry it, and a failed drop would stop the deploy.
        $indexes
            ->filter(function ($index) {
                $columns = $index['columns'] ?? [];
                sort($columns);

                return ($index['unique'] ?? false) && $columns === ['company_id', 'raw_material_id'];
            })
            ->each(fn ($index) => Schema::table('raw_material_names', function (Blueprint $table) use ($index) {
                $table->dropUnique($index['name']);
            }));
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
