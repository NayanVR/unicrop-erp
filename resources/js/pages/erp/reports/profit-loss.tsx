import { Head, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type Row = {
    month: number;
    our_brand: string;
    packing_size: string;
    qty: number;
    sales: number;
};

type PageProps = {
    rows: Row[];
    costs: Record<string, number>;
    years: number[];
    year: number;
    [key: string]: unknown;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtMoney = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtQty = (n: number) =>
    n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const productKey = (r: Pick<Row, 'our_brand' | 'packing_size'>) =>
    `${r.our_brand.toLowerCase()}|${r.packing_size.toLowerCase()}`;

export default function ProfitLoss() {
    const { rows, costs, years, year } = usePage<PageProps>().props;
    const [month, setMonth] = useState<number | 'all'>('all');

    const filtered = useMemo(
        () => (month === 'all' ? rows : rows.filter((r) => r.month === month)),
        [rows, month],
    );

    // Per-product aggregation for the selected month range
    const products = useMemo(() => {
        const map = new Map<string, { our_brand: string; packing_size: string; qty: number; sales: number; cost: number | null }>();
        for (const r of filtered) {
            const key = productKey(r);
            const entry = map.get(key) ?? { our_brand: r.our_brand, packing_size: r.packing_size, qty: 0, sales: 0, cost: costs[key] ?? null };
            entry.qty += r.qty;
            entry.sales += r.sales;
            map.set(key, entry);
        }
        return [...map.values()].sort((a, b) => b.sales - a.sales);
    }, [filtered, costs]);

    // Per-month aggregation across the whole year
    const monthly = useMemo(() => {
        const result = MONTHS.map((label, i) => ({ month: i + 1, label, qty: 0, sales: 0, cost: 0, hasUnknownCost: false }));
        for (const r of rows) {
            const m = result[r.month - 1];
            if (!m) continue;
            m.qty += r.qty;
            m.sales += r.sales;
            const c = costs[productKey(r)];
            if (c != null) m.cost += r.qty * c;
            else m.hasUnknownCost = true;
        }
        return result;
    }, [rows, costs]);

    const totals = useMemo(() => {
        let sales = 0, qty = 0, cost = 0, unknown = 0;
        for (const p of products) {
            sales += p.sales;
            qty += p.qty;
            if (p.cost != null) cost += p.qty * p.cost;
            else unknown++;
        }
        return { sales, qty, cost, profit: sales - cost, unknown };
    }, [products]);

    const margin = totals.sales > 0 ? ((totals.profit / totals.sales) * 100).toFixed(1) : '0.0';

    const changeYear = (y: number) => {
        router.get('/reports/profit-loss', { year: y }, { preserveState: false });
    };

    return (
        <>
            <Head title="Profit / Loss" />

            <div className="page-header">
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--tx-muted)', fontWeight: 600 }}>Year</span>
                    <select
                        style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--tx-head)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                        value={year}
                        onChange={(e) => changeYear(Number(e.target.value))}
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card c-sky">
                    <div className="stat-value">{fmtMoney(totals.sales)}</div>
                    <div className="stat-label">Total Sales (ex-GST){month !== 'all' ? ` — ${MONTHS[month - 1]}` : ''}</div>
                </div>
                <div className="stat-card c-amber">
                    <div className="stat-value">{fmtMoney(totals.cost)}</div>
                    <div className="stat-label">Total Cost{totals.unknown > 0 ? ` (${totals.unknown} product cost missing)` : ''}</div>
                </div>
                <div className={`stat-card ${totals.profit >= 0 ? 'c-green' : 'c-amber'}`}>
                    <div className="stat-value" style={{ color: totals.profit >= 0 ? '#059669' : '#dc2626' }}>
                        {fmtMoney(totals.profit)}
                    </div>
                    <div className="stat-label">{totals.profit >= 0 ? 'Profit' : 'Loss'} ({margin}%)</div>
                </div>
                <div className="stat-card c-slate">
                    <div className="stat-value">{fmtQty(totals.qty)}</div>
                    <div className="stat-label">Units Sold</div>
                </div>
            </div>

            <div className="card">
                <div className="card-title">
                    Product-wise Profit
                    <span className="ct-badge">{year}{month !== 'all' ? ` · ${MONTHS[month - 1]}` : ' · Full Year'}</span>
                </div>

                <div className="filter-tabs" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
                    <button
                        className={`filter-tab${month === 'all' ? ' active' : ''}`}
                        onClick={() => setMonth('all')}
                    >
                        All
                    </button>
                    {MONTHS.map((label, i) => (
                        <button
                            key={label}
                            className={`filter-tab${month === i + 1 ? ' active' : ''}`}
                            onClick={() => setMonth(i + 1)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Packing</th>
                            <th style={{ textAlign: 'right' }}>Qty Sold</th>
                            <th style={{ textAlign: 'right' }}>Sales (ex-GST)</th>
                            <th style={{ textAlign: 'right' }}>Cost / Unit</th>
                            <th style={{ textAlign: 'right' }}>Total Cost</th>
                            <th style={{ textAlign: 'right' }}>Profit</th>
                            <th style={{ textAlign: 'right' }}>Margin</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.length === 0 && (
                            <tr><td colSpan={8} className="empty-row">No confirmed sales found for this period.</td></tr>
                        )}
                        {products.map((p) => {
                            const totalCost = p.cost != null ? p.qty * p.cost : null;
                            const profit = totalCost != null ? p.sales - totalCost : null;
                            const pm = profit != null && p.sales > 0 ? ((profit / p.sales) * 100).toFixed(1) + '%' : '—';
                            return (
                                <tr key={productKey(p)}>
                                    <td className="font-medium">{p.our_brand}</td>
                                    <td>{p.packing_size || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtQty(p.qty)}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtMoney(p.sales)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {p.cost != null
                                            ? '₹' + p.cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                                            : <span title="No filling recipe or finished-goods cost found for this product" style={{ color: 'var(--tx-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{totalCost != null ? fmtMoney(totalCost) : '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: profit == null ? 'var(--tx-muted)' : profit >= 0 ? '#059669' : '#dc2626' }}>
                                        {profit != null ? fmtMoney(profit) : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{pm}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <div className="card-title">
                    Month-wise Sales — {year}
                    <span className="ct-badge">Click a month above to filter products</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th style={{ textAlign: 'right' }}>Qty Sold</th>
                            <th style={{ textAlign: 'right' }}>Sales (ex-GST)</th>
                            <th style={{ textAlign: 'right' }}>Cost</th>
                            <th style={{ textAlign: 'right' }}>Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthly.map((m) => {
                            const profit = m.sales - m.cost;
                            const empty = m.qty === 0 && m.sales === 0;
                            return (
                                <tr key={m.month} style={empty ? { opacity: 0.45 } : undefined}>
                                    <td className="font-medium">{m.label}</td>
                                    <td style={{ textAlign: 'right' }}>{empty ? '—' : fmtQty(m.qty)}</td>
                                    <td style={{ textAlign: 'right' }}>{empty ? '—' : fmtMoney(m.sales)}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {empty ? '—' : fmtMoney(m.cost)}
                                        {m.hasUnknownCost && !empty && <span title="Some products have no cost data" style={{ color: '#d97706' }}> *</span>}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: empty ? 'var(--tx-muted)' : profit >= 0 ? '#059669' : '#dc2626' }}>
                                        {empty ? '—' : fmtMoney(profit)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 10 }}>
                    * Cost is calculated from filling recipes (raw-material cost) or the latest finished-goods batch.
                    Products marked — have no cost data, so their cost is counted as ₹0.
                </div>
            </div>
        </>
    );
}
