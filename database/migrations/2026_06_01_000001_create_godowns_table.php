<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('godowns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('godown_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('godown_id')->constrained()->cascadeOnDelete();
            $table->foreignId('raw_material_id')->constrained()->cascadeOnDelete();
            $table->decimal('stock_qty', 14, 3)->default(0);
            $table->timestamps();
            $table->unique(['godown_id', 'raw_material_id']);
        });

        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->foreignId('godown_id')->nullable()->constrained('godowns')->nullOnDelete()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->dropForeign(['godown_id']);
            $table->dropColumn('godown_id');
        });
        Schema::dropIfExists('godown_stocks');
        Schema::dropIfExists('godowns');
    }
};
