<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('product_rates', 'company_id')) {
            return;
        }

        Schema::table('product_rates', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_rates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
        });
    }
};
