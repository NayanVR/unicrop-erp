<?php

use App\Models\Bom;
use App\Models\Company;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function changeLogActor(): User
{
    $company = Company::create(['name' => 'Unicrop', 'slug' => 'unicrop', 'is_active' => true]);
    $role = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Admin']);
    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);
    $user->companies()->attach($company, ['is_default' => true]);

    return $user;
}

function changeLogMaterial(string $name, string $unit = 'kg'): RawMaterial
{
    return RawMaterial::create([
        'name' => $name,
        'unit' => $unit,
        'stock_qty' => 100,
        'cost_per_unit' => 10,
        'approval_status' => 'approved',
        'is_active' => true,
    ]);
}

it('records the header fields an edit changed', function () {
    $user = changeLogActor();
    $flour = changeLogMaterial('Flour');

    $bom = Bom::create(['name' => 'Cake', 'batch_size' => 1, 'batch_unit' => 'kg', 'is_active' => true]);
    $bom->items()->create(['raw_material_id' => $flour->id, 'qty_per_batch' => 2, 'unit' => 'kg']);

    $this->actingAs($user)->patch("/bom/{$bom->id}", [
        'name' => 'Cake',
        'batch_size' => 1.5,          // changed
        'batch_unit' => 'kg',
        'items' => [['raw_material_id' => $flour->id, 'qty_per_batch' => 2, 'unit' => 'kg']],
    ])->assertRedirect();

    $log = $bom->refresh()->last_changes;

    expect($log)->not->toBeNull()
        ->and($log['by'])->toBe($user->name)
        ->and($log['items'])->toBe([])
        ->and(collect($log['fields'])->firstWhere('label', 'Batch Size'))
        ->toMatchArray(['label' => 'Batch Size', 'from' => '1', 'to' => '1.5']);
});

it('records ingredients that were changed, added and removed', function () {
    $user = changeLogActor();
    $flour = changeLogMaterial('Flour');
    $sugar = changeLogMaterial('Sugar');
    $salt  = changeLogMaterial('Salt');

    $bom = Bom::create(['name' => 'Cake', 'batch_size' => 1, 'batch_unit' => 'kg', 'is_active' => true]);
    $bom->items()->create(['raw_material_id' => $flour->id, 'qty_per_batch' => 2, 'unit' => 'kg']);
    $bom->items()->create(['raw_material_id' => $salt->id,  'qty_per_batch' => 1, 'unit' => 'kg']);

    $this->actingAs($user)->patch("/bom/{$bom->id}", [
        'name' => 'Cake',
        'batch_size' => 1,
        'batch_unit' => 'kg',
        'items' => [
            ['raw_material_id' => $flour->id, 'qty_per_batch' => 3, 'unit' => 'kg'],  // changed
            ['raw_material_id' => $sugar->id, 'qty_per_batch' => 1, 'unit' => 'kg'],  // added
            // salt dropped
        ],
    ])->assertRedirect();

    $items = collect($bom->refresh()->last_changes['items'])->keyBy('name');

    expect($items['Flour'])->toMatchArray(['kind' => 'changed', 'from' => '2 kg', 'to' => '3 kg'])
        ->and($items['Sugar'])->toMatchArray(['kind' => 'added', 'to' => '1 kg'])
        ->and($items['Salt'])->toMatchArray(['kind' => 'removed', 'from' => '1 kg'])
        ->and($items['Flour']['id'])->toBe($flour->id);
});

it('leaves the previous note alone when a save changes nothing', function () {
    $user = changeLogActor();
    $flour = changeLogMaterial('Flour');

    $bom = Bom::create(['name' => 'Cake', 'batch_size' => 1, 'batch_unit' => 'kg', 'is_active' => true]);
    $bom->items()->create(['raw_material_id' => $flour->id, 'qty_per_batch' => 2, 'unit' => 'kg']);

    $payload = [
        'name' => 'Cake',
        'batch_size' => 1,
        'batch_unit' => 'kg',
        'items' => [['raw_material_id' => $flour->id, 'qty_per_batch' => 2, 'unit' => 'kg']],
    ];

    $this->actingAs($user)->patch("/bom/{$bom->id}", $payload)->assertRedirect();

    expect($bom->refresh()->last_changes)->toBeNull();
});
