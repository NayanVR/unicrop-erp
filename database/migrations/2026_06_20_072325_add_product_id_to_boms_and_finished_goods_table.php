<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('boms', 'product_id')) {
            Schema::table('boms', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->after('id')->constrained()->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('finished_goods', 'product_id')) {
            Schema::table('finished_goods', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->after('id')->constrained()->nullOnDelete();
            });
        }
    }

    public function down(): void
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
    }
};
