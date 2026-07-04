<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\BankAccount;
use App\Models\PackingSize;
use App\Models\Transport;
use App\Services\LowStockAlertService;
use App\Services\PaymentReminderService;
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

        $reminderKeys = [
            'reminder_enabled', 'reminder_days', 'reminder_channel', 'reminder_message',
        ];

        $reminderSettings = [];
        foreach ($reminderKeys as $key) {
            $reminderSettings[$key] = AppSetting::get($key, '');
        }
        $reminderSettings['reminder_enabled'] = AppSetting::get('reminder_enabled', '0');
        if ($reminderSettings['reminder_days'] === '') {
            $reminderSettings['reminder_days'] = '7';
        }
        if ($reminderSettings['reminder_channel'] === '') {
            $reminderSettings['reminder_channel'] = 'whatsapp';
        }
        if ($reminderSettings['reminder_message'] === '') {
            $reminderSettings['reminder_message'] = 'Dear {customer_name}, your order {order_number} from Unicrop Biochem was confirmed {days} days ago. Kindly clear the pending payment of ₹{amount}. Thank you.';
        }

        return Inertia::render('erp/settings/index', [
            'pageTitle'        => 'Settings',
            'transports'       => Transport::query()->orderBy('type')->orderBy('name')->get(),
            'alertSettings'    => $alertSettings,
            'reminderSettings' => $reminderSettings,
            'packingSizes'     => PackingSize::query()->orderBy('name')->get(),
            'bankAccounts'     => BankAccount::query()->orderBy('name')->get(),
        ]);
    }

    public function storePackingSize(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:50|unique:packing_sizes,name',
            'multiplier'     => 'required|numeric|min:0.001|max:999999',
            'pieces_per_box' => 'nullable|integer|min:1|max:999999',
            'pack_unit'      => 'nullable|string|in:box,bag,carba',
        ]);

        PackingSize::create($data);

        return redirect()->back()->with('success', 'Packing size added.');
    }

    public function updatePackingSize(Request $request, PackingSize $packingSize): RedirectResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:50|unique:packing_sizes,name,' . $packingSize->id,
            'multiplier'     => 'required|numeric|min:0.001|max:999999',
            'pieces_per_box' => 'nullable|integer|min:1|max:999999',
            'pack_unit'      => 'nullable|string|in:box,bag,carba',
        ]);

        $packingSize->update($data);

        return redirect()->back()->with('success', 'Packing size updated.');
    }

    public function destroyPackingSize(PackingSize $packingSize): RedirectResponse
    {
        $packingSize->delete();

        return redirect()->back()->with('success', 'Packing size deleted.');
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

    public function updateReminderSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'reminder_enabled' => 'boolean',
            'reminder_days'    => 'nullable|integer|min:1|max:365',
            'reminder_channel' => 'nullable|in:sms,whatsapp,both',
            'reminder_message' => 'nullable|string|max:1000',
        ]);

        $data['reminder_enabled'] = isset($data['reminder_enabled']) && $data['reminder_enabled'] ? '1' : '0';

        AppSetting::setMany($data);

        return redirect()->back()->with('success', 'Reminder settings saved.');
    }

    public function testReminder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => 'required|string|max:20',
        ]);

        $service = new PaymentReminderService();
        $result  = $service->sendTest($data['phone']);

        return response()->json($result);
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

    public function storeBankAccount(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:255',
            'bank_name'      => 'nullable|string|max:255',
            'account_number' => 'nullable|string|max:50',
            'ifsc'           => 'nullable|string|max:20',
            'upi_id'         => 'nullable|string|max:100',
        ]);

        BankAccount::create($data);

        return redirect()->back()->with('success', 'Bank account added.');
    }

    public function updateBankAccount(Request $request, BankAccount $bankAccount): RedirectResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:255',
            'bank_name'      => 'nullable|string|max:255',
            'account_number' => 'nullable|string|max:50',
            'ifsc'           => 'nullable|string|max:20',
            'upi_id'         => 'nullable|string|max:100',
            'is_active'      => 'boolean',
        ]);

        $bankAccount->update($data);

        return redirect()->back()->with('success', 'Bank account updated.');
    }

    public function destroyBankAccount(BankAccount $bankAccount): RedirectResponse
    {
        $bankAccount->delete();

        return redirect()->back()->with('success', 'Bank account deleted.');
    }

    public function setDefaultBankAccount(BankAccount $bankAccount): RedirectResponse
    {
        BankAccount::where('is_default', true)->update(['is_default' => false]);
        $bankAccount->update(['is_default' => true]);

        return redirect()->back()->with('success', 'Default bank account updated.');
    }
}
