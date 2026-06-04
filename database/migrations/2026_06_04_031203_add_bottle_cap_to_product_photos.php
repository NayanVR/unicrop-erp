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
        Schema::table('product_photos', function (Blueprint $table) {
            $table->string('bottle_jar', 150)->nullable()->after('sizes');
            $table->string('cap_color', 100)->nullable()->after('bottle_jar');
        });
    }

    public function down(): void
    {
        Schema::table('product_photos', function (Blueprint $table) {
            $table->dropColumn(['bottle_jar', 'cap_color']);
        });
    }
};
