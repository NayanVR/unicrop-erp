<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\RawMaterial;
use Inertia\Inertia;
use Inertia\Response;

class RateCalculatorController extends Controller
{
    public const PACKAGING_CATEGORIES = [
        'Bottle', 'Jar', 'Box/Carton', 'Printed Box', 'Label', 'Drum', 'Pouch', 'Cap/Closure',
    ];

    public function index(): Response
    {
        $materials = RawMaterial::query()
            ->where('is_active', true)
            ->whereIn('category', self::PACKAGING_CATEGORIES)
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
