<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('filling_recipes')) {
            Schema::create('filling_recipes', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('packing_size')->nullable();
                $table->decimal('fill_quantity', 14, 2)->default(1); // default pcs to fill
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('filling_recipe_items')) {
            Schema::create('filling_recipe_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('filling_recipe_id')->constrained()->cascadeOnDelete();
                $table->foreignId('raw_material_id')->constrained()->cascadeOnDelete();
                $table->decimal('qty_per_unit', 14, 3); // material qty per 1 pc filled
                $table->string('unit')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // Link existing filling_runs history table to a recipe (optional)
        if (Schema::hasTable('filling_runs') && ! Schema::hasColumn('filling_runs', 'filling_recipe_id')) {
            Schema::table('filling_runs', function (Blueprint $table) {
                $table->unsignedBigInteger('filling_recipe_id')->nullable()->after('id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('filling_runs') && Schema::hasColumn('filling_runs', 'filling_recipe_id')) {
            Schema::table('filling_runs', function (Blueprint $table) {
                $table->dropColumn('filling_recipe_id');
            });
        }
        Schema::dropIfExists('filling_recipe_items');
        Schema::dropIfExists('filling_recipes');
    }
};
