<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\RawMaterial;
use Inertia\Inertia;
use Inertia\Response;

class RateCalculatorController extends Controller
{
    public function index(): Response
    {
        // Send all active materials; the page classifies them by category
        // keywords so renamed categories (e.g. "Box/Carton" -> "Box") still work.
        $materials = RawMaterial::query()
            ->where('is_active', true)
            ->orderBy('category')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'unit', 'cost_per_unit']);

        return Inertia::render('erp/rate-calculator/index', [
            'pageTitle'          => 'Product Rate Calculator',
            'packagingMaterials' => $materials,
            'marginPercent'      => (float) AppSetting::get('rate_calc_margin_percent', 20),
        ]);
    }
}
