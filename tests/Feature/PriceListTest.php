<?php

use App\Models\Company;
use App\Models\InventoryCategory;
use App\Models\PriceListItem;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function priceListUser(string $slug): User
{
    $company = Company::firstOrCreate(
        ['slug' => 'unicrop'],
        ['name' => 'Unicrop Biochem', 'is_active' => true],
    );
    $role = Role::firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug)]);

    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);
    $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

    return $user;
}

/** A rate of 0 is how the schema says "not priced" — the column is NOT NULL. */
function priceListMaterial(string $name, string $category, float $rate): RawMaterial
{
    $material = RawMaterial::create([
        'name'            => $name,
        'category'        => $category,
        'unit'            => 'ltr',
        'gst'             => 5,
        'selling_rate'    => $rate,
        'approval_status' => 'approved',
        'is_active'       => true,
    ]);

    $material->forceFill(['company_id' => Company::where('slug', 'unicrop')->value('id')])->save();

    return $material;
}

/** @param array<int, array<string, mixed>> $packings */
function priceListPayload(string $name, array $packings = [], array $overrides = []): array
{
    return array_merge([
        'name'        => $name,
        'description' => 'Humic Acid 6% Liquid',
        'section'     => 'Bio Stimulant Product Price List',
        'gst_percent' => 18,
        'is_bulk'     => false,
        'is_active'   => true,
        'packings'    => $packings ?: [
            ['packing' => '100 ml', 'mrp' => 110, 'rate' => 22, 'qty_per_box' => 50],
            ['packing' => '1 Ltr',  'mrp' => 545, 'rate' => 70, 'qty_per_box' => 10],
        ],
    ], $overrides);
}

it('lets sales and admins open the price list', function (string $role) {
    $this->actingAs(priceListUser($role))
        ->get('/price-list')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('erp/price-list/index'));
})->with(['sales', 'admin']);

it('keeps the price list away from roles that do not sell', function (string $role) {
    $this->actingAs(priceListUser($role))
        ->get('/price-list')
        ->assertForbidden();
})->with(['factory', 'design']);

it('lets only an admin maintain the list', function () {
    $this->actingAs(priceListUser('admin'))
        ->post('/price-list/items', priceListPayload('Ribophyll'))
        ->assertSessionHasNoErrors();

    $item = PriceListItem::withoutGlobalScopes()->firstOrFail();
    expect($item->packings)->toHaveCount(2);

    $this->actingAs(priceListUser('sales'));
    $this->post('/price-list/items', priceListPayload('Sneaky'))->assertForbidden();
    $this->patch("/price-list/items/{$item->id}", priceListPayload('Renamed'))->assertForbidden();
    $this->delete("/price-list/items/{$item->id}")->assertForbidden();

    expect($item->fresh()->name)->toBe('Ribophyll');
});

it('replaces the packings on an edit rather than piling them up', function () {
    $this->actingAs(priceListUser('admin'))->post('/price-list/items', priceListPayload('Ribophyll'));
    $item = PriceListItem::withoutGlobalScopes()->firstOrFail();

    $this->patch("/price-list/items/{$item->id}", priceListPayload('Ribophyll', [
        ['packing' => '5 Ltr', 'mrp' => 1125, 'rate' => 225, 'qty_per_box' => 2],
    ]))->assertSessionHasNoErrors();

    $packings = $item->fresh()->packings;

    expect($packings)->toHaveCount(1);
    expect($packings->first()->packing)->toBe('5 Ltr');
});

it('keeps the packings in the order they were entered', function () {
    $this->actingAs(priceListUser('admin'))->post('/price-list/items', priceListPayload('Ultra Gold', [
        ['packing' => '100 ml', 'rate' => 28],
        ['packing' => '250 ml', 'rate' => 44],
        ['packing' => '5 Ltr',  'rate' => 480],
    ]));

    $order = PriceListItem::withoutGlobalScopes()->firstOrFail()->packings->pluck('packing');

    expect($order->all())->toBe(['100 ml', '250 ml', '5 Ltr']);
});

