<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The printed price list is its own document: one row per product, with a
     * stack of packings inside it, each carrying its MRP, rate and how many
     * go in a box. None of that lives anywhere else — selling_rate is a single
     * number per material, MRPs sit on product photos and box counts in
     * filling configs — so the list keeps its own rows and links back to the
     * material only to inherit who is allowed to see it.
     */
    public function up(): void
    {
        if (! Schema::hasTable('price_list_items')) {
            Schema::create('price_list_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->cascadeOnDelete();
                $table->foreignId('raw_material_id')->nullable()->constrained()->nullOnDelete();

                $table->string('name');
                $table->string('description')->nullable();
                $table->string('section')->default('Bio Stimulant Product Price List');
                $table->decimal('gst_percent', 5, 2)->default(18);
                // The bulk table drops the MRP and per-box columns entirely.
                $table->boolean('is_bulk')->default(false);
                $table->boolean('is_active')->default(true);
                $table->unsignedSmallInteger('sort_order')->default(0);

                $table->timestamps();
                $table->index(['company_id', 'section']);
            });
        }

        if (! Schema::hasTable('price_list_packings')) {
            Schema::create('price_list_packings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('price_list_item_id')->constrained()->cascadeOnDelete();

                $table->string('packing');
                $table->decimal('mrp', 12, 2)->nullable();
                $table->decimal('rate', 12, 2);
                $table->unsignedInteger('qty_per_box')->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);

                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('price_list_packings');
        Schema::dropIfExists('price_list_items');
    }
};
