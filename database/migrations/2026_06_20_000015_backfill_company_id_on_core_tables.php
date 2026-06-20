<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tables that gained a nullable company_id column in the preceding
     * migrations and need every existing row pointed at the default company.
     *
     * @var array<int, string>
     */
    private array $tables = [
        'parties',
        'godowns',
        'raw_materials',
        'boms',
        'finished_goods',
        'product_rates',
        'orders',
        'inventory_transactions',
    ];

    public function up(): void
    {
        $defaultCompanyId = DB::table('companies')->orderBy('id')->value('id');

        if (! $defaultCompanyId) {
            return;
        }

        foreach ($this->tables as $table) {
            DB::table($table)->whereNull('company_id')->update(['company_id' => $defaultCompanyId]);
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            DB::table($table)->update(['company_id' => null]);
        }
    }
};
