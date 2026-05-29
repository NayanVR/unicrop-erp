<?php

use App\Http\Controllers\BomRecipeController;
use App\Http\Controllers\InventoryController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    // BOM Recipes
    Route::get('/bom',                    [BomRecipeController::class, 'index']);
    Route::post('/bom',                   [BomRecipeController::class, 'store']);
    Route::put('/bom/{id}',               [BomRecipeController::class, 'update']);
    Route::delete('/bom/{id}',            [BomRecipeController::class, 'destroy']);
    Route::post('/bom/{id}/duplicate',    [BomRecipeController::class, 'duplicate']);
    Route::post('/bom/{id}/run',          [BomRecipeController::class, 'run']);

    // Inventory search for ingredient autocomplete
    Route::get('/inventory/search',       [InventoryController::class, 'search']);
});
