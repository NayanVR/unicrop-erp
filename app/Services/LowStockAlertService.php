<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\RawMaterial;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LowStockAlertService
{
    public function checkAndAlert(RawMaterial $material): void
    {
        if (AppSetting::get('alert_enabled', '0') !== '1') {
            return;
        }

        $stock    = (float) $material->stock_qty;
        $minStock = (float) ($material->min_stock ?? 0);

        if ($stock > $minStock) {
            return;
        }

        $cooldownHours = (int) AppSetting::get('alert_cooldown_hours', '6');
        $cacheKey      = "low_stock_alert_{$material->id}";

        if (Cache::has($cacheKey)) {
            return;
        }

        Cache::put($cacheKey, true, now()->addHours($cooldownHours));

        $message = $this->formatMessage($material);

        try {
            $this->dispatch($message);
        } catch (\Throwable $e) {
            Log::error("LowStockAlertService error for material #{$material->id}: " . $e->getMessage());
        }
    }

    public function sendTest(string $message): array
    {
        try {
            $result = $this->dispatch($message);
            return ['ok' => true, 'detail' => $result];
        } catch (\Throwable $e) {
            return ['ok' => false, 'detail' => $e->getMessage()];
        }
    }

    private function formatMessage(RawMaterial $material): string
    {
        $stock    = round((float) $material->stock_qty, 2);
        $minStock = round((float) ($material->min_stock ?? 0), 2);
        $unit     = $material->unit ?? '';

        return "🚨 Low Stock Alert - UniCrop ERP\n"
            . "Material: {$material->name}\n"
            . "Current Stock: {$stock} {$unit}\n"
            . "Min Stock: {$minStock} {$unit}\n"
            . "Please arrange production/purchase immediately.";
    }

    private function dispatch(string $message): string
    {
        $provider = AppSetting::get('alert_provider', 'twilio');
        $phones   = array_filter(array_map('trim', explode(',', AppSetting::get('alert_phone_numbers', ''))));

        if (empty($phones)) {
            throw new \RuntimeException('No phone numbers configured.');
        }

        return match ($provider) {
            'twilio'  => $this->sendViaTwilio($message, $phones),
            'msg91'   => $this->sendViaMSG91($message, $phones),
            default   => throw new \RuntimeException("Unknown provider: {$provider}"),
        };
    }

    // ── Twilio ─────────────────────────────────────────────────────────────

    private function sendViaTwilio(string $message, array $phones): string
    {
        $sid     = AppSetting::get('alert_twilio_sid');
        $token   = AppSetting::get('alert_twilio_token');
        $from    = AppSetting::get('alert_twilio_from');
        $channel = AppSetting::get('alert_twilio_channel', 'sms');

        if (!$sid || !$token || !$from) {
            throw new \RuntimeException('Twilio credentials are not configured.');
        }

        $results = [];

        foreach ($phones as $phone) {
            $phone = $this->normalizePhone($phone);

            if (in_array($channel, ['whatsapp', 'both'])) {
                $results[] = $this->twilioSend($sid, $token, "whatsapp:{$from}", "whatsapp:{$phone}", $message);
            }

            if (in_array($channel, ['sms', 'both'])) {
                $results[] = $this->twilioSend($sid, $token, $from, $phone, $message);
            }
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

    // ── MSG91 ──────────────────────────────────────────────────────────────

    private function sendViaMSG91(string $message, array $phones): string
    {
        $authKey    = AppSetting::get('alert_msg91_authkey');
        $senderId   = AppSetting::get('alert_msg91_sender', 'UNICRP');
        $templateId = AppSetting::get('alert_msg91_template_id');

        if (!$authKey) {
            throw new \RuntimeException('MSG91 auth key is not configured.');
        }

        $mobiles = implode(',', array_map(
            fn ($p) => ltrim($this->normalizePhone($p), '+'),
            $phones
        ));

        $payload = [
            'sender'    => $senderId,
            'route'     => '4',
            'country'   => '91',
            'sms'       => [
                [
                    'message' => $message,
                    'to'      => explode(',', $mobiles),
                ],
            ],
        ];

        if ($templateId) {
            $payload['template_id'] = $templateId;
        }

        $response = Http::withHeaders(['authkey' => $authKey])
            ->post('https://api.msg91.com/api/v5/sms', $payload);

        if (!$response->successful()) {
            $err = $response->json('message') ?? $response->body();
            throw new \RuntimeException("MSG91 error: {$err}");
        }

        return $response->json('request_id') ?? 'sent';
    }

    // ── helpers ────────────────────────────────────────────────────────────

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
