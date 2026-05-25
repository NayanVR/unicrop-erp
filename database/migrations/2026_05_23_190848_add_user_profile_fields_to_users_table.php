<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('password');
            $table->text('notes')->nullable()->after('phone');
            $table->boolean('is_active')->default(true)->after('notes');
            $table->boolean('cost_access')->default(false)->after('is_active');
            $table->json('modules')->nullable()->after('cost_access');
            $table->json('permissions')->nullable()->after('modules');
            $table->json('company_access')->nullable()->after('permissions');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'notes',
                'is_active',
                'cost_access',
                'modules',
                'permissions',
                'company_access',
            ]);
        });
    }
};
