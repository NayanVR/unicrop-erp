<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parties', function (Blueprint $table) {
            $table->enum('default_transport_type', ['transport', 'courier'])->nullable()->after('notes');
            $table->foreignId('default_transport_id')->nullable()->constrained('transports')->nullOnDelete()->after('default_transport_type');
        });
    }

    public function down(): void
    {
        Schema::table('parties', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_transport_id');
            $table->dropColumn('default_transport_type');
        });
    }
};
