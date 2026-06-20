<?php

use App\Models\BankAccount;
use App\Models\Company;
use App\Models\InventoryPool;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\Policy;
use App\Models\Product;
use App\Models\ProductInventoryLink;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\User;
use App\Services\CurrentCompany;

function setTestCompany(Company $company): void
{
    app(CurrentCompany::class)->set($company);
    session(['current_company_id' => $company->id]);
}

function poolTestAdmin(Company $company): User
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

function confirmableOrder(Company $company, string $brand, float $qty): Order
{
    setTestCompany($company);

    $bankAccount = BankAccount::first() ?? BankAccount::create(['name' => 'Test Bank', 'bank_name' => 'Test Bank', 'account_number' => '123456']);

    $order = Order::create([
        'order_number' => 'ORD-TEST-'.$company->id.'-'.uniqid(),
        'company_name' => 'Test Customer',
        'customer_name' => 'Test Customer',
        'order_date' => now()->toDateString(),
        'transport_name' => 'Test Transport',
        'destination' => 'Test City',
        'delivery_address' => 'Test Address',
        'phone' => '9999999999',
        'priority' => 'normal',
        'status' => 'submitted',
        'subtotal' => 0,
        'gst_total' => 0,
        'total_amount' => 0,
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'our_brand' => $brand,
        'packing_size' => '',
        'quantity' => $qty,
        'rate' => 10,
        'amount' => $qty * 10,
        'gst_percent' => 18,
    ]);

    OrderPayment::create([
        'order_id' => $order->id,
        'bank_account_id' => $bankAccount->id,
        'amount' => $qty * 10,
    ]);

    return $order;
}

test('a 30 unit order from one company draws from the shared pool and is reflected for the linked company', function () {
    $companyA = Company::first();
    $companyB = Company::create(['name' => 'Pool Test Co B', 'slug' => 'pool-test-co-b', 'is_active' => true]);

    setTestCompany($companyA);
    $materialA = RawMaterial::create([
        'name' => 'ABC',
        'category' => 'Finished Good',
        'unit' => 'L',
        'stock_qty' => 0,
    ]);
    $productA = Product::create([
        'raw_material_id' => $materialA->id,
        'name' => 'ABC',
        'packing_size' => '1L',
        'gst_percent' => 18,
    ]);

    setTestCompany($companyB);
    $materialB = RawMaterial::create([
        'name' => 'XYZ',
        'category' => 'Finished Good',
        'unit' => 'L',
        'stock_qty' => 0,
    ]);
    $productB = Product::create([
        'raw_material_id' => $materialB->id,
        'name' => 'XYZ',
        'packing_size' => '1L',
        'gst_percent' => 18,
    ]);

    $pool = InventoryPool::create(['name' => 'Shared Liquid', 'stock_qty' => 100, 'unit' => 'L']);
    ProductInventoryLink::create(['product_id' => $productA->id, 'inventory_pool_id' => $pool->id]);
    ProductInventoryLink::create(['product_id' => $productB->id, 'inventory_pool_id' => $pool->id]);

    $order = confirmableOrder($companyA, 'ABC', 30);
    $adminA = poolTestAdmin($companyA);

    setTestCompany($companyA);
    $this->actingAs($adminA)->post(route('orders.confirm', $order))->assertRedirect();

    $pool->refresh();
    expect((float) $pool->stock_qty)->toBe(70.0);

    $materialA->refresh();
    $materialB->refresh();
    expect((float) $materialA->stock_qty)->toBe(0.0);
    expect((float) $materialB->stock_qty)->toBe(0.0);

    $linkB = ProductInventoryLink::where('product_id', $productB->id)->with('inventoryPool')->first();
    expect((float) $linkB->inventoryPool->stock_qty)->toBe(70.0);
});

test('an order for an unlinked product still decrements its own raw material, unaffected by pooling', function () {
    $companyA = Company::first();

    setTestCompany($companyA);
    $material = RawMaterial::create([
        'name' => 'Standalone Item',
        'category' => 'Finished Good',
        'unit' => 'L',
        'stock_qty' => 50,
    ]);

    $order = confirmableOrder($companyA, 'Standalone Item', 20);
    $adminA = poolTestAdmin($companyA);

    setTestCompany($companyA);
    $this->actingAs($adminA)->post(route('orders.confirm', $order))->assertRedirect();

    $material->refresh();
    expect((float) $material->stock_qty)->toBe(30.0);
});
