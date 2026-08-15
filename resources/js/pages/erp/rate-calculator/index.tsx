import { Head, router, usePage } from '@inertiajs/react';
import type { Auth } from '@/types/auth';
import { Fragment, useMemo, useState } from 'react';

type RecipeItem = {
    name: string;
    category: string | null;
    qty: number;
    unit: string | null;
    rate: number;
};

type Charge = { label: string; amount: number };

type Recipe = {
    id: number;
    name: string | null;
    group_name: string | null;
    packing_size: string | null;
    fill_quantity: number;
    shape: string | null;
    output_unit: string | null;
    items: RecipeItem[];
    charges: Charge[];
    packaging_cost: number;
    charges_cost: number;
};

type Props = { recipes: Recipe[]; otherCostPct: number; canEditOtherCost: boolean };

const money = (v: number) =>
    '₹' + (Number.isFinite(v) ? v : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NO_SHAPE = 'Other';

// "1ltr", "500 ml", "250gm" → volume/weight in base units (L or kg)
function sizeInBaseUnits(packingSize: string | null): number | null {
    if (!packingSize) return null;
    const s = packingSize.toLowerCase().replace(/\s+/g, '');
    const m = s.match(/^([\d.]+)\s*(ltr|litre|liter|l|ml|kg|kgs|gm|g|gram|mg)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    switch (m[2]) {
        case 'ltr': case 'litre': case 'liter': case 'l':
        case 'kg': case 'kgs':
            return n;
        case 'ml': case 'gm': case 'g': case 'gram':
            return n / 1000;
        case 'mg':
            return n / 1_000_000;
        default:
            return null;
    }
}

// Sort 5ml → 5ltr rather than alphabetically
const sizeRank = (r: Recipe) => sizeInBaseUnits(r.packing_size) ?? Number.MAX_SAFE_INTEGER;

export default function RateCalculator({ recipes, otherCostPct, canEditOtherCost }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    // Only cost-cleared users see where the rate comes from; everyone else
    // just gets the final per-pcs number.
    const canSeeCost = auth.user?.role === 'admin' || auth.user?.cost_access === true;

    const [materialRate, setMaterialRate] = useState('');
    const [shape, setShape] = useState<string>('');
    const [expanded, setExpanded] = useState<number | null>(null);
    const [margin, setMargin] = useState('');
    const [otherCost, setOtherCost] = useState(String(otherCostPct ?? 0));
    const [savingOther, setSavingOther] = useState(false);

    const shapes = useMemo(() => {
        const set = new Set<string>();
        for (const r of recipes) set.add((r.shape ?? '').trim() || NO_SHAPE);
        return [...set].sort((a, b) => (a === NO_SHAPE ? 1 : b === NO_SHAPE ? -1 : a.localeCompare(b)));
    }, [recipes]);

    const rows = useMemo(() => {
        if (!shape) return [];
        return recipes
            .filter((r) => ((r.shape ?? '').trim() || NO_SHAPE) === shape)
            .sort((a, b) => sizeRank(a) - sizeRank(b));
    }, [recipes, shape]);

    const rate = parseFloat(materialRate) || 0;
    const marginPct = parseFloat(margin) || 0;

    // Admin-set overhead, applied to every size. Non-admins never see the field,
    // the percentage is simply part of the rate they get.
    const overheadPct = canEditOtherCost ? (parseFloat(otherCost) || 0) : (otherCostPct || 0);

    const computed = rows.map((r) => {
        // Size decides how much bulk goes in; fill_quantity is the fallback
        const size = sizeInBaseUnits(r.packing_size) ?? r.fill_quantity ?? 0;
        const materialCost = size * rate;
        const subtotal = materialCost + r.packaging_cost + r.charges_cost;
        const otherAmt = subtotal * (overheadPct / 100);
        const total = subtotal + otherAmt;
        return { r, size, materialCost, otherAmt, total, withMargin: total * (1 + marginPct / 100) };
    });

    const saveOtherCost = () => {
        setSavingOther(true);
        router.post('/rate-calculator/other-cost', { other_cost_pct: parseFloat(otherCost) || 0 }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setSavingOther(false),
        });
    };

    return (
        <>
            <Head title="Product Rate Calculator" />
            <div className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Product Rate Calculator</h1>
                        <p>Material નો ભાવ નાખો અને bottle પસંદ કરો — બધી sizes નો per pcs rate આવી જશે</p>
                    </div>
                </div>

                {/* ── Inputs ── */}
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                    <div className="form-grid" style={{ marginBottom: 14 }}>
                        <div className="form-group">
                            <label>Material Rate (₹ per L / kg) *</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                autoFocus
                                value={materialRate}
                                onChange={(e) => setMaterialRate(e.target.value)}
                                placeholder="e.g. 450"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        {canEditOtherCost && (
                            <div className="form-group">
                                <label>Other Cost % <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>(admin only — બધા rate પર લાગુ)</span></label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={otherCost}
                                        onChange={(e) => setOtherCost(e.target.value)}
                                        placeholder="e.g. 5"
                                        step="0.01"
                                        min="0"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn primary"
                                        onClick={saveOtherCost}
                                        disabled={savingOther || parseFloat(otherCost || '0') === otherCostPct}
                                    >
                                        {savingOther ? '…' : 'Save'}
                                    </button>
                                </div>
                                <small style={{ fontSize: 11, color: 'var(--tx-muted)' }}>
                                    બીજા users ને આ field દેખાશે નહીં — rate માં ગણાઈને જ જશે
                                </small>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Margin % <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>(optional)</span></label>
                            <input
                                type="number"
                                inputMode="decimal"
                                value={margin}
                                onChange={(e) => setMargin(e.target.value)}
                                placeholder="e.g. 20"
                                step="0.01"
                                min="0"
                            />
                        </div>
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8 }}>
                        🍾 Bottle / Jar
                    </div>
                    {shapes.length === 0 ? (
                        <div style={{ color: 'var(--tx-muted)', fontSize: 13 }}>
                            કોઈ filling recipe મળી નથી — પહેલાં Filling page પર recipes બનાવો.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {shapes.map((s) => {
                                const count = recipes.filter((r) => ((r.shape ?? '').trim() || NO_SHAPE) === s).length;
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`pill${shape === s ? ' active' : ''}`}
                                        onClick={() => { setShape(shape === s ? '' : s); setExpanded(null); }}
                                    >
                                        {s} <span style={{ opacity: .65 }}>({count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Results ── */}
                {!shape ? (
                    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--tx-muted)' }}>
                        ઉપરથી bottle પસંદ કરો.
                    </div>
                ) : computed.length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--tx-muted)' }}>
                        "{shape}" માટે કોઈ size મળી નથી.
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--tx-muted)' }}>
                            {shape} — {computed.length} size{computed.length !== 1 ? 's' : ''}
                            {canSeeCost && rate > 0 && <> · material {money(rate)} / L·kg</>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Size</th>
                                        {canSeeCost && <th>Product</th>}
                                        {canSeeCost && <th style={{ textAlign: 'right' }}>Material</th>}
                                        {canSeeCost && <th style={{ textAlign: 'right' }}>Bottle + Box</th>}
                                        {canSeeCost && <th style={{ textAlign: 'right' }}>Charges</th>}
                                        {canEditOtherCost && overheadPct > 0 && <th style={{ textAlign: 'right' }}>Other {overheadPct}%</th>}
                                        <th style={{ textAlign: 'right' }}>Per pcs</th>
                                        {marginPct > 0 && <th style={{ textAlign: 'right' }}>+{marginPct}%</th>}
                                        {canSeeCost && <th />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {computed.map(({ r, size, materialCost, otherAmt, total, withMargin }) => (
                                        <Fragment key={r.id}>
                                            <tr>
                                                <td><strong>{r.packing_size ?? '—'}</strong></td>
                                                {canSeeCost && (
                                                    <td>
                                                        <span className="prod-name">{r.name}</span>
                                                        {!sizeInBaseUnits(r.packing_size) && (
                                                            <div style={{ fontSize: 11, color: '#b45309' }}>
                                                                ⚠️ size વંચાઈ નથી — fill qty {r.fill_quantity} વપરાયું
                                                            </div>
                                                        )}
                                                        {r.items.some((it) => !it.rate) && (
                                                            <div style={{ fontSize: 11, color: '#b45309' }}>
                                                                ⚠️ {r.items.filter((it) => !it.rate).length} item માં selling rate નથી
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                {canSeeCost && (
                                                    <td style={{ textAlign: 'right' }}>
                                                        {money(materialCost)}
                                                        <div style={{ fontSize: 10, color: 'var(--tx-muted)' }}>{size} × {money(rate)}</div>
                                                    </td>
                                                )}
                                                {canSeeCost && <td style={{ textAlign: 'right' }}>{money(r.packaging_cost)}</td>}
                                                {canSeeCost && <td style={{ textAlign: 'right' }}>{money(r.charges_cost)}</td>}
                                                {canEditOtherCost && overheadPct > 0 && <td style={{ textAlign: 'right' }}>{money(otherAmt)}</td>}
                                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{money(total)}</td>
                                                {marginPct > 0 && (
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{money(withMargin)}</td>
                                                )}
                                                {canSeeCost && (
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn-icon"
                                                            title="Breakdown"
                                                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                                                        >
                                                            {expanded === r.id ? '▾' : '▸'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                            {canSeeCost && expanded === r.id && (
                                                <tr>
                                                    <td colSpan={7 + (marginPct > 0 ? 1 : 0) + (canEditOtherCost && overheadPct > 0 ? 1 : 0)} style={{ background: 'var(--bg-paper)', padding: '10px 16px' }}>
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 6 }}>
                                                            Filling recipe માંથી — bottle + outer box
                                                        </div>
                                                        {r.items.length === 0 && r.charges.length === 0 ? (
                                                            <div style={{ fontSize: 13, color: 'var(--tx-muted)' }}>આ recipe માં bottle કે outer box નથી.</div>
                                                        ) : (
                                                            <table style={{ fontSize: 13, width: '100%', maxWidth: 560 }}>
                                                                <tbody>
                                                                    {r.items.map((it, i) => (
                                                                        <tr key={i}>
                                                                            <td style={{ padding: '2px 0' }}>
                                                                                {it.name}
                                                                                {!it.rate && (
                                                                                    <span style={{ marginLeft: 6, fontSize: 11, color: '#b45309' }}>
                                                                                        ⚠️ selling rate નથી
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: '2px 8px', color: 'var(--tx-muted)' }}>
                                                                                {it.qty} {it.unit} × {money(it.rate)}
                                                                            </td>
                                                                            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 600 }}>
                                                                                {money(it.qty * it.rate)}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                    {r.charges.map((c, i) => (
                                                                        <tr key={`c${i}`}>
                                                                            <td style={{ padding: '2px 0' }}>💡 {c.label}</td>
                                                                            <td />
                                                                            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 600 }}>{money(c.amount)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
