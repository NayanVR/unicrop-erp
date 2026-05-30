import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type Ingredient = { name: string; qty: string; unit: string; rate: string };
type PackingRow = { size: string; margin: string; gst: string };

const DEFAULT_PACKINGS: PackingRow[] = [
    { size: '100mL', margin: '30', gst: '18' },
    { size: '250mL', margin: '30', gst: '18' },
    { size: '500mL', margin: '28', gst: '18' },
    { size: '1L', margin: '25', gst: '18' },
    { size: '5L', margin: '20', gst: '18' },
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
        setPackings((prev) => [...prev, { size: '', margin: '25', gst: '18' }]);

    const removePacking = (idx: number) =>
        setPackings((prev) => prev.filter((_, i) => i !== idx));

    const updatePacking = (idx: number, field: keyof PackingRow, value: string) => {
        setPackings((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const calcRate = (packing: PackingRow) => {
        const sizeInL = parseSizeToLiters(packing.size);
        const cost = costPerUnit * sizeInL;
        const margin = parseFloat(packing.margin) || 0;
        const gst = parseFloat(packing.gst) || 0;
        const baseRate = cost / (1 - margin / 100);
        const gstAmt = baseRate * (gst / 100);
        return { baseRate, gstAmt, mrp: baseRate + gstAmt };
    };

    const copyRow = (idx: number) => {
        const p = packings[idx];
        const r = calcRate(p);
        navigator.clipboard.writeText(
            `${p.size}\tBase: ${formatAmt(r.baseRate)}\tGST: ${formatAmt(r.gstAmt)}\tMRP: ${formatAmt(r.mrp)}`,
        );
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
                                        <div className="rc-packing-inputs">
                                            <input
                                                type="text"
                                                placeholder="Size"
                                                value={p.size}
                                                onChange={(e) => updatePacking(idx, 'size', e.target.value)}
                                            />
                                            <div className="rc-field-wrap">
                                                <input
                                                    type="number"
                                                    placeholder="Margin%"
                                                    value={p.margin}
                                                    onChange={(e) => updatePacking(idx, 'margin', e.target.value)}
                                                />
                                                <span className="rc-suffix">%</span>
                                            </div>
                                            <div className="rc-field-wrap">
                                                <input
                                                    type="number"
                                                    placeholder="GST%"
                                                    value={p.gst}
                                                    onChange={(e) => updatePacking(idx, 'gst', e.target.value)}
                                                />
                                                <span className="rc-suffix">%</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn danger-xs"
                                                onClick={() => removePacking(idx)}
                                                style={{ padding: '0 6px', height: '30px' }}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="rc-rate-output">
                                            <div>
                                                <div style={{ color: 'var(--tx-muted)', marginBottom: '2px' }}>Base Rate</div>
                                                <div style={{ fontWeight: 700 }}>{formatAmt(r.baseRate)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: 'var(--tx-muted)', marginBottom: '2px' }}>GST</div>
                                                <div style={{ fontWeight: 700 }}>{formatAmt(r.gstAmt)}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: 'var(--tx-muted)', marginBottom: '2px' }}>MRP</div>
                                                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                                                    {formatAmt(r.mrp)}
                                                </div>
                                            </div>
                                        </div>

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
