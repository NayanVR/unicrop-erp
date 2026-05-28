<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NEW_INDEX = 'product_rates_multi_brand_unique';

    public function up(): void
    {
        // 1. Create the wider unique index FIRST. Its leftmost column is still
        //    party_id, so once it exists MySQL can use it to satisfy the
        //    foreign key on party_id — which lets us drop the old unique index
        //    without hitting "Cannot drop index needed in a foreign key
        //    constraint" (errno 150). Order matters; do not reverse these steps.
        if (! $this->hasIndex(self::NEW_INDEX)) {
            Schema::table('product_rates', function (Blueprint $table) {
                $table->unique(
                    ['party_id', 'our_brand', 'party_brand', 'packing_size'],
                    self::NEW_INDEX
                );
            });
        }

        // 2. Now drop any other unique index that covers our_brand (the old
        //    constraint, or partial-run remnants). Safe to re-run.
        foreach ($this->uniqueIndexesCoveringOurBrand() as $name) {
            Schema::table('product_rates', function (Blueprint $table) use ($name) {
                $table->dropIndex($name);
            });
        }
    }

    public function down(): void
    {
        if (! $this->hasIndex('product_rates_party_id_our_brand_packing_size_unique')) {
            Schema::table('product_rates', function (Blueprint $table) {
                $table->unique(['party_id', 'our_brand', 'packing_size']);
            });
        }

        if ($this->hasIndex(self::NEW_INDEX)) {
            Schema::table('product_rates', function (Blueprint $table) {
                $table->dropUnique(self::NEW_INDEX);
            });
        }
    }

    private function hasIndex(string $name): bool
    {
        return collect(Schema::getIndexes('product_rates'))
            ->contains(fn ($i) => $i['name'] === $name);
    }

    /** @return list<string> */
    private function uniqueIndexesCoveringOurBrand(): array
    {
        return collect(Schema::getIndexes('product_rates'))
            ->filter(fn ($i) => $i['unique']
                && $i['name'] !== self::NEW_INDEX
                && in_array('our_brand', $i['columns'], true))
            ->pluck('name')
            ->values()
            ->all();
    }
};
