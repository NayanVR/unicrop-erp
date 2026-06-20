<?php

use App\Http\Controllers\BomController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\BomRecipeController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GodownController;
use App\Http\Controllers\DesignController;
use App\Http\Controllers\FactoryController;
use App\Http\Controllers\FillingController;
use App\Http\Controllers\FinishedGoodsController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PartyController;
use App\Http\Controllers\InventoryPoolController;
use App\Http\Controllers\ProductController;
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
    Route::post('companies/switch', [CompanyController::class, 'switch'])->name('companies.switch');
    Route::get('product-photos/{photo}/image', [ProductPhotoController::class, 'show'])->name('product-photos.show');
    Route::get('parties/{party}/pan-card', [PartyController::class, 'showPanCard'])->name('parties.pan-card');

    Route::middleware(['role:users.manage'])->group(function () {
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    });

    // Orders list — controller filters by role; sales see confirmed/dispatched only
    Route::middleware(['role:orders.view'])->group(function () {
        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
    });

    // Order print/PDF — also needed by factory for production orders
    Route::middleware(['role:orders.print'])->group(function () {
        Route::get('orders/{order}/print', [OrderController::class, 'print'])->name('orders.print');
    });

    // Order documents — download accessible by any authenticated user with order access
    Route::get('orders/{order}/documents/{attachment}', [OrderController::class, 'downloadDocument'])->name('orders.documents.show');

    // Order documents — upload / delete / eway flag restricted to accountant and admin
    Route::middleware(['role:orders.documents.manage'])->group(function () {
        Route::post('orders/{order}/documents', [OrderController::class, 'uploadDocument'])->name('orders.documents.store');
        Route::delete('orders/{order}/documents/{attachment}', [OrderController::class, 'deleteDocument'])->name('orders.documents.destroy');
        Route::post('orders/{order}/eway-not-required', [OrderController::class, 'setEwayNotRequired'])->name('orders.eway-not-required');
        Route::post('orders/{order}/payments/{payment}/tally-entry', [OrderController::class, 'markPaymentTallyEntry'])->name('orders.payments.tally-entry');
    });

    Route::middleware(['role:orders.edit'])->group(function () {
        Route::get('orders/create', [OrderController::class, 'create'])->name('orders.create');
        Route::post('orders', [OrderController::class, 'store'])->name('orders.store');
        Route::get('orders/{order}/edit', [OrderController::class, 'edit'])->name('orders.edit');
        Route::patch('orders/{order}', [OrderController::class, 'update'])->name('orders.update');
    });

    Route::middleware(['role:orders.process'])->group(function () {
        Route::delete('orders/{order}', [OrderController::class, 'destroy'])->name('orders.destroy');
        Route::post('orders/{order}/confirm', [OrderController::class, 'confirm'])->name('orders.confirm');
        Route::post('orders/{order}/payments', [OrderController::class, 'storePayment'])->name('orders.payments.store');
        Route::delete('orders/{order}/payments/{payment}', [OrderController::class, 'destroyPayment'])->name('orders.payments.destroy');
        Route::post('orders/{order}/send-to-design', [OrderController::class, 'sendToDesign'])->name('orders.send-to-design');
        Route::post('orders/{order}/label-print', [FactoryController::class, 'recordLabelPrint'])->name('orders.label-print');
        Route::post('erp/settings/transports', [SettingsController::class, 'storeTransport'])->name('settings.transports.store');
        Route::delete('erp/settings/transports/{transport}', [SettingsController::class, 'destroyTransport'])->name('settings.transports.destroy');
    });

    Route::middleware(['role:factory.manage'])->group(function () {
        Route::post('orders/{order}/approve-urgent', [OrderController::class, 'approveUrgent'])->name('orders.approve-urgent');
        Route::post('orders/{order}/reject-urgent', [OrderController::class, 'rejectUrgent'])->name('orders.reject-urgent');

        Route::get('factory', [FactoryController::class, 'index'])->name('factory.index');
        Route::get('filling', [FillingController::class, 'index'])->name('filling.index');
        Route::post('filling', [FillingController::class, 'store'])->name('filling.store');
        Route::delete('filling/runs/{run}', [FillingController::class, 'destroyRun'])->name('filling.runs.destroy');
        Route::patch('filling/{recipe}', [FillingController::class, 'update'])->name('filling.update');
        Route::delete('filling/{recipe}', [FillingController::class, 'destroy'])->name('filling.destroy');
        Route::post('filling/{recipe}/run', [FillingController::class, 'runFilling'])->name('filling.run');
        Route::post('factory/items/{item}/advance', [FactoryController::class, 'advanceStage'])->name('factory.items.advance');
        Route::post('factory/items/{item}/revert', [FactoryController::class, 'revertStage'])->name('factory.items.revert');
        Route::post('factory/items/{item}/set-stage', [FactoryController::class, 'setStage'])->name('factory.items.set-stage');
        Route::post('factory/items/{item}/labels', [FactoryController::class, 'recordLabels'])->name('factory.items.labels');
        Route::patch('factory/items/{item}', [FactoryController::class, 'updateItem'])->name('factory.items.update');
        Route::post('factory/orders/{order}/notes', [FactoryController::class, 'saveNotes'])->name('factory.orders.notes');
        Route::post('factory/orders/{order}/dispatch', [FactoryController::class, 'dispatchOrder'])->name('factory.orders.dispatch');
        Route::post('factory/orders/{order}/label-print', [FactoryController::class, 'recordLabelPrint'])->name('factory.orders.label-print');

        // Inventory — factory + admin only
        Route::post('inventory/materials/{material}/transactions', [InventoryController::class, 'addTransaction'])->name('inventory.materials.transactions');
        Route::delete('inventory/materials/{material}', [InventoryController::class, 'destroyMaterial'])->name('inventory.materials.destroy');
        Route::post('inventory/reorders', [InventoryController::class, 'storeReorder'])->name('inventory.reorders.store');
        Route::post('inventory/reorders/{reorder}/receive', [InventoryController::class, 'receiveReorder'])->name('inventory.reorders.receive');
        Route::delete('inventory/reorders/{reorder}', [InventoryController::class, 'destroyReorder'])->name('inventory.reorders.destroy');
        Route::post('inventory/categories', [InventoryController::class, 'storeCategory'])->name('inventory.categories.store');
        Route::patch('inventory/categories/{category}', [InventoryController::class, 'updateCategory'])->name('inventory.categories.update');
        Route::post('inventory/godowns', [GodownController::class, 'store'])->name('inventory.godowns.store');
        Route::patch('inventory/godowns/{godown}', [GodownController::class, 'update'])->name('inventory.godowns.update');
        Route::delete('inventory/godowns/{godown}', [GodownController::class, 'destroy'])->name('inventory.godowns.destroy');
        Route::post('inventory/godowns/{godown}/set-default', [GodownController::class, 'setDefault'])->name('inventory.godowns.set-default');
        Route::delete('inventory/categories/{category}', [InventoryController::class, 'destroyCategory'])->name('inventory.categories.destroy');

        Route::get('bom', [BomController::class, 'index'])->name('bom.index');

        Route::post('bom', [BomController::class, 'store'])->name('bom.store');
        Route::patch('bom/{bom}', [BomController::class, 'update'])->name('bom.update');
        Route::post('bom/{bom}/run', [BomController::class, 'runProduction'])->name('bom.run');
        Route::delete('bom/{bom}', [BomController::class, 'destroy'])->name('bom.destroy');
        Route::delete('bom/runs/{run}', [BomController::class, 'destroyRun'])->name('bom.runs.destroy');
        Route::patch('bom-category/rename', [BomController::class, 'renameCategory'])->name('bom.category.rename');
        Route::delete('bom-category/delete', [BomController::class, 'deleteCategory'])->name('bom.category.delete');
    });

    // Inventory — view: admin, factory, accountant, sales
    Route::middleware(['role:inventory.view'])->group(function () {
        Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index');
    });

    // Inventory — edit material + bill entry: factory, accountant, and admin
    Route::middleware(['role:inventory.edit'])->group(function () {
        Route::post('inventory/materials', [InventoryController::class, 'storeMaterial'])->name('inventory.materials.store');
        Route::patch('inventory/materials/{material}', [InventoryController::class, 'updateMaterial'])->name('inventory.materials.update');
        Route::post('inventory/purchase-bills', [InventoryController::class, 'storePurchaseBill'])->name('inventory.purchase-bills.store');
        Route::delete('inventory/purchase-bills/{bill}', [InventoryController::class, 'destroyPurchaseBill'])->name('inventory.purchase-bills.destroy');
        Route::post('inventory/reorders/{reorder}/receive-with-bill', [InventoryController::class, 'receiveWithBill'])->name('inventory.reorders.receive-with-bill');
    });

    Route::middleware(['role:admin.settings'])->group(function () {
        Route::post('inventory/materials/{material}/approve', [InventoryController::class, 'approveMaterial'])->name('inventory.materials.approve');
        Route::post('inventory/materials/{material}/reject', [InventoryController::class, 'rejectMaterial'])->name('inventory.materials.reject');

        Route::get('reports/profit-loss', [\App\Http\Controllers\ReportController::class, 'profitLoss'])->name('reports.profit-loss');

        Route::get('erp/settings', [SettingsController::class, 'index'])->name('settings.index');

        Route::patch('erp/settings/transports/{transport}', [SettingsController::class, 'updateTransport'])->name('settings.transports.update');
        Route::post('erp/settings/alert', [SettingsController::class, 'updateAlertSettings'])->name('settings.alert.update');
        Route::post('erp/settings/alert/test', [SettingsController::class, 'testAlert'])->name('settings.alert.test');

        Route::post('erp/settings/packing-sizes', [SettingsController::class, 'storePackingSize'])->name('settings.packing-sizes.store');
        Route::patch('erp/settings/packing-sizes/{packingSize}', [SettingsController::class, 'updatePackingSize'])->name('settings.packing-sizes.update');
        Route::delete('erp/settings/packing-sizes/{packingSize}', [SettingsController::class, 'destroyPackingSize'])->name('settings.packing-sizes.destroy');

        Route::post('erp/settings/bank-accounts', [SettingsController::class, 'storeBankAccount'])->name('settings.bank-accounts.store');
        Route::patch('erp/settings/bank-accounts/{bankAccount}', [SettingsController::class, 'updateBankAccount'])->name('settings.bank-accounts.update');
        Route::delete('erp/settings/bank-accounts/{bankAccount}', [SettingsController::class, 'destroyBankAccount'])->name('settings.bank-accounts.destroy');
        Route::patch('erp/settings/bank-accounts/{bankAccount}/set-default', [SettingsController::class, 'setDefaultBankAccount'])->name('settings.bank-accounts.set-default');

        Route::get('purchase-bills', [PurchaseBillController::class, 'index'])->name('purchase-bills.index');
        Route::post('purchase-bills', [PurchaseBillController::class, 'store'])->name('purchase-bills.store');
        Route::patch('purchase-bills/{bill}', [PurchaseBillController::class, 'update'])->name('purchase-bills.update');
        Route::delete('purchase-bills/{bill}', [PurchaseBillController::class, 'destroy'])->name('purchase-bills.destroy');
    });

    Route::middleware(['role:rate-calculator.view'])->group(function () {
        Route::get('rate-calculator', [\App\Http\Controllers\RateCalculatorController::class, 'index'])->name('rate-calculator.index');
    });

    // In-app notifications (JSON API, no Inertia)
    Route::get('erp/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('erp/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
    Route::post('erp/notifications/{id}/read', [NotificationController::class, 'markRead'])->name('notifications.read');

    // Temporary debug route — remove after fixing notification issue
    Route::get('erp/debug/notify', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        if (! in_array($user->roles->first()?->slug, ['admin'])) {
            return response()->json(['error' => 'Admin only'], 403);
        }

        $order = \App\Models\Order::with('items')->latest()->first();
        if (! $order) return response()->json(['error' => 'No orders found']);

        $itemStatuses = $order->items->pluck('status')->toArray();
        $allReadyItems = $order->items->filter(fn($i) => in_array($i->status, ['ready','dispatched']))->count();

        $accountants = \App\Models\User::where('is_active', true)
            ->whereHas('roles', fn($q) => $q->where('slug', 'accountant'))
            ->get(['id','name','is_active']);

        $salesUsers = \App\Models\User::where('is_active', true)
            ->whereHas('roles', fn($q) => $q->where('slug', 'sales'))
            ->get(['id','name','is_active']);

        $allUsers = \App\Models\User::with('roles:id,slug,name')
            ->get(['id','name','is_active'])
            ->map(fn($u) => ['id'=>$u->id,'name'=>$u->name,'active'=>$u->is_active,'roles'=>$u->roles->pluck('slug')]);

        return response()->json([
            'latest_order'       => ['id'=>$order->id,'number'=>$order->order_number,'amount'=>$order->total_amount,'created_by'=>$order->created_by,'sales_user_id'=>$order->sales_user_id],
            'item_count'         => $order->items->count(),
            'item_statuses'      => $itemStatuses,
            'ready_count'        => $allReadyItems,
            'accountants_found'  => $accountants->toArray(),
            'sales_users_found'  => $salesUsers->toArray(),
            'all_users'          => $allUsers->toArray(),
            'notifications_total'=> \DB::table('notifications')->count(),
        ]);
    });

    Route::middleware(['role:finished-goods.manage'])->group(function () {
        Route::get('finished-goods', [FinishedGoodsController::class, 'index'])->name('finished-goods.index');
        Route::post('finished-goods', [FinishedGoodsController::class, 'store'])->name('finished-goods.store');
        Route::patch('finished-goods/{finishedGood}', [FinishedGoodsController::class, 'update'])->name('finished-goods.update');
        Route::delete('finished-goods/{finishedGood}', [FinishedGoodsController::class, 'destroy'])->name('finished-goods.destroy');

        Route::get('unit-transfer', [UnitTransferController::class, 'index'])->name('unit-transfer.index');
        Route::post('unit-transfer', [UnitTransferController::class, 'store'])->name('unit-transfer.store');
        Route::patch('unit-transfer/{unitTransfer}/status', [UnitTransferController::class, 'updateStatus'])->name('unit-transfer.status');
        Route::delete('unit-transfer/{unitTransfer}', [UnitTransferController::class, 'destroy'])->name('unit-transfer.destroy');
    });

    Route::middleware(['role:products.manage'])->group(function () {
        Route::get('products', [ProductController::class, 'index'])->name('products.index');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::patch('products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    });

    Route::middleware(['role:products.link_inventory'])->group(function () {
        Route::get('inventory-pools', [InventoryPoolController::class, 'index'])->name('inventory-pools.index');
        Route::post('inventory-pools', [InventoryPoolController::class, 'store'])->name('inventory-pools.store');
        Route::patch('inventory-pools/{inventoryPool}', [InventoryPoolController::class, 'update'])->name('inventory-pools.update');
        Route::delete('inventory-pools/{inventoryPool}', [InventoryPoolController::class, 'destroy'])->name('inventory-pools.destroy');
        Route::post('inventory-pools/link', [InventoryPoolController::class, 'link'])->name('inventory-pools.link');
        Route::delete('inventory-pools/links/{productInventoryLink}', [InventoryPoolController::class, 'unlink'])->name('inventory-pools.unlink');
    });

    Route::middleware(['role:design.manage'])->group(function () {
        Route::get('design', [DesignController::class, 'index'])->name('design.index');
        Route::post('design', [DesignController::class, 'store'])->name('design.store');
        Route::patch('design/{designOrder}', [DesignController::class, 'update'])->name('design.update');
        Route::post('design/{designOrder}/advance', [DesignController::class, 'advance'])->name('design.advance');
        Route::patch('design/{designOrder}/tracking', [DesignController::class, 'updateTracking'])->name('design.tracking');
        Route::delete('design/{designOrder}', [DesignController::class, 'destroy'])->name('design.destroy');
    });

    Route::middleware(['role:design.gallery.manage'])->group(function () {
        Route::get('design/gallery', [ProductPhotoController::class, 'index'])->name('design.gallery.index');
        Route::post('design/gallery/folders', [ProductPhotoController::class, 'storeFolder'])->name('design.gallery.folders.store');
        Route::post('design/gallery', [ProductPhotoController::class, 'store'])->name('design.gallery.store');
        Route::patch('design/gallery/{photo}', [ProductPhotoController::class, 'update'])->name('design.gallery.update');
        Route::delete('design/gallery/{photo}', [ProductPhotoController::class, 'destroy'])->name('design.gallery.destroy');
    });

    Route::middleware(['role:parties.manage'])->group(function () {
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

    // Suppliers/vendors — sales users should not see supplier records, only admin manages them.
    Route::middleware(['role:suppliers.manage'])->group(function () {
        Route::get('suppliers', [PartyController::class, 'suppliersIndex'])->name('suppliers.index');
        Route::post('parties/{party}/notify-supplier', [PartyController::class, 'notifySupplier'])->name('parties.notify-supplier');
    });

    Route::middleware(['role:party-ledger.view'])->group(function () {
        Route::get('party-ledger', [PartyController::class, 'ledgerIndex'])->name('parties.ledger.index');
        Route::get('party-ledger/{party}', [PartyController::class, 'ledger'])->name('parties.ledger');
        Route::get('party-ledger/{party}/print', [PartyController::class, 'ledgerPrint'])->name('parties.ledger.print');
    });
});

require __DIR__ . '/settings.php';
