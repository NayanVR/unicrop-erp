<?php

use App\Models\Company;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function boardUser(string $slug): User
{
    $company = Company::firstOrCreate(['slug' => 'unicrop'], ['name' => 'Unicrop', 'is_active' => true]);
    $role = Role::firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug)]);

    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);
    $user->companies()->syncWithoutDetaching([$company->id => ['is_default' => true]]);

    return $user;
}

function boardOrder(User $user, string $status): Order
{
    $order = Order::create([
        'order_number' => 'ORD-'.str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT),
        'company_name' => 'Acme Agro',
        'customer_name' => 'Acme',
        'sales_user_id' => $user->id,
        'created_by' => $user->id,
        'order_date' => now()->toDateString(),
        'status' => $status,
        'total_amount' => 1000,
    ]);

    $order->forceFill(['company_id' => Company::where('slug', 'unicrop')->value('id')])->save();
    $order->items()->create([
        'our_brand' => 'Widget', 'packing_size' => '1ltr',
        'quantity' => 10, 'rate' => 100, 'amount' => 1000, 'status' => 'filling',
    ]);

    return $order;
}

it('renders the orders page with its board lanes', function () {
    $user = boardUser('admin');
    boardOrder($user, 'confirmed');

    $this->actingAs($user)->get('/orders')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('erp/orders/index')->has('orders', 1));
});

it('renders production orders with items the board can lay out', function () {
    $user = boardUser('factory');
    boardOrder($user, 'confirmed');

    $this->actingAs($user)->get('/factory')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('erp/factory/index')
            ->has('orders', 1)
            ->where('orders.0.items.0.status', 'filling'));
});
