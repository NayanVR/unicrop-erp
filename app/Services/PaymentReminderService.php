<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\Order;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentReminderService
{
    public function sendReminders(): void
    {
        if (AppSetting::get('reminder_enabled', '0') !== '1') {
            return;
        }

        $days        = (int) AppSetting::get('reminder_days', '7');
        $targetDate  = Carbon::today()->subDays($days)->toDateString();

        $orders = Order::where('status', 'confirmed')
            ->whereNotNull('confirmed_at')
            ->whereDate('confirmed_at', $targetDate)
            ->get();

        if ($orders->isEmpty()) {
            Log::info("PaymentReminderService: no confirmed orders found with confirmed_at = {$targetDate}");
            return;
        }

        foreach ($orders as $order) {
            if (empty($order->phone)) {
                Log::info("PaymentReminderService: skipping order #{$order->order_number} — no phone number.");
                continue;
            }

            $message = $this->buildMessage($order, $days);

            try {
                $this->sendToPhone($order->phone, $message);
                Log::info("PaymentReminderService: sent reminder for order #{$order->order_number} to {$order->phone}");
            } catch (\Throwable $e) {
                Log::error("PaymentReminderService: failed for order #{$order->order_number}: " . $e->getMessage());
            }
        }
    }

    public function sendTest(string $phone): array
    {
        $message = AppSetting::get(
            'reminder_message',
            'Dear {customer_name}, your order {order_number} from Unicrop Biochem was confirmed {days} days ago. Kindly clear the pending payment of ₹{amount}. Thank you.'
        );

        // Replace placeholders with sample values for test
        $message = str_replace(
            ['{customer_name}', '{order_number}', '{company_name}', '{days}', '{amount}'],
            ['Test Customer', 'ORD-0001', 'Unicrop Biochem', '7', '10,000'],
            $message
        );

        try {
            $result = $this->sendToPhone($phone, $message);
            return ['ok' => true, 'detail' => $result];
        } catch (\Throwable $e) {
            return ['ok' => false, 'detail' => $e->getMessage()];
        }
    }

    private function buildMessage(Order $order, int $days): string
    {
        $template = AppSetting::get(
            'reminder_message',
            'Dear {customer_name}, your order {order_number} from Unicrop Biochem was confirmed {days} days ago. Kindly clear the pending payment of ₹{amount}. Thank you.'
        );

        $amount = number_format((float) ($order->total_amount ?? 0), 2, '.', ',');

        return str_replace(
            ['{customer_name}', '{order_number}', '{company_name}', '{days}', '{amount}'],
            [$order->customer_name ?? '', $order->order_number ?? '', $order->company_name ?? '', $days, $amount],
            $template
        );
    }

    private function sendToPhone(string $phone, string $message): string
    {
        $sid     = AppSetting::get('alert_twilio_sid');
        $token   = AppSetting::get('alert_twilio_token');
        $from    = AppSetting::get('alert_twilio_from');
        $channel = AppSetting::get('reminder_channel', 'whatsapp');

        if (!$sid || !$token || !$from) {
            throw new \RuntimeException('Twilio credentials are not configured.');
        }

        $phone = $this->normalizePhone($phone);

        $results = [];

        if (in_array($channel, ['whatsapp', 'both'])) {
            $results[] = $this->twilioSend($sid, $token, "whatsapp:{$from}", "whatsapp:{$phone}", $message);
        }

        if (in_array($channel, ['sms', 'both'])) {
            $results[] = $this->twilioSend($sid, $token, $from, $phone, $message);
        }

        return implode('; ', $results);
    }

    private function twilioSend(string $sid, string $token, string $from, string $to, string $body): string
    {
        $response = Http::withBasicAuth($sid, $token)
            ->asForm()
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                'From' => $from,
                'To'   => $to,
                'Body' => $body,
            ]);

        if (!$response->successful()) {
            $err = $response->json('message') ?? $response->body();
            throw new \RuntimeException("Twilio error: {$err}");
        }

        return $response->json('sid') ?? 'sent';
    }

    private function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/\s+/', '', $phone);

        if (str_starts_with($phone, '+')) {
            return $phone;
        }

        if (str_starts_with($phone, '0')) {
            return '+91' . substr($phone, 1);
        }

        if (strlen($phone) === 10) {
            return '+91' . $phone;
        }

        return '+' . $phone;
    }
}
