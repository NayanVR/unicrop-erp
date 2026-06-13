<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasColumn('boms', 'product_id')) {
            Schema::table('boms', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_id');
            });
        }

        if (Schema::hasColumn('finished_goods', 'product_id')) {
            Schema::table('finished_goods', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_id');
            });
        }

        Schema::dropIfExists('products');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('hsn_code')->nullable();
            $table->decimal('gst_percent', 5, 2)->default(18.00);
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('boms', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::table('finished_goods', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
        });
    }
};
