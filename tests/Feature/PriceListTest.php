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

    expect(app(\App\Http\Controllers\PriceListController::class)
        ->itemsFor(['only' => (string) $keep->id])->pluck('name')->all())->toBe(['Keep Me']);
});

it('leaves a hidden product and one with no packings off the PDF', function () {
    $this->actingAs(priceListUser('admin'));
    $this->post('/price-list/items', priceListPayload('Printed'));
    $this->post('/price-list/items', priceListPayload('Hidden', [], ['is_active' => false]));
    // The editor strips blank rows, so an item can arrive with no packings.
    $this->post('/price-list/items', priceListPayload('No packings', [], ['packings' => []]));

    expect(PriceListItem::withoutGlobalScopes()->count())->toBe(3);

    expect(app(\App\Http\Controllers\PriceListController::class)
        ->itemsFor([])->pluck('name')->all())->toBe(['Printed']);
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

// ── Live rates ───────────────────────────────────────────────────────────────

it('prints the product selling rate as it stands now, not the one typed in', function () {
    $this->actingAs(priceListUser('admin'));
    $material = priceListMaterial('Ribophyll', 'Finished Goods', 22);

    $this->post('/price-list/items', priceListPayload('Ribophyll', [
        ['packing' => '1 Ltr', 'raw_material_id' => $material->id, 'rate' => 22],
    ]))->assertSessionHasNoErrors();

    // The rate moves in inventory; the list must follow it.
    $material->update(['selling_rate' => 29]);

    $this->get('/price-list')->assertInertia(function ($page) {
        $packing = $page->toArray()['props']['items'][0]['packings'][0];

        expect((float) $packing['rate'])->toBe(29.0);
        expect((float) $packing['typed_rate'])->toBe(22.0);
        expect($packing['is_live'])->toBeTrue();
    });
});

it('falls back to the typed rate when a packing has no product', function () {
    $this->actingAs(priceListUser('admin'))
        ->post('/price-list/items', priceListPayload('Hand priced', [
            ['packing' => '5 Ltr', 'rate' => 480],
        ]))->assertSessionHasNoErrors();

    $this->get('/price-list')->assertInertia(function ($page) {
        $packing = $page->toArray()['props']['items'][0]['packings'][0];

        expect((float) $packing['rate'])->toBe(480.0);
        expect($packing['is_live'])->toBeFalse();
    });
});

it('links an imported packing to its product so the rate stays live', function () {
    $this->actingAs(priceListUser('admin'));
    $material = priceListMaterial('Ribophyll', 'Finished Goods', 22);

    $this->post('/price-list/import')->assertSessionHasNoErrors();
    $material->update(['selling_rate' => 31]);

    $this->get('/price-list')->assertInertia(fn ($page) => expect(
        (float) $page->toArray()['props']['items'][0]['packings'][0]['rate']
    )->toBe(31.0));
});

it('takes a packing rate without one typed when a product is linked', function () {
    $this->actingAs(priceListUser('admin'));
    $material = priceListMaterial('Ribophyll', 'Finished Goods', 22);

    $this->post('/price-list/items', priceListPayload('Ribophyll', [
        ['packing' => '1 Ltr', 'raw_material_id' => $material->id],
    ]))->assertSessionHasNoErrors();

    $this->get('/price-list')->assertInertia(fn ($page) => expect(
        (float) $page->toArray()['props']['items'][0]['packings'][0]['rate']
    )->toBe(22.0));
});

// ── Category and group ───────────────────────────────────────────────────────

function priceListLinked(string $name, string $category, ?string $group, float $rate): int
{
    $material = priceListMaterial($name, $category, $rate);
    $material->update(['group_name' => $group]);

    test()->post('/price-list/items', priceListPayload($name, [
        ['packing' => '1 Ltr', 'raw_material_id' => $material->id],
    ], ['raw_material_id' => $material->id, 'section' => null]))->assertSessionHasNoErrors();

    return $material->id;
}

it('heads a product with its inventory group, falling back to its category', function () {
    $this->actingAs(priceListUser('admin'));
    priceListLinked('Ribophyll', 'Finished Goods', 'Bio Stimulant', 22);
    priceListLinked('Plain Jane', 'Finished Goods', null, 40);

    $this->get('/price-list')->assertInertia(function ($page) {
        $headings = collect($page->toArray()['props']['items'])->pluck('heading', 'name');

        expect($headings['Ribophyll'])->toBe('Bio Stimulant');
        expect($headings['Plain Jane'])->toBe('Finished Goods');
    });
});

it('offers the categories and groups actually on the list', function () {
    $this->actingAs(priceListUser('admin'));
    priceListLinked('Ribophyll', 'Finished Goods', 'Bio Stimulant', 22);
    priceListLinked('Micro 1000', 'Bio Fertilizer', 'Bio Fertilizer Powder', 48);

    $this->get('/price-list')->assertInertia(function ($page) {
        $props = $page->toArray()['props'];

        expect($props['categories'])->toBe(['Bio Fertilizer', 'Finished Goods']);
        expect($props['groups'])->toBe(['Bio Fertilizer Powder', 'Bio Stimulant']);
    });
});

/**
 * dompdf compresses its text streams, so the bytes cannot be searched.
 * Ask the controller what a PDF with these filters would carry instead.
 *
 * @return array<int, string>
 */
function priceListNamesFor(array $filters): array
{
    return app(\App\Http\Controllers\PriceListController::class)
        ->itemsFor($filters)->pluck('name')->sort()->values()->all();
}

it('pulls a price list for one group only', function () {
    $this->actingAs(priceListUser('admin'));
    priceListLinked('Ribophyll', 'Finished Goods', 'Bio Stimulant', 22);
    priceListLinked('Micro 1000', 'Bio Fertilizer', 'Bio Fertilizer Powder', 48);

    expect(priceListNamesFor([]))->toBe(['Micro 1000', 'Ribophyll']);
    expect(priceListNamesFor(['group' => 'Bio Stimulant']))->toBe(['Ribophyll']);
});

it('pulls a price list for one category only', function () {
    $this->actingAs(priceListUser('admin'));
    priceListLinked('Ribophyll', 'Finished Goods', 'Bio Stimulant', 22);
    priceListLinked('Micro 1000', 'Bio Fertilizer', 'Bio Fertilizer Powder', 48);

    expect(priceListNamesFor(['category' => 'Finished Goods']))->toBe(['Ribophyll']);
    expect(priceListNamesFor(['category' => 'Nothing Here']))->toBe([]);
});

it('narrows by category and group together', function () {
    $this->actingAs(priceListUser('admin'));
    priceListLinked('Ribophyll', 'Finished Goods', 'Bio Stimulant', 22);
    priceListLinked('Spiral', 'Finished Goods', 'Bio Fertilizer Powder', 30);

    expect(priceListNamesFor(['category' => 'Finished Goods', 'group' => 'Bio Stimulant']))
        ->toBe(['Ribophyll']);
});

it('names the file after the slice that was pulled', function () {
    $this->actingAs(priceListUser('admin'));
    priceListLinked('Ribophyll', 'Finished Goods', 'Bio Stimulant', 22);

    $this->get('/price-list/pdf?group=Bio+Stimulant')
        ->assertDownload('Price-List-bio-stimulant-'.now()->format('Y-m-d').'.pdf');
});
