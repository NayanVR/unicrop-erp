<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('design_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('design_orders', 'skip_party_approval')) {
                $table->boolean('skip_party_approval')->default(false)->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('design_orders', function (Blueprint $table) {
            $table->dropColumn('skip_party_approval');
        });
    }
};
