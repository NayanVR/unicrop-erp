<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete()->after('order_number');
            $table->string('gst_no', 20)->nullable()->after('customer_name');
            $table->string('pan_no', 20)->nullable()->after('gst_no');
            $table->string('aadhaar_no', 20)->nullable()->after('pan_no');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['party_id']);
            $table->dropColumn(['party_id', 'gst_no', 'pan_no', 'aadhaar_no']);
        });
    }
};
