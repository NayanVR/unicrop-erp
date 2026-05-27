<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('urgent_approved')->nullable()->after('priority');
            $table->foreignId('urgent_approved_by')->nullable()->constrained('users')->nullOnDelete()->after('urgent_approved');
            $table->timestamp('urgent_approved_at')->nullable()->after('urgent_approved_by');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('urgent_approved_by');
            $table->dropColumn(['urgent_approved', 'urgent_approved_at']);
        });
    }
};
