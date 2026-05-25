<?php

use App\Models\Order;
use App\Models\Role;
use App\Models\User;

test('guests are redirected from orders', function () {
    $response = $this->get(route('orders.index'));

    $response->assertRedirect(route('login'));
});

test('office user can create an order with items', function () {
    $user = User::factory()->withRole(Role::OFFICE)->create(['is_active' => true]);

    $payload = [
        'company_name' => 'Sri Agro Labs',
        'customer_name' => 'Ravi Kumar',
        'sales_user_id' => $user->id,
        'order_date' => now()->toDateString(),
        'transport_name' => 'Sri Logistics',
        'destination' => 'Hyderabad',
        'delivery_address' => 'Plot 23, Phase 2',
        'phone' => '9999999999',
        'priority' => 'high',
        'freight_amount' => 50,
        'courier_amount' => 25,
        'round_off' => -5,
        'items' => [
            [
                'our_brand' => 'CropShield',
                'party_brand' => 'Partner Shield',
                'packing_size' => '500 ml',
                'quantity' => 10,
                'rate' => 20,
                'gst_percent' => 18,
                'type' => 'Liquid',
                'shape' => 'Bottle',
                'cap_color' => 'Green',
            ],
        ],
    ];

    $this->actingAs($user);

    $response = $this->post(route('orders.store'), $payload);

    $response->assertRedirect(route('orders.index'));

    $order = Order::query()->first();

    expect($order)->not->toBeNull();
    expect($order?->order_number)->toStartWith('ORD-');
    expect((float) $order?->subtotal)->toBe(200.0);
    expect((float) $order?->gst_total)->toBe(36.0);
    expect((float) $order?->total_amount)->toBe(306.0);
    expect($order?->items)->toHaveCount(1);
});
