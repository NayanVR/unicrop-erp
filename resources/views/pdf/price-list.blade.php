@php
    /**
     * Mirrors the printed Unicrop price list: a cover sheet, then one table
     * per section with the orange column band, a product row per product and
     * its pack sizes stacked inside the cells.
     */
    $green  = '#1b7a4b';
    $teal   = '#0f6e63';
    $orange = '#f6b26b';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $settings['price_list_title'] }}</title>
    <style>
        @page { margin: 14mm 11mm 16mm 11mm; }

        body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #1f2937; margin: 0; }
        table { border-collapse: collapse; }

        /* ── Cover ───────────────────────────────────────────────── */
        .cover { text-align: center; padding-top: 55px; }
        .cover .mark { width: 92px; height: 92px; }
        .cover .brand { font-size: 40px; font-weight: bold; color: {{ $green }}; letter-spacing: -.5px; }
        .cover .brand small { display: block; font-size: 19px; letter-spacing: 3px; }
        .cover .tagline { margin-top: 34px; font-size: 13px; font-weight: bold; color: {{ $teal }}; }
        .cover .title {
            margin-top: 14px; font-size: 31px; font-weight: bold; color: {{ $green }};
            line-height: 1.22; text-transform: uppercase;
        }
        .cover .strap { margin-top: 20px; font-size: 16px; font-weight: bold; color: {{ $teal }}; line-height: 1.5; }
        .cover .ribbon {
            margin-top: 40px; padding: 9px 6px; font-size: 9px; font-weight: bold;
            color: {{ $teal }}; letter-spacing: .4px;
            border-top: 2px solid {{ $orange }}; border-bottom: 2px solid {{ $orange }};
        }
        .cover .for { margin-top: 30px; font-size: 12px; color: #374151; }
        .cover .for strong { color: {{ $green }}; }

        /* ── Page letterhead ─────────────────────────────────────── */
        .sheet-head { width: 100%; margin-bottom: 12px; }
        .sheet-head td { vertical-align: top; border: none; padding: 0; }
        .sheet-head .mark { width: 52px; height: 52px; }
        .sheet-head .name { font-size: 17px; font-weight: bold; color: {{ $green }}; line-height: 1.1; }
        .sheet-head .name small { display: block; font-size: 9px; letter-spacing: 2px; }
        .sheet-head .rule { border-left: 2px solid {{ $teal }}; padding-left: 10px; }
        .sheet-head .line { font-size: 8.5px; color: #374151; line-height: 1.5; }
        .sheet-head .line b { color: {{ $teal }}; }

        .section-title {
            text-align: center; font-size: 16px; font-weight: bold;
            color: {{ $teal }}; text-transform: uppercase;
            margin: 10px 0 8px 0;
        }

        /* ── Price table ─────────────────────────────────────────── */
        table.price { width: 100%; }
        table.price th {
            background: {{ $orange }}; color: #1f2937;
            font-size: 8.5px; font-weight: bold; text-transform: uppercase;
            padding: 7px 4px; border: 1px solid #e2a65b; text-align: center;
        }
        table.price td { border: 1px solid #9ca3af; padding: 5px 6px; vertical-align: middle; }

        .c-sr   { width: 6%;  text-align: center; font-weight: bold; }
        .c-pack { width: 13%; text-align: center; font-weight: bold; }
        .c-mrp  { width: 12%; text-align: center; font-weight: bold; }
        .c-rate { width: 12%; text-align: center; font-weight: bold; }
        .c-box  { width: 11%; text-align: center; font-weight: bold; }
        .c-gst  { width: 9%;  text-align: center; font-weight: bold; }

        .prod { text-align: center; line-height: 1.45; }
        .prod .pname { font-weight: bold; font-size: 10px; }
        .prod .pdesc { font-size: 8.5px; color: #374151; }

        .stack { line-height: 1.6; }

        .foot {
            margin-top: 14px; padding-top: 7px; border-top: 1px solid #d1d5db;
            font-size: 8px; color: #6b7280; text-align: center;
        }
        .empty { padding: 26px; text-align: center; color: #6b7280; border: 1px solid #9ca3af; }
    </style>
</head>
<body>

{{-- ── Cover ──────────────────────────────────────────────────── --}}
<div class="cover">
    @if ($logo)
        <img class="mark" src="{{ $logo }}" alt="">
    @endif

    <div class="brand">
        {{ $settings['company'] }}
    </div>

    @if ($settings['price_list_tagline'] !== '')
        <div class="tagline">{{ $settings['price_list_tagline'] }}</div>
    @endif

    <div class="title">{{ $settings['price_list_title'] }}</div>

    @if ($settings['price_list_strapline'] !== '')
        <div class="strap">{!! nl2br(e($settings['price_list_strapline'])) !!}</div>
    @endif

    @if ($settings['price_list_ribbon'] !== '')
        <div class="ribbon">{{ $settings['price_list_ribbon'] }}</div>
    @endif

    <div class="for">
        {{ $date }}
        @if ($for !== '')
            <br><strong>Prepared for: {{ $for }}</strong>
        @endif
    </div>
</div>

@php
    $tables = [];
    foreach ($sections as $title => $rows) { $tables[] = [$title, $rows, false]; }
    foreach ($bulk as $title => $rows)     { $tables[] = [$title.' (Bulk)', $rows, true]; }
@endphp

@forelse ($tables as [$title, $rows, $isBulk])
    <div style="page-break-before: always;"></div>

    <table class="sheet-head">
        <tr>
            @if ($logo)
                <td style="width: 60px;"><img class="mark" src="{{ $logo }}" alt=""></td>
            @endif
            <td style="width: 200px;">
                <div class="name">{{ $settings['company'] }}</div>
            </td>
            <td class="rule">
                <div class="line">
                    @if ($settings['price_list_email'] !== '')
                        <b>✉</b> {{ $settings['price_list_email'] }}
                    @endif
                    @if ($settings['price_list_phone'] !== '')
                        &nbsp;&nbsp;<b>☎</b> {{ $settings['price_list_phone'] }}
                    @endif
                    @if ($settings['price_list_plants'] !== '')
                        <br>{!! nl2br(e($settings['price_list_plants'])) !!}
                    @endif
                </div>
            </td>
        </tr>
    </table>

    <div class="section-title">{{ $title }}</div>

    <table class="price">
        <thead>
            <tr>
                <th class="c-sr">Sr.<br>No.</th>
                <th>Products</th>
                <th class="c-pack">Packaging</th>
                @unless ($isBulk)
                    <th class="c-mrp">M.R.P.</th>
                @endunless
                <th class="c-rate">Rate</th>
                @unless ($isBulk)
                    <th class="c-box">Qty<br>per Box</th>
                @endunless
                <th class="c-gst">GST %</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $i => $item)
                <tr>
                    <td class="c-sr">{{ $i + 1 }}.</td>
                    <td class="prod">
                        <div class="pname">{{ $item->name }}</div>
                        @if ($item->description)
                            <div class="pdesc">{{ $item->description }}</div>
                        @endif
                    </td>
                    <td class="c-pack stack">
                        @foreach ($item->packings as $p)
                            {!! nl2br(e($p->packing)) !!}@if (! $loop->last)<br>@endif
                        @endforeach
                    </td>
                    @unless ($isBulk)
                        <td class="c-mrp stack">
                            @foreach ($item->packings as $p)
                                {{ $p->mrp !== null ? rtrim(rtrim(number_format((float) $p->mrp, 2, '.', ''), '0'), '.') : '—' }}@if (! $loop->last)<br>@endif
                            @endforeach
                        </td>
                    @endunless
                    <td class="c-rate stack">
                        @foreach ($item->packings as $p)
                            {{ rtrim(rtrim(number_format($p->liveRate(), 2, '.', ''), '0'), '.') }}@if (! $loop->last)<br>@endif
                        @endforeach
                    </td>
                    @unless ($isBulk)
                        <td class="c-box stack">
                            @foreach ($item->packings as $p)
                                {{ $p->qty_per_box ?? '—' }}@if (! $loop->last)<br>@endif
                            @endforeach
                        </td>
                    @endunless
                    <td class="c-gst">{{ rtrim(rtrim(number_format((float) $item->gst_percent, 2), '0'), '.') }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="foot">{{ $settings['price_list_website'] }}</div>
@empty
    <div style="page-break-before: always;"></div>
    <div class="empty">Nothing priced on the list yet.</div>
@endforelse

</body>
</html>
