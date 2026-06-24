<?php

use App\Models\Bom;
use App\Models\Company;
use App\Models\FillingRecipe;
use App\Models\FillingRun;
use App\Models\Policy;
use App\Models\ProductionRun;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;

function chargesAdmin(Company $company): User
{
    $role = Role::firstOrCreate(['slug' => Role::ADMIN], ['name' => 'Admin']);
    $policy = Policy::where('is_system', true)->where('slug', Role::ADMIN)->first();

    $user = User::factory()->create(['is_active' => true]);
    $user->roles()->sync([$role->id]);
    $user->companies()->sync([
        $company->id => ['policy_id' => $policy->id, 'is_default' => true],
    ]);

    return $user;
}

test('bom production run adds per-batch charges to total cost and output cost-per-unit', function () {
    $company = Company::first();
    $admin   = chargesAdmin($company);
    $this->actingAs($admin)->post('/companies/switch', ['company_id' => $company->id]);
    session(['current_company_id' => $company->id]);

    $input  = RawMaterial::create(['name' => 'Input Mat', 'unit' => 'kg', 'stock_qty' => 100, 'cost_per_unit' => 10]);
    $output = RawMaterial::create(['name' => 'Semi Output', 'unit' => 'kg', 'stock_qty' => 0, 'cost_per_unit' => 0]);

    $this->actingAs($admin)->post('/bom', [
        'name'                   => 'Charged BOM',
        'batch_size'             => 1,
        'batch_unit'             => 'kg',
        'output_raw_material_id' => $output->id,
        'items'                  => [
            ['raw_material_id' => $input->id, 'qty_per_batch' => 2, 'unit' => 'kg'],
        ],
        'charges'                => [
            ['label' => 'Man Power', 'amount' => 50],
            ['label' => 'Electricity', 'amount' => 30],
        ],
    ])->assertRedirect()->assertSessionDoesntHaveErrors();

    $bom = Bom::where('name', 'Charged BOM')->first();
    expect($bom->charges)->toHaveCount(2);

    // Run 3 batches: materials = 2*10*3 = 60, charges = (50+30)*3 = 240, total = 300
    $this->actingAs($admin)->post("/bom/{$bom->id}/run", ['batch_count' => 3])
        ->assertRedirect()->assertSessionHas('success');

    $run = ProductionRun::where('bom_id', $bom->id)->latest('id')->first();
    expect((float) $run->total_cost)->toBe(300.0);
    expect($run->charges)->toHaveCount(2);
    expect((float) $run->charges[0]['total'])->toBe(150.0);

    // Output cost-per-unit = total / yield(1*3) = 100
    $output->refresh();
    expect((float) $output->cost_per_unit)->toBe(100.0);
});

test('filling recipe and run include per-piece charges in cost', function () {
    $company = Company::first();
    $admin   = chargesAdmin($company);
    $this->actingAs($admin)->post('/companies/switch', ['company_id' => $company->id]);
    session(['current_company_id' => $company->id]);

    $bottle = RawMaterial::create(['name' => 'Bottle 1L', 'unit' => 'pcs', 'stock_qty' => 1000, 'cost_per_unit' => 5]);
    $output = RawMaterial::create(['name' => 'Filled Brand 1L', 'unit' => 'pcs', 'stock_qty' => 0, 'cost_per_unit' => 0, 'category' => 'Finished Good']);

    $this->actingAs($admin)->post('/filling', [
        'output_raw_material_id' => $output->id,
        'packing_size'           => '1L',
        'fill_quantity'          => 1,
        'items'                  => [
            ['raw_material_id' => $bottle->id, 'qty_per_unit' => 1, 'unit' => 'pcs'],
        ],
        'charges'                => [
            ['label' => 'Labor', 'amount' => 2],
        ],
    ])->assertRedirect()->assertSessionDoesntHaveErrors();

    $recipe = FillingRecipe::where('output_raw_material_id', $output->id)->first();
    expect($recipe->charges)->toHaveCount(1);

    // syncOutputCost: per pc = bottle(5) + charge(2) = 7
    $output->refresh();
    expect((float) $output->cost_per_unit)->toBe(7.0);

    // Run 10 pcs: charges recorded scaled by qty
    $this->actingAs($admin)->post("/filling/{$recipe->id}/run", ['quantity' => 10])
        ->assertRedirect()->assertSessionHas('success');

    $run = FillingRun::where('filling_recipe_id', $recipe->id)->latest('id')->first();
    expect($run->charges)->toHaveCount(1);
    expect((float) $run->charges[0]['total'])->toBe(20.0);
});
