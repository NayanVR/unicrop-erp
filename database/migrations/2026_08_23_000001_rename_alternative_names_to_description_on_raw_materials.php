<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('raw_materials', 'alternative_names') || Schema::hasColumn('raw_materials', 'description')) {
            return;
        }

        Schema::table('raw_materials', function (Blueprint $table) {
            $table->renameColumn('alternative_names', 'description');
        });

        Schema::table('raw_materials', function (Blueprint $table) {
            $table->text('description')->nullable()->comment('Free-form description of the material')->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('raw_materials', 'description') || Schema::hasColumn('raw_materials', 'alternative_names')) {
            return;
        }

        Schema::table('raw_materials', function (Blueprint $table) {
            $table->renameColumn('description', 'alternative_names');
        });

        Schema::table('raw_materials', function (Blueprint $table) {
            $table->string('alternative_names', 500)->nullable()
                ->comment('Comma separated alternate/technical names, e.g. "emamectine 1.9 ec"')->change();
        });
    }
};
