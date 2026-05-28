<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add 'pending' to the status enum so new design orders start at pending acceptance
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE design_orders MODIFY COLUMN status
                 ENUM('pending','accepted','design-ready','approved-party','sent-print','completed','received-factory')
                 NOT NULL DEFAULT 'pending'"
            );
        }

        Schema::table('design_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('design_orders', 'order_qty')) {
                $table->unsignedInteger('order_qty')->nullable()->after('order_id');
            }
            if (! Schema::hasColumn('design_orders', 'pcs_to_print')) {
                $table->unsignedInteger('pcs_to_print')->nullable()->after('order_qty');
            }
            if (! Schema::hasColumn('design_orders', 'labels_received')) {
                $table->unsignedInteger('labels_received')->nullable()->after('pcs_to_print');
            }
        });
    }

    public function down(): void
    {
        Schema::table('design_orders', function (Blueprint $table) {
            $cols = array_filter(
                ['order_qty', 'pcs_to_print', 'labels_received'],
                fn ($c) => Schema::hasColumn('design_orders', $c)
            );
            if ($cols) {
                $table->dropColumn(array_values($cols));
            }
        });
    }
};
