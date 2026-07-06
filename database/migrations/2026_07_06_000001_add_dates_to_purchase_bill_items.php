<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_purchase_bill_items', function (Blueprint $table) {
            $table->date('mfg_date')->nullable()->after('amount');
            $table->date('expiry_date')->nullable()->after('mfg_date');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_purchase_bill_items', function (Blueprint $table) {
            $table->dropColumn(['mfg_date', 'expiry_date']);
        });
    }
};
