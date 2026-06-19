<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order {{ $order->order_number }} — Unicrop Biochem</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1e293b;
            font-size: 13px;
            padding: 28px;
        }
        .toolbar {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-bottom: 16px;
        }
        .toolbar button {
            padding: 9px 18px;
            border-radius: 8px;
            border: none;
            background: #0f766e;
            color: #fff;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }
        .toolbar button.secondary {
            background: #fff;
            color: #0f766e;
            border: 1px solid #0f766e;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .brand h1 {
            font-size: 20px;
            color: #0f766e;
            letter-spacing: -0.3px;
        }
        .brand p {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
        }
        .order-meta {
            text-align: right;
        }
        .order-meta h2 {
            font-size: 16px;
            color: #1e293b;
        }
        .order-meta div {
            font-size: 12px;
            color: #475569;
            margin-top: 2px;
        }
        .badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 10px;
            border-radius: 20px;
            background: #f0fdf4;
            color: #15803d;
            border: 1px solid #86efac;
            text-transform: uppercase;
            margin-top: 4px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
        }
        .info-box {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
        }
        .info-box h3 {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #94a3b8;
            margin-bottom: 6px;
        }
        .info-box p {
            font-size: 13px;
            line-height: 1.6;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        th, td {
            border: 1px solid #e2e8f0;
            padding: 7px 10px;
            font-size: 12px;
            text-align: left;
        }
        th {
            background: #f0fdf4;
            color: #15803d;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.4px;
        }
        td.num, th.num { text-align: right; }
        .totals {
            display: flex;
            justify-content: flex-end;
        }
        .totals table {
            width: 320px;
        }
        .totals td {
            border: none;
            padding: 4px 10px;
        }
        .totals tr.grand td {
            border-top: 2px solid #0f766e;
            font-weight: 700;
            font-size: 14px;
            color: #0f766e;
            padding-top: 8px;
        }
        .notes {
            margin-top: 16px;
            font-size: 12px;
            color: #475569;
        }
        .payment-section {
            display: flex;
            gap: 14px;
            margin-top: 16px;
            align-items: stretch;
        }
        .payment-section .info-box {
            flex: 1;
        }
        .qr-box {
            text-align: center;
            max-width: 200px;
        }
        .qr-box img {
            width: 140px;
            height: 140px;
        }
        .qr-box p {
            font-size: 11px;
            color: #64748b;
            margin-top: 6px;
        }
        .footer {
            margin-top: 30px;
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
        }
        @media print {
            .toolbar { display: none; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="secondary" onclick="window.close()">Close</button>
        <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <div class="header">
        <div class="brand">
            <h1>Unicrop Biochem</h1>
            <p>Agrochemical Order Management Portal</p>
        </div>
        <div class="order-meta">
            <h2>Order {{ $order->order_number }}</h2>
            <div>Date: {{ $order->order_date?->format('d-m-Y') ?? '—' }}</div>
            @if($showPriority)
                <div>Priority: {{ ucfirst($order->priority ?? 'normal') }}</div>
            @endif
            <span class="badge">{{ ucfirst($order->status ?? '') }}</span>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-box">
            <h3>Bill To</h3>
            <p>
                <strong>{{ $order->company_name }}</strong><br>
                {{ $order->customer_name }}<br>
                @if($order->gst_no) GSTIN: {{ $order->gst_no }}<br> @endif
                @if($order->phone) Phone: {{ $order->phone }} @endif
            </p>
        </div>
        <div class="info-box">
            <h3>Shipping / Transport</h3>
            <p>
                @if($order->delivery_address) {{ $order->delivery_address }}<br> @endif
                @if($order->destination) Destination: {{ $order->destination }}<br> @endif
                @if($order->transport_name)
                    {{ ucfirst($order->transport_type ?? 'Transport') }}: {{ $order->transport_name }}
                @endif
            </p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Product</th>
                <th>Packing</th>
                <th class="num">Qty</th>
                <th class="num">Rate</th>
                <th class="num">Amount</th>
                <th class="num">GST %</th>
                <th class="num">GST Amt</th>
            </tr>
        </thead>
        <tbody>
            @foreach($order->items as $i => $item)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>
                        {{ $item->our_brand }}
                        @if($item->party_brand) <br><span style="color:#94a3b8;">({{ $item->party_brand }})</span> @endif
                    </td>
                    <td>{{ $item->packing_size ?? '—' }}</td>
                    <td class="num">{{ number_format((float) $item->quantity, 2) }}</td>
                    <td class="num">{{ number_format((float) $item->rate, 2) }}</td>
                    <td class="num">{{ number_format((float) $item->amount, 2) }}</td>
                    <td class="num">{{ number_format((float) $item->gst_percent, 2) }}</td>
                    <td class="num">{{ number_format((float) $item->gst_amount, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <table>
            <tr>
                <td>Subtotal</td>
                <td class="num">₹ {{ number_format((float) $order->subtotal, 2) }}</td>
            </tr>
            <tr>
                <td>GST Total</td>
                <td class="num">₹ {{ number_format((float) $order->gst_total, 2) }}</td>
            </tr>
            @if((float) $order->freight_amount > 0)
                <tr>
                    <td>Freight</td>
                    <td class="num">₹ {{ number_format((float) $order->freight_amount, 2) }}</td>
                </tr>
            @endif
            @if((float) $order->courier_amount > 0)
                <tr>
                    <td>Courier</td>
                    <td class="num">₹ {{ number_format((float) $order->courier_amount, 2) }}</td>
                </tr>
            @endif
            @if((float) $order->round_off != 0)
                <tr>
                    <td>Round Off</td>
                    <td class="num">₹ {{ number_format((float) $order->round_off, 2) }}</td>
                </tr>
            @endif
            <tr class="grand">
                <td>Grand Total</td>
                <td class="num">₹ {{ number_format((float) $order->total_amount, 2) }}</td>
            </tr>
            @if($previousDue > 0)
                <tr>
                    <td>Previous Due</td>
                    <td class="num">₹ {{ number_format($previousDue, 2) }}</td>
                </tr>
                <tr class="grand">
                    <td>Total Incl. Previous Due</td>
                    <td class="num">₹ {{ number_format((float) $order->total_amount + $previousDue, 2) }}</td>
                </tr>
            @endif
        </table>
    </div>

    @if($bankAccounts->isNotEmpty())
        @php
            $upiAccount = $bankAccounts->first(fn ($bank) => ! empty($bank->upi_id));
            $payAmount = (float) $order->total_amount + ($previousDue > 0 ? $previousDue : 0);
            $upiUri = $upiAccount
                ? 'upi://pay?pa='.rawurlencode($upiAccount->upi_id).'&pn='.rawurlencode('Unicrop Biochem').'&am='.rawurlencode(number_format($payAmount, 2, '.', '')).'&cu=INR&tn='.rawurlencode('Order '.$order->order_number)
                : null;
        @endphp
        <div class="payment-section">
            <div class="info-box">
                <h3>Bank Details</h3>
                @foreach($bankAccounts as $bank)
                    <p style="margin-bottom: {{ $loop->last ? 0 : 8 }}px;">
                        <strong>{{ $bank->name }}</strong>@if($bank->bank_name) — {{ $bank->bank_name }} @endif<br>
                        A/C No: {{ $bank->account_number }}<br>
                        IFSC: {{ $bank->ifsc }}
                        @if($bank->upi_id) <br>UPI: {{ $bank->upi_id }} @endif
                    </p>
                @endforeach
            </div>
            @if($upiUri)
                <div class="info-box qr-box">
                    <h3>Scan &amp; Pay via UPI</h3>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data={{ urlencode($upiUri) }}" alt="UPI QR Code">
                    <p>Pay ₹{{ number_format($payAmount, 2) }} to {{ $upiAccount->upi_id }}</p>
                </div>
            @endif
        </div>
    @endif

    @if($order->notes)
        <div class="notes">
            <strong>Notes:</strong> {{ $order->notes }}
        </div>
    @endif

    <div class="footer">
        Generated on {{ now()->format('d-m-Y H:i') }} — Unicrop Biochem ERP
    </div>
</body>
</html>
