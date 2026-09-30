<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records what changed in the most recent edit, so the UI can say more than
 * "updated" — which fields moved, and which ingredients were added, changed
 * or removed.
 */
return new class extends Migration
{
    private const TABLES = ['boms', 'filling_recipes', 'products'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->json('last_changes')->nullable()->after('updated_at');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn('last_changes');
            });
        }
    }
};
