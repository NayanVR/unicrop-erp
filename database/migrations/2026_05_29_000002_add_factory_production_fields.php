<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->text('factory_notes')->nullable()->after('notes');
        });

        Schema::table('order_items', function (Blueprint $table) {
            // Per-box fill tracking used by the factory production view.
            $table->unsignedInteger('box_size')->nullable()->after('packing_size');
            $table->unsignedInteger('filled_qty')->nullable()->after('box_size');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('factory_notes');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['box_size', 'filled_qty']);
        });
    }
};
