<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Only MySQL/MariaDB enforce ENUM; SQLite stores it as TEXT so no change needed.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE finished_goods MODIFY COLUMN source ENUM('production', 'manual', 'filling') NOT NULL DEFAULT 'manual'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE finished_goods MODIFY COLUMN source ENUM('production', 'manual') NOT NULL DEFAULT 'manual'");
        }
    }
};
