<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\Product;
use App\Models\Transport;
use App\Services\LowStockAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        $alertKeys = [
            'alert_enabled', 'alert_provider', 'alert_phone_numbers',
            'alert_twilio_sid', 'alert_twilio_token', 'alert_twilio_from', 'alert_twilio_channel',
            'alert_msg91_authkey', 'alert_msg91_sender', 'alert_msg91_template_id',
            'alert_cooldown_hours',
        ];

        $alertSettings = [];
        foreach ($alertKeys as $key) {
            $alertSettings[$key] = AppSetting::get($key, '');
        }
        // ensure boolean strings are consistent
        $alertSettings['alert_enabled'] = AppSetting::get('alert_enabled', '0');

        return Inertia::render('erp/settings/index', [
            'pageTitle'           => 'Settings',
            'products'            => Product::query()->orderBy('name')->get(),
            'transports'          => Transport::query()->orderBy('type')->orderBy('name')->get(),
            'alertSettings'       => $alertSettings,
            'rateCalcMarginPercent' => (float) AppSetting::get('rate_calc_margin_percent', 20),
        ]);
    }

    public function updateRateCalculatorSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'rate_calc_margin_percent' => 'required|numeric|min:0|max:1000',
        ]);

        AppSetting::set('rate_calc_margin_percent', (string) $data['rate_calc_margin_percent']);

        return redirect()->back()->with('success', 'Product Rate Calculator settings saved.');
    }

    public function updateAlertSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'alert_enabled'           => 'boolean',
            'alert_provider'          => 'required|in:twilio,msg91',
            'alert_phone_numbers'     => 'nullable|string|max:500',
            'alert_twilio_sid'        => 'nullable|string|max:255',
            'alert_twilio_token'      => 'nullable|string|max:255',
            'alert_twilio_from'       => 'nullable|string|max:50',
            'alert_twilio_channel'    => 'nullable|in:sms,whatsapp,both',
            'alert_msg91_authkey'     => 'nullable|string|max:255',
            'alert_msg91_sender'      => 'nullable|string|max:20',
            'alert_msg91_template_id' => 'nullable|string|max:100',
            'alert_cooldown_hours'    => 'nullable|integer|min:1|max:168',
        ]);

        $data['alert_enabled'] = isset($data['alert_enabled']) && $data['alert_enabled'] ? '1' : '0';

        AppSetting::setMany($data);

        return redirect()->back()->with('success', 'Alert settings saved.');
    }

    public function testAlert(Request $request): JsonResponse
    {
        $service = new LowStockAlertService();
        $result  = $service->sendTest("🧪 Test alert from UniCrop ERP — your low stock alerts are working!");

        return response()->json($result);
    }

    public function storeProduct(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'hsn_code' => 'nullable|string|max:20',
            'gst_percent' => 'required|numeric|min:0|max:100',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        Product::create($data);

        return redirect()->back()->with('success', 'Product added.');
    }

    public function updateProduct(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'hsn_code' => 'nullable|string|max:20',
            'gst_percent' => 'required|numeric|min:0|max:100',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
            'is_active' => 'boolean',
        ]);

        $product->update($data);

        return redirect()->back()->with('success', 'Product updated.');
    }

    public function destroyProduct(Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()->back()->with('success', 'Product deleted.');
    }

    public function storeTransport(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:transport,courier',
        ]);

        Transport::create($data);

        return redirect()->back()->with('success', ucfirst($data['type']).' added.');
    }

    public function updateTransport(Request $request, Transport $transport): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:transport,courier',
        ]);

        $transport->update($data);

        return redirect()->back()->with('success', ucfirst($data['type']).' updated.');
    }

    public function destroyTransport(Transport $transport): RedirectResponse
    {
        $transport->delete();

        return redirect()->back()->with('success', 'Deleted.');
    }
}
