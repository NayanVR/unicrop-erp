<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('raw_materials', 'company_id')) {
            return;
        }

        Schema::table('raw_materials', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('raw_materials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
        });
    }
};
