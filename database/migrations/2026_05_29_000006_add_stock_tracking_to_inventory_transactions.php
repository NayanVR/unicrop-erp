<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('inventory_transactions', 'previous_stock')) {
                $table->decimal('previous_stock', 14, 3)->nullable()->after('qty');
            }
            if (! Schema::hasColumn('inventory_transactions', 'new_stock')) {
                $table->decimal('new_stock', 14, 3)->nullable()->after('previous_stock');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $columns = [];
            foreach (['previous_stock', 'new_stock'] as $col) {
                if (Schema::hasColumn('inventory_transactions', $col)) {
                    $columns[] = $col;
                }
            }
            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
