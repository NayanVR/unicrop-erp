<?php

namespace Database\Seeders;

use App\Models\BomRecipe;
use Illuminate\Database\Seeder;

class BomSeeder extends Seeder
{
    public function run(): void
    {
        $recipes = [
            [
                'id'         => 'BOM-001',
                'name'       => 'Humic Acid 12% Liquid',
                'yield_qty'  => 100,
                'yield_unit' => 'ltr',
                'notes'      => '100 litre batch of Humic Acid 12% liquid formulation. Ensure KOH is added slowly while stirring.',
                'created_by' => 'System',
                'ingredients' => [
                    ['invId' => null, 'name' => 'Humic Acid Powder',      'qty' => 15, 'unit' => 'kg',  'cost' => 85.00],
                    ['invId' => null, 'name' => 'KOH (Potassium Hydroxide)', 'qty' => 4, 'unit' => 'kg', 'cost' => 120.00],
                    ['invId' => null, 'name' => 'Water',                   'qty' => 81, 'unit' => 'ltr', 'cost' => 0.50],
                ],
            ],
            [
                'id'         => 'BOM-002',
                'name'       => 'Zinc Sulphate 21% Powder',
                'yield_qty'  => 50,
                'yield_unit' => 'kg',
                'notes'      => '50 kg batch of Zinc Sulphate 21% powder. Blend thoroughly before packing.',
                'created_by' => 'System',
                'ingredients' => [
                    ['invId' => null, 'name' => 'Zinc Sulphate Heptahydrate', 'qty' => 40, 'unit' => 'kg', 'cost' => 95.00],
                    ['invId' => null, 'name' => 'Zinc Oxide',                 'qty' => 8,  'unit' => 'kg', 'cost' => 110.00],
                    ['invId' => null, 'name' => 'Kaolin (Filler)',            'qty' => 2,  'unit' => 'kg', 'cost' => 15.00],
                ],
            ],
            [
                'id'         => 'BOM-003',
                'name'       => 'Chelated Micronutrient Mix',
                'yield_qty'  => 100,
                'yield_unit' => 'ltr',
                'notes'      => '100 litre batch of Chelated Micronutrient Mix (Zn, Mn, Fe, Cu). Mix EDTA chelates in sequence.',
                'created_by' => 'System',
                'ingredients' => [
                    ['invId' => null, 'name' => 'EDTA Zinc',      'qty' => 5,  'unit' => 'kg',  'cost' => 250.00],
                    ['invId' => null, 'name' => 'EDTA Manganese', 'qty' => 3,  'unit' => 'kg',  'cost' => 280.00],
                    ['invId' => null, 'name' => 'EDTA Iron',      'qty' => 2,  'unit' => 'kg',  'cost' => 320.00],
                    ['invId' => null, 'name' => 'EDTA Copper',    'qty' => 1,  'unit' => 'kg',  'cost' => 450.00],
                    ['invId' => null, 'name' => 'Water',          'qty' => 89, 'unit' => 'ltr', 'cost' => 0.50],
                ],
            ],
        ];

        foreach ($recipes as $data) {
            BomRecipe::updateOrCreate(['id' => $data['id']], $data);
        }

        $this->command->info('BOM Seeder: 3 sample recipes created.');
    }
}
