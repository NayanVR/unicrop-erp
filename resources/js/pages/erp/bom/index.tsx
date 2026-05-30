import {
    destroy as bomDestroy,
    run as bomRun,
    store as bomStore,
    update as bomUpdate,
} from '@/routes/bom';
import type { Auth } from '@/types/auth';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

type RawMaterial = {
    id: number;
    name: string;
    unit: string;
    stock_qty: string | number;
    cost_per_unit: string | number;
};

type BomItem = {
    id?: number;
    raw_material_id: number;
    qty_per_batch: string | number;
    unit?: string | null;
    raw_material?: RawMaterial | null;
};

type Bom = {
    id: number;
    name: string;
    packing_size?: string | null;
    batch_size: string | number;
    batch_unit: string;
    notes?: string | null;
    is_active: boolean;
    product?: { id: number; name: string } | null;
    items: BomItem[];
};

type Product = { id: number; name: string };

type Props = {
    boms: Bom[];
    products: Product[];
    materials: RawMaterial[];
    productionRuns: ProductionRunRecord[];
};

type BomFormData = {
    name: string;
    product_id: string;
    packing_size: string;
    batch_size: string;
    batch_unit: string;
    notes: string;
    is_active: boolean;
    items: { raw_material_id: string; qty_per_batch: string; unit: string }[];
};

type RunFormData = { batch_number: string; batch_count: string; notes: string };

type NormalizedRunItem = { name: string; qtyUsed: number; itemUnit: string; qtyDeducted: number; matUnit: string; cost: number };
type NormalizedRun = {
    id?: number;
    batchNumber?: string | null;
    bomName: string;
    batchCount: number;
    batchSize: number;
    batchUnit: string;
    notes: string | null;
    totalCost: number | null;
    date: string;
    user?: { id: number; name: string } | null;
    items: NormalizedRunItem[];
};

type ProductionRunRecord = {
    id: number;
    batch_number: string | null;
    bom_id: number;
    bom_name: string;
    user?: { id: number; name: string } | null;
    batch_count: number;
    batch_size: number;
    batch_unit: string;
    total_cost: number | null;
    notes: string | null;
    items: { name: string; qty_used: number; item_unit: string; qty_deducted: number; mat_unit: string; cost: number }[];
    created_at: string;
};

const BATCH_UNITS = ['kg', 'L', 'g', 'mL', 'pcs'];

const formatQty = (v: string | number) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

function bomType(unit: string): 'liquid' | 'powder' | 'other' {
    if (['L', 'mL'].includes(unit)) return 'liquid';
    if (['kg', 'g'].includes(unit)) return 'powder';
    return 'other';
}

// Convert qty from one unit to another (weight: kg/g/mg; volume: L/mL)
// Returns original qty if units are the same or incompatible dimensions.
function convertQty(qty: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.trim().toLowerCase();
    const to   = toUnit.trim().toLowerCase();
    if (from === to || !from || !to) return qty;

    const weightFactor: Record<string, number> = {
        kg: 1, kgs: 1,
        g: 1e-3, gm: 1e-3, gram: 1e-3, grams: 1e-3,
        mg: 1e-6, milligram: 1e-6, milligrams: 1e-6,
    };
    const volumeFactor: Record<string, number> = {
        l: 1, ltr: 1, liter: 1, litre: 1, liters: 1, litres: 1,
        ml: 1e-3, milliliter: 1e-3, millilitre: 1e-3, milliliters: 1e-3, millilitres: 1e-3,
    };

    if (weightFactor[from] !== undefined && weightFactor[to] !== undefined)
        return qty * (weightFactor[from] / weightFactor[to]);
    if (volumeFactor[from] !== undefined && volumeFactor[to] !== undefined)
        return qty * (volumeFactor[from] / volumeFactor[to]);

    return qty; // incompatible dimensions — no conversion
}

const TYPE_CONFIG = {
    liquid: { label: 'LIQUID', color: '#2563eb', bg: '#eff6ff', border: '#2563eb' },
    powder: { label: 'POWDER', color: '#d97706', bg: '#fffbeb', border: '#d97706' },
    other:  { label: 'OTHER',  color: '#6b7280', bg: '#f9fafb', border: '#9ca3af' },
};

