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
        Schema::table('filling_runs', function (Blueprint $table) {
            // Charge breakdown applied to this run: array of {label, amount, total}.
            $table->json('charges')->nullable()->after('items');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('filling_runs', function (Blueprint $table) {
            $table->dropColumn('charges');
        });
    }
};
