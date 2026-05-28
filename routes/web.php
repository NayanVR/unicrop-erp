<?php

use App\Http\Controllers\BomController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DesignController;
use App\Http\Controllers\FactoryController;
use App\Http\Controllers\FinishedGoodsController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PartyController;
use App\Http\Controllers\ProductPhotoController;
use App\Http\Controllers\PurchaseBillController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\UnitTransferController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('product-photos/{photo}/image', [ProductPhotoController::class, 'show'])->name('product-photos.show');

    Route::middleware(['role:admin'])->group(function () {
        Route::resource('users', UserController::class)->only(['index', 'store', 'update', 'destroy']);
    });

    // Orders list is visible to office AND design users (controller filters by role)
    Route::middleware(['role:admin,office,design'])->group(function () {
        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
    });

    Route::middleware(['role:admin,office'])->group(function () {
        Route::get('orders/create', [OrderController::class, 'create'])->name('orders.create');
        Route::post('orders', [OrderController::class, 'store'])->name('orders.store');
        Route::patch('orders/{order}', [OrderController::class, 'update'])->name('orders.update');
        Route::post('orders/{order}/confirm', [OrderController::class, 'confirm'])->name('orders.confirm');
        Route::post('orders/{order}/send-to-design', [OrderController::class, 'sendToDesign'])->name('orders.send-to-design');
        Route::post('erp/settings/transports', [SettingsController::class, 'storeTransport'])->name('settings.transports.store');
        Route::delete('erp/settings/transports/{transport}', [SettingsController::class, 'destroyTransport'])->name('settings.transports.destroy');
    });

    Route::middleware(['role:admin,factory'])->group(function () {
        Route::post('orders/{order}/approve-urgent', [OrderController::class, 'approveUrgent'])->name('orders.approve-urgent');
        Route::post('orders/{order}/reject-urgent', [OrderController::class, 'rejectUrgent'])->name('orders.reject-urgent');

        Route::get('factory', [FactoryController::class, 'index'])->name('factory.index');
        Route::post('factory/items/{item}/advance', [FactoryController::class, 'advanceStage'])->name('factory.items.advance');
        Route::post('factory/items/{item}/revert', [FactoryController::class, 'revertStage'])->name('factory.items.revert');

        Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index');
        Route::post('inventory/materials', [InventoryController::class, 'storeMaterial'])->name('inventory.materials.store');
        Route::patch('inventory/materials/{material}', [InventoryController::class, 'updateMaterial'])->name('inventory.materials.update');
        Route::post('inventory/materials/{material}/transactions', [InventoryController::class, 'addTransaction'])->name('inventory.materials.transactions');

        Route::get('bom', [BomController::class, 'index'])->name('bom.index');
        Route::post('bom', [BomController::class, 'store'])->name('bom.store');
        Route::patch('bom/{bom}', [BomController::class, 'update'])->name('bom.update');
        Route::delete('bom/{bom}', [BomController::class, 'destroy'])->name('bom.destroy');
        Route::post('bom/{bom}/run', [BomController::class, 'runProduction'])->name('bom.run');
    });

    Route::middleware(['role:admin'])->group(function () {
        Route::get('erp/settings', [SettingsController::class, 'index'])->name('settings.index');
        Route::post('erp/settings/products', [SettingsController::class, 'storeProduct'])->name('settings.products.store');
        Route::patch('erp/settings/products/{product}', [SettingsController::class, 'updateProduct'])->name('settings.products.update');
        Route::delete('erp/settings/products/{product}', [SettingsController::class, 'destroyProduct'])->name('settings.products.destroy');

        Route::patch('erp/settings/transports/{transport}', [SettingsController::class, 'updateTransport'])->name('settings.transports.update');

        Route::get('purchase-bills', [PurchaseBillController::class, 'index'])->name('purchase-bills.index');
        Route::post('purchase-bills', [PurchaseBillController::class, 'store'])->name('purchase-bills.store');
        Route::patch('purchase-bills/{bill}', [PurchaseBillController::class, 'update'])->name('purchase-bills.update');
        Route::delete('purchase-bills/{bill}', [PurchaseBillController::class, 'destroy'])->name('purchase-bills.destroy');
    });

    Route::get('rate-calculator', fn() => inertia('erp/rate-calculator/index', ['pageTitle' => 'Rate Calculator']))->name('rate-calculator.index');

    Route::middleware(['role:admin,factory'])->group(function () {
        Route::get('finished-goods', [FinishedGoodsController::class, 'index'])->name('finished-goods.index');
        Route::post('finished-goods', [FinishedGoodsController::class, 'store'])->name('finished-goods.store');
        Route::patch('finished-goods/{finishedGood}', [FinishedGoodsController::class, 'update'])->name('finished-goods.update');
        Route::delete('finished-goods/{finishedGood}', [FinishedGoodsController::class, 'destroy'])->name('finished-goods.destroy');

        Route::get('unit-transfer', [UnitTransferController::class, 'index'])->name('unit-transfer.index');
        Route::post('unit-transfer', [UnitTransferController::class, 'store'])->name('unit-transfer.store');
        Route::patch('unit-transfer/{unitTransfer}/status', [UnitTransferController::class, 'updateStatus'])->name('unit-transfer.status');
        Route::delete('unit-transfer/{unitTransfer}', [UnitTransferController::class, 'destroy'])->name('unit-transfer.destroy');
    });

    Route::middleware(['role:admin,design'])->group(function () {
        Route::get('design', [DesignController::class, 'index'])->name('design.index');
        Route::post('design', [DesignController::class, 'store'])->name('design.store');
        Route::patch('design/{designOrder}', [DesignController::class, 'update'])->name('design.update');
        Route::post('design/{designOrder}/advance', [DesignController::class, 'advance'])->name('design.advance');
        Route::delete('design/{designOrder}', [DesignController::class, 'destroy'])->name('design.destroy');

        Route::get('design/gallery', [ProductPhotoController::class, 'index'])->name('design.gallery.index');
        Route::post('design/gallery/folders', [ProductPhotoController::class, 'storeFolder'])->name('design.gallery.folders.store');
        Route::post('design/gallery', [ProductPhotoController::class, 'store'])->name('design.gallery.store');
        Route::delete('design/gallery/{photo}', [ProductPhotoController::class, 'destroy'])->name('design.gallery.destroy');
    });

    Route::middleware(['role:admin,office'])->group(function () {
        Route::get('parties', [PartyController::class, 'index'])->name('parties.index');
        Route::post('parties', [PartyController::class, 'store'])->name('parties.store');
        Route::patch('parties/{party}', [PartyController::class, 'update'])->name('parties.update');
        Route::delete('parties/{party}', [PartyController::class, 'destroy'])->name('parties.destroy');
        Route::post('parties/{party}/documents', [PartyController::class, 'uploadDocument'])->name('parties.documents.upload');
        Route::delete('parties/documents/{document}', [PartyController::class, 'deleteDocument'])->name('parties.documents.destroy');
        Route::post('parties/{party}/product-photo', [PartyController::class, 'storeProductPhoto'])->name('parties.product-photo.store');
        Route::post('parties/{party}/product-rates', [PartyController::class, 'storeProductRate'])->name('parties.product-rates.store');
        Route::patch('parties/product-rates/{productRate}', [PartyController::class, 'updateProductRate'])->name('parties.product-rates.update');
        Route::delete('parties/product-rates/{productRate}', [PartyController::class, 'destroyProductRate'])->name('parties.product-rates.destroy');
    });
});

require __DIR__ . '/settings.php';