export default function BomIndex({ boms, products, materials, productionRuns }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const canSeeCost = auth.user?.role === 'admin' || auth.user?.cost_access === true;

    const [pageView, setPageView]     = useState<'boms' | 'history'>('boms');
    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'liquid' | 'powder' | 'other'>('all');
    const [histSearch, setHistSearch] = useState('');
    const [editModal, setEditModal]   = useState(false);
    const [runModal, setRunModal]     = useState(false);
    const [editingBom, setEditingBom] = useState<Bom | null>(null);
    const [runTarget, setRunTarget]   = useState<Bom | null>(null);
    const [runSummary, setRunSummary] = useState<NormalizedRun | null>(null);

    const form = useForm<BomFormData>({
        name: '', product_id: '', packing_size: '', batch_size: '1',
        batch_unit: 'kg', notes: '', is_active: true, items: [],
    });
    const runForm = useForm<RunFormData>({ batch_number: '', batch_count: '1', notes: '' });

    const openNew = () => {
        form.reset(); form.clearErrors(); setEditingBom(null); setEditModal(true);
    };

    const openEdit = (bom: Bom) => {
        form.setData({
            name: bom.name,
            product_id: bom.product?.id ? String(bom.product.id) : '',
            packing_size: bom.packing_size ?? '',
            batch_size: String(bom.batch_size),
            batch_unit: bom.batch_unit,
            notes: bom.notes ?? '',
            is_active: bom.is_active,
            items: bom.items.map((i) => ({
                raw_material_id: String(i.raw_material_id),
                qty_per_batch: String(i.qty_per_batch),
                unit: i.unit ?? '',
            })),
        });
        form.clearErrors(); setEditingBom(bom); setEditModal(true);
    };

    const addItem = () => form.setData('items', [...form.data.items, { raw_material_id: '', qty_per_batch: '', unit: '' }]);

    const removeItem = (idx: number) => form.setData('items', form.data.items.filter((_, i) => i !== idx));

    const updateItem = (idx: number, field: string, value: string) => {
        const items = [...form.data.items];
        items[idx] = { ...items[idx], [field]: value };
        if (field === 'raw_material_id') {
            const mat = materials.find((m) => m.id === Number(value));
            if (mat) items[idx].unit = mat.unit;
        }
        form.setData('items', items);
    };

    const saveBom = () => {
        if (editingBom) {
            form.patch(bomUpdate(editingBom.id).url, {
                preserveScroll: true,
                onSuccess: () => { setEditModal(false); form.reset(); setEditingBom(null); },
            });
        } else {
            form.post(bomStore().url, {
                preserveScroll: true,
                onSuccess: () => { setEditModal(false); form.reset(); },
            });
        }
    };

    const deleteBom = (bom: Bom) => {
        if (!confirm(`Delete BOM "${bom.name}"?`)) return;
        router.delete(bomDestroy(bom.id).url, { preserveScroll: true });
    };

    const openRun = (bom: Bom) => {
        const today = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const suggested = `BATCH-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
        runForm.reset();
        runForm.setData('batch_number', suggested);
        setRunTarget(bom);
        setRunModal(true);
    };

    const normalizeRun = (r: ProductionRunRecord): NormalizedRun => ({
        id: r.id,
        batchNumber: r.batch_number,
        bomName: r.bom_name,
        batchCount: r.batch_count,
        batchSize: r.batch_size,
        batchUnit: r.batch_unit,
        notes: r.notes,
        totalCost: r.total_cost,
        user: r.user,
        date: new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        items: r.items.map((it) => ({ name: it.name, qtyUsed: it.qty_used, itemUnit: it.item_unit, qtyDeducted: it.qty_deducted, matUnit: it.mat_unit, cost: it.cost })),
    });

    const buildRunSummary = (bom: Bom, batchCount: number, batchNumber: string, notes: string): NormalizedRun => {
        const items: NormalizedRunItem[] = bom.items.map((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            const matUnit  = mat?.unit ?? '';
            const itemUnit = item.unit || matUnit;
            const qtyUsed     = Number(item.qty_per_batch) * batchCount;
            const qtyDeducted = mat ? convertQty(qtyUsed, itemUnit, matUnit) : qtyUsed;
            const cost        = mat ? qtyDeducted * Number(mat.cost_per_unit) : 0;
            return { name: mat?.name ?? `Material #${item.raw_material_id}`, qtyUsed, itemUnit, qtyDeducted, matUnit, cost };
        });
        return {
            batchNumber: batchNumber || null,
            bomName: bom.name,
            batchCount,
            batchSize: Number(bom.batch_size),
            batchUnit: bom.batch_unit,
            notes: notes || null,
            totalCost: items.reduce((s, i) => s + i.cost, 0),
            date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            items,
        };
    };

    const submitRun = () => {
        if (!runTarget) return;
        const bom         = runTarget;
        const batchCount  = Number(runForm.data.batch_count) || 1;
        const batchNumber = runForm.data.batch_number.trim();
        const notes       = runForm.data.notes;
        runForm.post(bomRun(bom.id).url, {
            preserveScroll: true,
            onSuccess: () => {
                setRunModal(false);
                runForm.reset();
                setRunTarget(null);
                setRunSummary(buildRunSummary(bom, batchCount, batchNumber, notes));
            },
        });
    };

    const printRunSummary = (s: NormalizedRun) => {
        const costCol    = canSeeCost;
        const hasDiffUnit = s.items.some((it) => it.itemUnit.toLowerCase() !== it.matUnit.toLowerCase());
        const rows = s.items.map((it) => {
            const same = it.itemUnit.toLowerCase() === it.matUnit.toLowerCase();
            return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${it.name}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${it.qtyUsed.toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${it.itemUnit}</td>
                ${hasDiffUnit ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#555">${same ? '—' : `${it.qtyDeducted.toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${it.matUnit}`}</td>` : ''}
                ${costCol ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">₹${it.cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
            </tr>`;
        }).join('');
        const totalRow = costCol && s.totalCost != null
            ? `<tr><td colspan="${2 + (hasDiffUnit ? 1 : 0)}" style="padding:8px 10px;font-weight:700;text-align:right;border-top:2px solid #333">Total Batch Cost</td><td style="padding:8px 10px;font-weight:700;text-align:right;border-top:2px solid #333">₹${s.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>` : '';
        const win = window.open('', '_blank', 'width=700,height=800');
        if (!win) return;
        win.document.write(`<html><head><title>Production Run — ${s.batchNumber ?? s.bomName}</title>
        <style>body{font-family:Arial,sans-serif;padding:28px 32px;color:#111;font-size:14px}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:left;font-size:12px;color:#555}@media print{@page{size:A4;margin:15mm}button{display:none}}</style>
        </head><body>
        <h1>Production Run Report</h1>
        <div style="font-size:12px;color:#555;margin-bottom:20px">${s.date}${s.user ? ' · ' + s.user.name : ''}</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">
            ${s.batchNumber ? `<tr><td style="padding:3px 0;color:#555;width:130px">Batch No.</td><td style="font-weight:700;letter-spacing:.5px">${s.batchNumber}</td></tr>` : ''}
            <tr><td style="padding:3px 0;color:#555;width:130px">BOM</td><td style="font-weight:700">${s.bomName}</td></tr>
            <tr><td style="padding:3px 0;color:#555">Batches Run</td><td style="font-weight:700">${s.batchCount}</td></tr>
            <tr><td style="padding:3px 0;color:#555">Batch Size</td><td>${s.batchSize.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${s.batchUnit} × ${s.batchCount} = ${(s.batchSize * s.batchCount).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${s.batchUnit}</td></tr>
            ${s.notes ? `<tr><td style="padding:3px 0;color:#555">Notes</td><td>${s.notes}</td></tr>` : ''}
        </table>
        <table><thead><tr>
            <th style="padding:6px 10px;background:#f5f5f5">Material</th>
            <th style="padding:6px 10px;background:#f5f5f5;text-align:right;white-space:nowrap">Qty Used</th>
            ${hasDiffUnit ? '<th style="padding:6px 10px;background:#f5f5f5;text-align:right;white-space:nowrap">Deducted (inv. unit)</th>' : ''}
            ${costCol ? '<th style="padding:6px 10px;background:#f5f5f5;text-align:right">Cost (₹)</th>' : ''}
        </tr></thead><tbody>${rows}${totalRow}</tbody></table>
        <div style="margin-top:20px;text-align:right"><button onclick="window.print()" style="padding:8px 20px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">🖨 Print</button></div>
        </body></html>`);
        win.document.close();
        win.focus();
    };

    const calcCost = (bom: Bom, batches = 1) =>
        bom.items.reduce((sum, item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            if (!mat) return sum;
            const itemUnit = item.unit || mat.unit;
            const qtyInMatUnit = convertQty(Number(item.qty_per_batch), itemUnit, mat.unit);
            return sum + qtyInMatUnit * Number(mat.cost_per_unit) * batches;
        }, 0);

    const canRun = (bom: Bom, batches = 1) =>
        bom.items.every((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            if (!mat) return false;
            const itemUnit = item.unit || mat.unit;
            const needed = convertQty(Number(item.qty_per_batch) * batches, itemUnit, mat.unit);
            return Number(mat.stock_qty) >= needed;
        });

    const printBom = (bom: Bom) => {
        const type = bomType(bom.batch_unit);
        const cfg  = TYPE_CONFIG[type];
        const rows = bom.items.map((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${mat?.name ?? `Material #${item.raw_material_id}`}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${formatQty(item.qty_per_batch)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${item.unit ?? mat?.unit ?? ''}</td>
            </tr>`;
        }).join('');
        const win = window.open('', '_blank', 'width=600,height=700');
        if (!win) return;
        win.document.write(`<html><head><title>${bom.name}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;} @media print{button{display:none}}</style>
        </head><body>
        <button onclick="window.print()" style="margin-bottom:16px;padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
        <div style="border-left:4px solid ${cfg.border};padding-left:14px;margin-bottom:16px">
            <h2 style="margin:0 0 4px">${bom.name}</h2>
            <span style="background:${cfg.bg};color:${cfg.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.5px">${cfg.label}</span>
            <span style="margin-left:8px;font-size:13px;color:#666">Yield: ${formatQty(bom.batch_size)} ${bom.batch_unit}${bom.packing_size ? ' · ' + bom.packing_size : ''}</span>
        </div>
        ${bom.notes ? `<p style="color:#666;font-size:13px;margin-bottom:14px">${bom.notes}</p>` : ''}
        <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f3f4f6">
                <th style="padding:8px 10px;text-align:left">Ingredient</th>
                <th style="padding:8px 10px;text-align:right">Qty</th>
                <th style="padding:8px 10px;text-align:left">Unit</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#999">Est. cost / batch: ₹${calcCost(bom).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </body></html>`);
        win.document.close();
    };

    const filtered = boms.filter((b) => {
        if (typeFilter !== 'all' && bomType(b.batch_unit) !== typeFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return b.name.toLowerCase().includes(q)
                || (b.product?.name ?? '').toLowerCase().includes(q)
                || b.items.some((i) => (i.raw_material?.name ?? '').toLowerCase().includes(q));
        }
        return true;
    });

    return (
        <>
            <Head title="Bill of Materials" />
            <div id="view-bom" className="view active">

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Bill of Materials</h1>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--tx-sub)' }}>Define raw material recipes for liquid &amp; powder products</p>
                    </div>
                    {pageView === 'boms' && <button className="btn primary" onClick={openNew}>+ Add New BOM</button>}
                </div>

                {/* Tab switcher */}
                <div className="filter-bar" style={{ marginBottom: 20 }}>
                    <button className={`pill${pageView === 'boms' ? ' active' : ''}`} onClick={() => setPageView('boms')} style={{ fontWeight: pageView === 'boms' ? 600 : 400 }}>⚗️ BOMs ({boms.length})</button>
                    <button className={`pill${pageView === 'history' ? ' active' : ''}`} onClick={() => setPageView('history')} style={{ fontWeight: pageView === 'history' ? 600 : 400 }}>📋 Run History ({productionRuns.length})</button>
                </div>

                {/* ── BOMs view ────────────────────────────────────────────── */}
                {pageView === 'boms' && <>
                {/* Search + type filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Search BOMs..."
                        style={{ width: 220 }}
                    />
                    <div className="filter-bar" style={{ margin: 0 }}>
                        {(['all', 'liquid', 'powder', 'other'] as const).map((t) => (
                            <button
                                key={t}
                                className={`pill${typeFilter === t ? ' active' : ''}`}
                                onClick={() => setTypeFilter(t)}
                                style={{ fontWeight: typeFilter === t ? 600 : 400 }}
                            >
                                {t === 'all' ? '🔬 All' : t === 'liquid' ? '💧 Liquid' : t === 'powder' ? '🌿 Powder' : '📦 Other'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cards grid */}
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">⚗️</div>
                        <p>{boms.length === 0 ? 'No BOMs yet. Create one to define a product formulation.' : 'No BOMs match the current filter.'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {filtered.map((bom) => {
                            const type = bomType(bom.batch_unit);
                            const cfg  = TYPE_CONFIG[type];
                            const runnable = canRun(bom);
                            return (
                                <div
                                    key={bom.id}
                                    style={{
                                        background: '#fff',
                                        border: '1px solid var(--border)',
                                        borderLeft: `4px solid ${cfg.border}`,
                                        borderRadius: 10,
                                        padding: '16px 18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                    }}
                                >
                                    {/* Top row: name + yield */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{bom.name}</div>
                                        <span style={{ flexShrink: 0, background: '#f3f4f6', color: '#374151', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                            Yield: {formatQty(bom.batch_size)} {bom.batch_unit}
                                        </span>
                                    </div>

                                    {/* Type + product badge */}
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '.5px' }}>
                                            {type === 'liquid' ? '💧' : type === 'powder' ? '🌿' : '📦'} {cfg.label}
                                        </span>
                                        {bom.product && (
                                            <span style={{ fontSize: 12, color: 'var(--tx-sub)' }}>{bom.product.name}{bom.packing_size ? ` · ${bom.packing_size}` : ''}</span>
                                        )}
                                        {!bom.is_active && (
                                            <span className="badge gray" style={{ fontSize: 11 }}>Inactive</span>
                                        )}
                                    </div>

                                    {/* Description / notes */}
                                    {bom.notes && (
                                        <div style={{ fontSize: 13, color: 'var(--tx-sub)' }}>{bom.notes}</div>
                                    )}

                                    {/* Ingredients */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {bom.items.map((item, idx) => {
                                            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
                                            const matUnit = mat?.unit ?? '';
                                            const itemUnit = item.unit || matUnit;
                                            const neededInMatUnit = mat ? convertQty(Number(item.qty_per_batch), itemUnit, matUnit) : Number(item.qty_per_batch);
                                            const inStock = mat ? Number(mat.stock_qty) : 0;
                                            const sufficient = inStock >= neededInMatUnit;
                                            return (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }}>
                                                    <span style={{ color: sufficient ? 'var(--tx-body)' : 'var(--danger)', flex: 1 }}>
                                                        {mat?.name ?? `Material #${item.raw_material_id}`}
                                                    </span>
                                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        {formatQty(item.qty_per_batch)}{' '}
                                                        <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>{itemUnit}</span>
                                                    </span>
                                                    <span style={{
                                                        fontSize: 11, whiteSpace: 'nowrap',
                                                        color: sufficient ? '#059669' : '#dc2626',
                                                        background: sufficient ? '#d1fae5' : '#fee2e2',
                                                        padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                                                    }}>
                                                        Stock: {mat ? `${formatQty(inStock)} ${matUnit}` : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {bom.items.length === 0 && (
                                            <div style={{ fontSize: 13, color: 'var(--tx-faint)' }}>No ingredients added.</div>
                                        )}
                                    </div>

                                    {/* Cost info — admin / cost_access only */}
                                    {canSeeCost && (
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                                            {[
                                                { label: `Per ${bom.batch_unit}`, value: `₹${Number(bom.batch_size) > 0 ? (calcCost(bom) / Number(bom.batch_size)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}` },
                                                { label: `Total batch (${formatQty(bom.batch_size)} ${bom.batch_unit})`, value: `₹${calcCost(bom).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                                            ].map((c) => (
                                                <div key={c.label} style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                                                    <span style={{ color: 'var(--tx-muted)' }}>{c.label}: </span>
                                                    <strong>{c.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
                                        <button className="btn sm" onClick={() => openEdit(bom)} style={{ fontSize: 12 }}>✏ Edit</button>
                                        <button
                                            className={`btn sm${runnable ? ' primary' : ''}`}
                                            onClick={() => openRun(bom)}
                                            disabled={!runnable}
                                            style={{ fontSize: 12 }}
                                            title={runnable ? '' : 'Insufficient stock'}
                                        >
                                            {runnable ? '▶ Production Run' : '⚠️ Low Stock'}
                                        </button>
                                        <button className="btn sm" onClick={() => printBom(bom)} style={{ fontSize: 12 }}>🖨 Print</button>
                                        <button className="btn danger-xs" onClick={() => deleteBom(bom)} style={{ marginLeft: 'auto', fontSize: 12 }}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>}

            {/* ── Run History view ─────────────────────────────────────────── */}
            {pageView === 'history' && (
                <div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                        <input
                            type="search"
                            value={histSearch}
                            onChange={(e) => setHistSearch(e.target.value)}
                            placeholder="🔍 Search by BOM name or notes..."
                            style={{ width: 280 }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--tx-muted)' }}>{productionRuns.length} run{productionRuns.length !== 1 ? 's' : ''}</span>
                    </div>
                    {productionRuns.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">📋</div>
                            <p>No production runs yet. Run a BOM to start recording history.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-paper)', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Batch No.</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date &amp; Time</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>BOM</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Batches</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Total Yield</th>
                                        {canSeeCost && <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Total Cost</th>}
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)' }}>By</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)' }}>Notes</th>
                                        <th style={{ padding: '8px 12px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productionRuns
                                        .filter((r) => {
                                            if (!histSearch.trim()) return true;
                                            const q = histSearch.toLowerCase();
                                            return r.bom_name.toLowerCase().includes(q)
                                                || (r.batch_number ?? '').toLowerCase().includes(q)
                                                || (r.notes ?? '').toLowerCase().includes(q);
                                        })
                                        .map((r) => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '8px 12px', fontWeight: 600, letterSpacing: '.3px', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {r.batch_number ?? '—'}
                                                </td>
                                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--tx-muted)', fontSize: 12 }}>
                                                    {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.bom_name}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.batch_count}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {(r.batch_size * r.batch_count).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {r.batch_unit}
                                                </td>
                                                {canSeeCost && (
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                                        {r.total_cost != null ? `₹${r.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                )}
                                                <td style={{ padding: '8px 12px', color: 'var(--tx-muted)', fontSize: 12 }}>{r.user?.name ?? '—'}</td>
                                                <td style={{ padding: '8px 12px', color: 'var(--tx-muted)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes ?? '—'}</td>
                                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                    <button className="btn sm" onClick={() => setRunSummary(normalizeRun(r))} style={{ marginRight: 4 }}>Details</button>
                                                    <button className="btn sm" onClick={() => printRunSummary(normalizeRun(r))}>🖨</button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            </div>

            {/* ── Create / Edit BOM modal ─────────────────────────────────── */}
            <div className={`modal-overlay${editModal ? ' open' : ''}`} onClick={() => setEditModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="modal-header">
                        <h2>{editingBom ? 'Edit BOM' : 'New BOM'}</h2>
                        <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
                    </div>
                    <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>BOM Name *</label>
                                <input type="text" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="e.g. Imidacloprid 17.8% SL - 1L" />
                                {form.errors.name && <div className="form-error">{form.errors.name}</div>}
                            </div>
                            <div className="form-group">
                                <label>Batch Size *</label>
                                <input type="number" value={form.data.batch_size} onChange={(e) => form.setData('batch_size', e.target.value)} step="0.001" min="0.001" />
                            </div>
                            <div className="form-group">
                                <label>Batch Unit *</label>
                                <select value={form.data.batch_unit} onChange={(e) => form.setData('batch_unit', e.target.value)}>
                                    {BATCH_UNITS.map((u) => <option key={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Description / Notes</label>
                                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={2} placeholder="Short description of this formulation" />
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)' }}>⚗️ Ingredients</div>
                                <button type="button" className="btn sm" onClick={addItem}>+ Add Ingredient</button>
                            </div>
                            {form.data.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--tx-faint)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    No ingredients added yet.
                                </div>
                            ) : form.data.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                    <select value={item.raw_material_id} onChange={(e) => updateItem(idx, 'raw_material_id', e.target.value)}>
                                        <option value="">— Select material —</option>
                                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({formatQty(m.stock_qty)} {m.unit})</option>)}
                                    </select>
                                    <input type="number" placeholder="Qty" value={item.qty_per_batch} onChange={(e) => updateItem(idx, 'qty_per_batch', e.target.value)} step="0.001" min="0" />
                                    <input type="text" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                                    <button type="button" className="btn danger-xs" onClick={() => removeItem(idx)} style={{ padding: '0 8px', height: 32 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setEditModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={saveBom} disabled={form.processing}>
                            {editingBom ? 'Update BOM' : 'Create BOM'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Run production modal ─────────────────────────────────────── */}
            <div className={`modal-overlay${runModal ? ' open' : ''}`} onClick={() => setRunModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                    <div className="modal-header">
                        <h2>Run Production — {runTarget?.name}</h2>
                        <button className="modal-close" onClick={() => setRunModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-paper)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                            Batch size: <strong>{formatQty(runTarget?.batch_size ?? 0)} {runTarget?.batch_unit}</strong><br />
                            Est. cost / batch: <strong>₹{runTarget ? calcCost(runTarget).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</strong>
                        </div>
                        {runTarget && !canRun(runTarget, Number(runForm.data.batch_count) || 1) && (
                            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-lt)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--danger)' }}>
                                ⚠️ Insufficient stock for {runForm.data.batch_count} batch(es).
                            </div>
                        )}
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Batch Number <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>(auto-generated, you can change)</span></label>
                                <input type="text" value={runForm.data.batch_number} onChange={(e) => runForm.setData('batch_number', e.target.value)} placeholder="e.g. BATCH-20260530-001" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Number of Batches *</label>
                                <input type="number" value={runForm.data.batch_count} onChange={(e) => runForm.setData('batch_count', e.target.value)} min="0.001" step="0.001" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <textarea value={runForm.data.notes} onChange={(e) => runForm.setData('notes', e.target.value)} rows={2} placeholder="Lot notes, operator, etc." />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setRunModal(false)}>Cancel</button>
                        <button
                            className="btn primary"
                            onClick={submitRun}
                            disabled={runForm.processing || (runTarget ? !canRun(runTarget, Number(runForm.data.batch_count) || 1) : true)}
                        >
                            ▶ Run {runForm.data.batch_count} Batch(es)
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Run summary modal ────────────────────────────────────────── */}
            {runSummary && (
                <div className="modal-overlay open" onClick={() => setRunSummary(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h2>Production Run Complete</h2>
                            <button className="modal-close" onClick={() => setRunSummary(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Meta */}
                            <div style={{ background: 'var(--bg-paper)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
                                {runSummary.batchNumber && <span style={{ width: '100%' }}><span style={{ color: 'var(--tx-muted)' }}>Batch No.: </span><strong style={{ letterSpacing: '.3px' }}>{runSummary.batchNumber}</strong></span>}
                                <span><span style={{ color: 'var(--tx-muted)' }}>BOM: </span><strong>{runSummary.bomName}</strong></span>
                                <span><span style={{ color: 'var(--tx-muted)' }}>Batches: </span><strong>{runSummary.batchCount}</strong></span>
                                <span><span style={{ color: 'var(--tx-muted)' }}>Total yield: </span><strong>{(Number(runSummary.batchSize) * runSummary.batchCount).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {runSummary.batchUnit}</strong></span>
                                {runSummary.notes && <span style={{ width: '100%' }}><span style={{ color: 'var(--tx-muted)' }}>Notes: </span>{runSummary.notes}</span>}
                            </div>

                            {/* Materials table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-paper)' }}>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)' }}>Material</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>Qty Used</th>
                                        {runSummary.items.some((it) => it.itemUnit.toLowerCase() !== it.matUnit.toLowerCase()) && (
                                            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--tx-muted)' }}>Deducted</th>
                                        )}
                                        {canSeeCost && <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid var(--border)' }}>Cost (₹)</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {runSummary.items.map((it, i) => {
                                        const sameUnit = it.itemUnit.toLowerCase() === it.matUnit.toLowerCase();
                                        const showDeductedCol = runSummary.items.some((x) => x.itemUnit.toLowerCase() !== x.matUnit.toLowerCase());
                                        return (
                                            <tr key={i}>
                                                <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>{it.name}</td>
                                                <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>
                                                    {Number(it.qtyUsed.toFixed(6)).toLocaleString('en-IN', { maximumFractionDigits: 6 })} <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 11 }}>{it.itemUnit}</span>
                                                </td>
                                                {showDeductedCol && (
                                                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--tx-muted)' }}>
                                                        {sameUnit ? '—' : `${Number(it.qtyDeducted.toFixed(6)).toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${it.matUnit}`}
                                                    </td>
                                                )}
                                                {canSeeCost && (
                                                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                                                        ₹{it.cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {canSeeCost && runSummary.totalCost != null && (
                                        <tr style={{ background: 'var(--bg-paper)' }}>
                                            <td colSpan={2 + (runSummary.items.some((it) => it.itemUnit.toLowerCase() !== it.matUnit.toLowerCase()) ? 1 : 0)} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Total Batch Cost</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', color: '#059669' }}>
                                                ₹{runSummary.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setRunSummary(null)}>Close</button>
                            <button className="btn primary" onClick={() => printRunSummary(runSummary)}>🖨 Print Report</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
