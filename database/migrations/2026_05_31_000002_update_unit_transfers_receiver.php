<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('unit_transfers', function (Blueprint $table) {
            // Drop the plain-text received_by added previously
            $table->dropColumn('received_by');

            // Add proper user FK + timestamp
            $table->foreignId('received_by_user_id')->nullable()->after('notes')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable()->after('received_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('unit_transfers', function (Blueprint $table) {
            $table->dropForeign(['received_by_user_id']);
            $table->dropColumn(['received_by_user_id', 'received_at']);
            $table->string('received_by', 100)->nullable();
        });
    }
};
