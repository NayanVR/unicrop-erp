import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type Ingredient = { name: string; qty: string; unit: string; rate: string };
type PackingRow = {
    size: string;
    margin: string;
    gst: string;
    useManual: boolean;   // false = auto (margin-based), true = manual kimmat
    manualRate: string;   // direct selling price (pre-GST) in manual mode
    discount: string;     // takavari % applied on MRP
};

const DEFAULT_PACKINGS: PackingRow[] = [
    { size: '100mL', margin: '30', gst: '18', useManual: false, manualRate: '', discount: '' },
    { size: '250mL', margin: '30', gst: '18', useManual: false, manualRate: '', discount: '' },
    { size: '500mL', margin: '28', gst: '18', useManual: false, manualRate: '', discount: '' },
    { size: '1L',    margin: '25', gst: '18', useManual: false, manualRate: '', discount: '' },
    { size: '5L',    margin: '20', gst: '18', useManual: false, manualRate: '', discount: '' },
];

const formatAmt = (v: number) =>
    '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function RateCalculator() {
    const [batchSize, setBatchSize] = useState('100');
    const [batchUnit, setBatchUnit] = useState('L');
    const [overhead, setOverhead] = useState('15');
    const [ingredients, setIngredients] = useState<Ingredient[]>([
        { name: '', qty: '', unit: 'kg', rate: '' },
    ]);
    const [packings, setPackings] = useState<PackingRow[]>(DEFAULT_PACKINGS);
    const [copied, setCopied] = useState<number | null>(null);

    const totalRmCost = useMemo(() => {
        return ingredients.reduce((sum, ing) => {
            const qty = parseFloat(ing.qty) || 0;
            const rate = parseFloat(ing.rate) || 0;
            return sum + qty * rate;
        }, 0);
    }, [ingredients]);

    const costPerUnit = useMemo(() => {
        const batch = parseFloat(batchSize) || 1;
        const oh = parseFloat(overhead) || 0;
        return (totalRmCost / batch) * (1 + oh / 100);
    }, [totalRmCost, batchSize, overhead]);

    const addIngredient = () =>
        setIngredients((prev) => [...prev, { name: '', qty: '', unit: 'kg', rate: '' }]);

    const removeIngredient = (idx: number) =>
        setIngredients((prev) => prev.filter((_, i) => i !== idx));

    const updateIngredient = (idx: number, field: keyof Ingredient, value: string) => {
        setIngredients((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const addPacking = () =>
        setPackings((prev) => [...prev, { size: '', margin: '25', gst: '18', useManual: false, manualRate: '', discount: '' }]);

    const removePacking = (idx: number) =>
        setPackings((prev) => prev.filter((_, i) => i !== idx));

    const updatePacking = (idx: number, field: keyof PackingRow, value: string) => {
        setPackings((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: field === 'useManual' ? value === 'true' : value } as PackingRow;
            return next;
        });
    };

    const calcRate = (packing: PackingRow) => {
        const sizeInL   = parseSizeToLiters(packing.size);
        const gst       = parseFloat(packing.gst) || 0;
        const discount  = parseFloat(packing.discount) || 0;

        let baseRate: number;
        if (packing.useManual) {
            baseRate = parseFloat(packing.manualRate) || 0;
        } else {
            const cost   = costPerUnit * sizeInL;
            const margin = parseFloat(packing.margin) || 0;
            baseRate = margin >= 100 ? cost : cost / (1 - margin / 100);
        }

        const gstAmt      = baseRate * (gst / 100);
        const mrp         = baseRate + gstAmt;
        const afterDisc   = mrp * (1 - discount / 100);
        return { baseRate, gstAmt, mrp, afterDisc, discount };
    };

    const copyRow = (idx: number) => {
        const p = packings[idx];
        const r = calcRate(p);
        const parts = [`${p.size}`, `Base: ${formatAmt(r.baseRate)}`, `GST: ${formatAmt(r.gstAmt)}`, `MRP: ${formatAmt(r.mrp)}`];
        if (r.discount > 0) parts.push(`Takavari (${r.discount}%): ${formatAmt(r.afterDisc)}`);
        navigator.clipboard.writeText(parts.join('\t'));
        setCopied(idx);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <>
            <Head title="Rate Calculator" />
            <div id="view-rate-calc" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Rate Calculator</h1>
                        <p>Calculate selling rates from raw material costs</p>
                    </div>
                </div>

                <div className="rc-two-col">
                    {/* Left: Inputs */}
                    <div>
                        <div className="form-card">
                            <div className="form-card-title">⚗️ Batch Info</div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Batch Size</label>
                                    <input
                                        type="number"
                                        value={batchSize}
                                        onChange={(e) => setBatchSize(e.target.value)}
                                        step="0.001" min="0.001"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <select value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)}>
                                        {['L', 'kg', 'mL', 'g'].map((u) => <option key={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label>Overhead / Labour %</label>
                                    <input
                                        type="number"
                                        value={overhead}
                                        onChange={(e) => setOverhead(e.target.value)}
                                        step="0.5" min="0" max="100"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-card" style={{ marginTop: '12px' }}>
                            <div className="form-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>🧪 Raw Materials</span>
                                <button type="button" className="btn sm" onClick={addIngredient}>
                                    + Add
                                </button>
                            </div>
                            {ingredients.map((ing, idx) => (
                                <div key={idx} className="rc-ing-row">
                                    <input
                                        type="text"
                                        placeholder="Material name"
                                        value={ing.name}
                                        onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={ing.qty}
                                        onChange={(e) => updateIngredient(idx, 'qty', e.target.value)}
                                        step="0.001" min="0"
                                    />
                                    <select
                                        value={ing.unit}
                                        onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                                    >
                                        {['kg', 'g', 'L', 'mL'].map((u) => <option key={u}>{u}</option>)}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="₹/unit"
                                        value={ing.rate}
                                        onChange={(e) => updateIngredient(idx, 'rate', e.target.value)}
                                        step="0.01" min="0"
                                    />
                                    <button
                                        type="button"
                                        className="btn danger-xs"
                                        onClick={() => removeIngredient(idx)}
                                        style={{ padding: '0 6px', height: '30px' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <div className="rc-summary-bar">
                                <span>Total RM Cost (batch):</span>
                                <strong>{formatAmt(totalRmCost)}</strong>
                            </div>
                            <div className="rc-cost-bar">
                                <span>Cost / {batchUnit} (incl. overhead):</span>
                                <strong>{formatAmt(costPerUnit)}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Right: Output rates */}
                    <div>
                        <div className="form-card">
                            <div className="form-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>📦 Selling Rates</span>
                                <button type="button" className="btn sm" onClick={addPacking}>
                                    + Packing
                                </button>
                            </div>

                            {packings.map((p, idx) => {
                                const r = calcRate(p);
                                return (
                                    <div key={idx} className="rc-packing-card">
                                        {/* Row 1: size + mode toggle + remove */}
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                            <input
                                                type="text"
                                                placeholder="Size"
                                                value={p.size}
                                                onChange={(e) => updatePacking(idx, 'size', e.target.value)}
                                                style={{ flex: '0 0 80px' }}
                                            />
                                            {/* Mode toggle */}
                                            <div style={{ display: 'flex', flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: 30 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => updatePacking(idx, 'useManual', 'false')}
                                                    style={{
                                                        flex: 1, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                                        background: !p.useManual ? 'var(--accent)' : 'var(--bg-paper)',
                                                        color: !p.useManual ? '#fff' : 'var(--tx-muted)',
                                                    }}
                                                >
                                                    Auto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updatePacking(idx, 'useManual', 'true')}
                                                    style={{
                                                        flex: 1, border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                                        background: p.useManual ? '#7c3aed' : 'var(--bg-paper)',
                                                        color: p.useManual ? '#fff' : 'var(--tx-muted)',
                                                    }}
                                                >
                                                    Kimmat
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn danger-xs"
                                                onClick={() => removePacking(idx)}
                                                style={{ padding: '0 6px', height: 30, flexShrink: 0 }}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Row 2: margin or manual rate + GST + discount */}
                                        <div className="rc-packing-inputs" style={{ marginBottom: 8 }}>
                                            {p.useManual ? (
                                                <div className="rc-field-wrap">
                                                    <span className="rc-suffix" style={{ left: 8, right: 'auto', color: 'var(--tx-muted)', fontSize: 12 }}>₹</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Selling price"
                                                        value={p.manualRate}
                                                        onChange={(e) => updatePacking(idx, 'manualRate', e.target.value)}
                                                        style={{ paddingLeft: 22 }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="rc-field-wrap">
                                                    <input
                                                        type="number"
                                                        placeholder="Margin%"
                                                        value={p.margin}
                                                        onChange={(e) => updatePacking(idx, 'margin', e.target.value)}
                                                    />
                                                    <span className="rc-suffix">%</span>
                                                </div>
                                            )}
                                            <div className="rc-field-wrap">
                                                <input
                                                    type="number"
                                                    placeholder="GST%"
                                                    value={p.gst}
                                                    onChange={(e) => updatePacking(idx, 'gst', e.target.value)}
                                                />
                                                <span className="rc-suffix">%</span>
                                            </div>
                                            <div className="rc-field-wrap">
                                                <input
                                                    type="number"
                                                    placeholder="Takavari%"
                                                    value={p.discount}
                                                    onChange={(e) => updatePacking(idx, 'discount', e.target.value)}
                                                />
                                                <span className="rc-suffix">%</span>
                                            </div>
                                        </div>

                                        {/* Output */}
                                        <div className="rc-rate-output">
                                            <div>
                                                <div style={{ color: 'var(--tx-muted)', marginBottom: '2px', fontSize: 11 }}>Base Rate</div>
                                                <div style={{ fontWeight: 700 }}>{formatAmt(r.baseRate)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: 'var(--tx-muted)', marginBottom: '2px', fontSize: 11 }}>GST ({p.gst || 0}%)</div>
                                                <div style={{ fontWeight: 700 }}>{formatAmt(r.gstAmt)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: 'var(--tx-muted)', marginBottom: '2px', fontSize: 11 }}>MRP</div>
                                                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                                                    {formatAmt(r.mrp)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Takavari row */}
                                        {r.discount > 0 && (
                                            <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                                <span style={{ color: '#166534' }}>Takavari ({r.discount}%) price</span>
                                                <strong style={{ color: '#166534', fontSize: 14 }}>{formatAmt(r.afterDisc)}</strong>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            className="btn sm"
                                            onClick={() => copyRow(idx)}
                                            style={{ marginTop: '8px', width: '100%', fontSize: '11px' }}
                                        >
                                            {copied === idx ? '✓ Copied!' : '📋 Copy'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function parseSizeToLiters(size: string): number {
    const num = parseFloat(size) || 0;
    const lower = size.toLowerCase();
    if (lower.includes('ml')) return num / 1000;
    if (lower.includes('g') && !lower.includes('kg')) return num / 1000;
    return num;
}
