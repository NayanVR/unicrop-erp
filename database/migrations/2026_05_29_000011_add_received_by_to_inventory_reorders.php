<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_reorders', function (Blueprint $table) {
            if (! Schema::hasColumn('inventory_reorders', 'received_by')) {
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete()->after('received_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory_reorders', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\User::class, 'received_by');
            $table->dropColumn('received_by');
        });
    }
};
