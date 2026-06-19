<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ledger — {{ $party->name }} — Unicrop Biochem</title>
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
        .party-meta {
            text-align: right;
        }
        .party-meta h2 {
            font-size: 16px;
            color: #1e293b;
        }
        .party-meta div {
            font-size: 12px;
            color: #475569;
            margin-top: 2px;
        }
        .summary {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
        }
        .summary-box {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
        }
        .summary-box h3 {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #94a3b8;
            margin-bottom: 6px;
        }
        .summary-box p {
            font-size: 16px;
            font-weight: 700;
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
        <div class="party-meta">
            <h2>Party Ledger</h2>
            <div><strong>{{ $party->name }}</strong></div>
            @if($party->customer_name) <div>{{ $party->customer_name }}</div> @endif
            @if($party->gst_no) <div>GSTIN: {{ $party->gst_no }}</div> @endif
            @if($party->phone) <div>{{ $party->phone }}</div> @endif
        </div>
    </div>

    <div class="summary">
        <div class="summary-box">
            <h3>Total Invoiced</h3>
            <p>₹ {{ number_format($summary['total_invoiced'], 2) }}</p>
        </div>
        <div class="summary-box">
            <h3>Total Received</h3>
            <p>₹ {{ number_format($summary['total_received'], 2) }}</p>
        </div>
        <div class="summary-box">
            <h3>Balance Due</h3>
            <p>₹ {{ number_format($summary['balance_due'], 2) }}</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Description</th>
                <th class="num">Debit</th>
                <th class="num">Credit</th>
                <th class="num">Balance</th>
            </tr>
        </thead>
        <tbody>
            @forelse($entries as $entry)
                <tr>
                    <td>{{ $entry['date'] }}</td>
                    <td>{{ $entry['description'] }}</td>
                    <td class="num">{{ $entry['debit'] ? number_format($entry['debit'], 2) : '' }}</td>
                    <td class="num">{{ $entry['credit'] ? number_format($entry['credit'], 2) : '' }}</td>
                    <td class="num">{{ number_format($entry['balance'], 2) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" style="text-align:center;color:#94a3b8;">No ledger entries yet.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Generated on {{ now()->format('d-m-Y H:i') }} — Unicrop Biochem ERP
    </div>
</body>
</html>