it('starts the list from the priced products sales can already see', function () {
    $this->actingAs(priceListUser('admin'));
    InventoryCategory::create(['name' => 'Internal Chemicals', 'visible_to_sales' => false]);

    priceListMaterial('Ribophyll', 'Finished Goods', 22);
    priceListMaterial('Secret Mix', 'Internal Chemicals', 900);
    priceListMaterial('Unpriced', 'Finished Goods', 0);

    $this->post('/price-list/import')->assertSessionHasNoErrors();

    $names = PriceListItem::withoutGlobalScopes()->pluck('name');

    expect($names->all())->toBe(['Ribophyll']);
    // The imported row carries the rate sales sees, ready for its packings.
    expect((float) PriceListItem::withoutGlobalScopes()->first()->packings->first()->rate)->toBe(22.0);
});

it('does not bring the same product in twice', function () {
    $this->actingAs(priceListUser('admin'));
    priceListMaterial('Ribophyll', 'Finished Goods', 22);

    $this->post('/price-list/import');
    $this->post('/price-list/import');

    expect(PriceListItem::withoutGlobalScopes()->count())->toBe(1);
});

it('drops a product whose category stops being visible to sales', function () {
    $this->actingAs(priceListUser('admin'));
    $material = priceListMaterial('Ribophyll', 'Finished Goods', 22);
    $this->post('/price-list/import');

    $this->get('/price-list')->assertInertia(fn ($page) => $page->has('items', 1));

    InventoryCategory::create(['name' => 'Finished Goods', 'visible_to_sales' => false]);

    $this->get('/price-list')->assertInertia(fn ($page) => $page->has('items', 0));
    expect($material->fresh())->not->toBeNull();
});

it('downloads a real PDF', function () {
    $this->actingAs(priceListUser('admin'))->post('/price-list/items', priceListPayload('Ribophyll'));

    $response = $this->actingAs(priceListUser('sales'))->get('/price-list/pdf');

    $response->assertOk()->assertHeader('content-type', 'application/pdf');
    expect($response->getContent())->toStartWith('%PDF-');
});

it('puts only the chosen products in the PDF', function () {
    $this->actingAs(priceListUser('admin'));
    $this->post('/price-list/items', priceListPayload('Keep Me'));
    $this->post('/price-list/items', priceListPayload('Drop Me'));

    $keep = PriceListItem::withoutGlobalScopes()->where('name', 'Keep Me')->firstOrFail();

    $one = $this->get("/price-list/pdf?only={$keep->id}")->getContent();
    $all = $this->get('/price-list/pdf')->getContent();

    // dompdf compresses its text, so compare sizes rather than words.
    expect(strlen($one))->toBeLessThan(strlen($all));
});

it('leaves a hidden product and one with no packings off the PDF', function () {
    $this->actingAs(priceListUser('admin'));
    $this->post('/price-list/items', priceListPayload('Printed'));
    $this->post('/price-list/items', priceListPayload('Hidden', [], ['is_active' => false]));
    // The editor strips blank rows, so an item can arrive with no packings.
    $this->post('/price-list/items', priceListPayload('No packings', [], ['packings' => []]));

    expect(PriceListItem::withoutGlobalScopes()->count())->toBe(3);

    $full = $this->get('/price-list/pdf')->getContent();
    $onlyPrinted = $this->get(
        '/price-list/pdf?only='.PriceListItem::withoutGlobalScopes()->where('name', 'Printed')->value('id'),
    )->getContent();

    expect(strlen($full))->toBe(strlen($onlyPrinted));
});

it('refuses the PDF to a role that may not sell', function () {
    $this->actingAs(priceListUser('factory'))
        ->get('/price-list/pdf')
        ->assertForbidden();
});

it('lets an admin save the cover text and keeps sales out of it', function () {
    $this->actingAs(priceListUser('admin'))
        ->post('/price-list/settings', [
            'price_list_title' => 'Bio Fertilizer Price List',
            'price_list_email' => 'sales@unicropbiochem.com',
        ])
        ->assertSessionHasNoErrors();

    $this->get('/price-list')->assertInertia(fn ($page) => $page
        ->where('settings.price_list_title', 'Bio Fertilizer Price List'));

    $this->actingAs(priceListUser('sales'))
        ->post('/price-list/settings', ['price_list_title' => 'hacked'])
        ->assertForbidden();
});
