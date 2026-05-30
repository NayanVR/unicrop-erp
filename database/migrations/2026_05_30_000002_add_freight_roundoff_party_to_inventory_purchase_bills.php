<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_purchase_bills', function (Blueprint $table) {
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete()->after('user_id');
            $table->decimal('freight_charges', 14, 2)->default(0)->after('total_amount');
            $table->decimal('round_off', 14, 2)->default(0)->after('freight_charges');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_purchase_bills', function (Blueprint $table) {
            $table->dropForeign(['party_id']);
            $table->dropColumn(['party_id', 'freight_charges', 'round_off']);
        });
    }
};
