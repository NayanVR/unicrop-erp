import {
    destroy as bomDestroy,
    run as bomRun,
    store as bomStore,
    update as bomUpdate,
} from '@/routes/bom';
import type { Auth } from '@/types/auth';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type RawMaterial = {
    id: number;
    name: string;
    unit: string;
    stock_qty: string | number;
    cost_per_unit: string | number;
    category?: string | null;
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
    category?: string | null;
    packing_size?: string | null;
    batch_size: string | number;
    batch_unit: string;
    output_raw_material_id?: number | null;
    output_material?: { id: number; name: string; unit: string; stock_qty?: string | number | null; min_stock?: string | number | null; category?: string | null } | null;
    notes?: string | null;
    charges?: { label: string; amount: string | number }[] | null;
    is_active: boolean;
    items: BomItem[];
    created_at?: string;
};

type Props = {
    boms: Bom[];
    materials: RawMaterial[];
    categories: string[];
    productionRuns: ProductionRunRecord[];
};

type BomFormData = {
    name: string;
    category: string;
    packing_size: string;
    batch_size: string;
    batch_unit: string;
    output_raw_material_id: string;
    output_category: string;
    notes: string;
    is_active: boolean;
    items: { raw_material_id: string; qty_per_batch: string; unit: string }[];
    charges: { label: string; amount: string }[];
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

const BATCH_UNITS = ['kg', 'L', 'g', 'ml', 'pcs'];

const formatQty = (v: string | number) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

function bomType(unit: string): 'liquid' | 'powder' | 'other' {
    if (['L', 'ml'].includes(unit)) return 'liquid';
    if (['kg', 'g'].includes(unit)) return 'powder';
    return 'other';
}

// Convert qty from one unit to another (weight: kg/g/mg; volume: L/ml)
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

const UNCATEGORIZED = 'Uncategorized';

// Normalize unit strings to their canonical display form
function normalizeUnitDisplay(unit: string): string {
    const u = unit.trim().toLowerCase();
    if (['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres'].includes(u)) return 'ml';
    if (['l', 'ltr', 'liter', 'litre', 'liters', 'litres'].includes(u)) return 'L';
    if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) return 'kg';
    if (['g', 'gm', 'gram', 'grams'].includes(u)) return 'gm';
    if (['mg', 'milligram', 'milligrams'].includes(u)) return 'mg';
    return unit;
}

// Auto-upgrade to larger unit when qty reaches 1000 (gm→kg, ml→L, mg→gm/kg)
function smartUnit(qty: number, unit: string): { qty: number; unit: string } {
    const u = unit.trim().toLowerCase();
    if (['gm', 'g', 'gram', 'grams'].includes(u) && qty >= 1000)
        return { qty: qty / 1000, unit: 'kg' };
    if (['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres'].includes(u) && qty >= 1000)
        return { qty: qty / 1000, unit: 'L' };
    if (['mg', 'milligram', 'milligrams'].includes(u)) {
        if (qty >= 1_000_000) return { qty: qty / 1_000_000, unit: 'kg' };
        if (qty >= 1000)      return { qty: qty / 1000,       unit: 'gm' };
    }
    return { qty, unit: normalizeUnitDisplay(unit) };
}

function fmtSmart(qty: number, unit: string): string {
    const s = smartUnit(qty, unit);
    return `${s.qty.toLocaleString('en-IN', { maximumFractionDigits: 4 })} ${s.unit}`;
}

export default function BomIndex({ boms, materials, categories, productionRuns }: Props) {
    const { auth, flash } = usePage<{ auth: Auth; flash?: { success?: string; error?: string } }>().props;
    const canSeeCost  = auth.user?.role === 'admin' || auth.user?.cost_access === true;
    const isAdmin     = auth.user?.role === 'admin';
    const canDeleteBom = isAdmin || (auth.user?.permissions ?? []).includes('bom_delete');

    const [catRenameOpen, setCatRenameOpen] = useState(false);
    const [catRenameOld,  setCatRenameOld]  = useState('');
    const [catRenameNew,  setCatRenameNew]  = useState('');

    const openCatRename = (cat: string) => { setCatRenameOld(cat); setCatRenameNew(cat); setCatRenameOpen(true); };
    const submitCatRename = () => {
        if (!catRenameNew.trim() || catRenameNew.trim() === catRenameOld) { setCatRenameOpen(false); return; }
        router.patch('/bom-category/rename', { old_name: catRenameOld, new_name: catRenameNew.trim() }, { preserveScroll: true, onSuccess: () => setCatRenameOpen(false) });
    };
    const deleteCat = (cat: string) => {
        if (!confirm(`"${cat}" category remove karsho? Badha BOMs uncategorized thai jashe.`)) return;
        router.delete('/bom-category/delete', { data: { name: cat }, preserveScroll: true });
    };

    const [pageView, setPageView]     = useState<'boms' | 'history'>('boms');
    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'liquid' | 'powder' | 'other'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [histSearch, setHistSearch] = useState('');
    const [editModal, setEditModal]   = useState(false);
    const [runModal, setRunModal]     = useState(false);
    const [editingBom, setEditingBom] = useState<Bom | null>(null);
    const [itemSearches, setItemSearches] = useState<string[]>([]);
    const [runTarget, setRunTarget]   = useState<Bom | null>(null);
    const [runSummary, setRunSummary]     = useState<NormalizedRun | null>(null);
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
        const keys = new Set<string>();
        for (const b of boms) keys.add((b.category ?? '').trim() || UNCATEGORIZED);
        return keys;
    });

    const toggleGroup = (key: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Quick-add material from output product field
    const [quickAddOpen, setQuickAddOpen]         = useState(false);
    const [pendingSelectName, setPendingSelectName] = useState<string | null>(null);
    const quickForm = useForm({
        name: '', sku: '', hsn: '', gst: '', unit: 'kg', category: '',
        group_name: '', shape: '', min_stock: '', reorder_level: '',
        cost_per_unit: '', selling_rate: '', stock_qty: '',
        dim_l: '', dim_w: '', dim_h: '', supplier: '', notes: '',
    });
    const [qSellMode, setQSellMode] = useState<'manual' | 'profit'>('manual');
    const [qProfitPct, setQProfitPct] = useState('');

    // After materials prop refreshes, auto-select the just-created material
    useEffect(() => {
        if (!pendingSelectName) return;
        const mat = materials.find((m) => m.name.toLowerCase() === pendingSelectName.toLowerCase());
        if (mat) {
            form.setData({
                ...form.data,
                output_raw_material_id: String(mat.id),
                output_category: mat.category ?? '',
                name: mat.name,
            });
            setPendingSelectName(null);
            setQuickAddOpen(false);
            quickForm.reset();
        }
    }, [materials, pendingSelectName]);

    const submitQuickAdd = () => {
        if (!quickForm.data.name.trim() || !quickForm.data.unit) return;
        setPendingSelectName(quickForm.data.name.trim());
        quickForm.post('/inventory/materials', {
            preserveState: true,
            preserveScroll: true,
            onError: () => setPendingSelectName(null),
        });
    };

    const form = useForm<BomFormData>({
        name: '', category: '', packing_size: '', batch_size: '1',
        batch_unit: 'kg', output_raw_material_id: '', output_category: '', notes: '', is_active: true, items: [], charges: [],
    });
    const runForm = useForm<RunFormData>({ batch_number: '', batch_count: '1', notes: '' });

    const openNew = () => {
        form.reset(); form.clearErrors(); setEditingBom(null); setItemSearches([]); setEditModal(true);
    };

    const openEdit = (bom: Bom) => {
        form.setData({
            name: bom.name,
            category: bom.category ?? '',
            packing_size: bom.packing_size ?? '',
            batch_size: String(bom.batch_size),
            batch_unit: bom.batch_unit,
            output_raw_material_id: bom.output_raw_material_id ? String(bom.output_raw_material_id) : '',
            output_category: bom.output_material?.category ?? materials.find((m) => m.id === bom.output_raw_material_id)?.category ?? '',
            notes: bom.notes ?? '',
            is_active: bom.is_active,
            items: bom.items.map((i) => ({
                raw_material_id: String(i.raw_material_id),
                qty_per_batch: String(i.qty_per_batch),
                unit: i.unit ?? '',
            })),
            charges: (bom.charges ?? []).map((c) => ({ label: c.label, amount: String(c.amount) })),
        });
        const searches = bom.items.map((i) => {
            const mat = i.raw_material ?? materials.find((m) => m.id === i.raw_material_id);
            return mat?.name ?? '';
        });
        form.clearErrors(); setEditingBom(bom); setItemSearches(searches); setEditModal(true);
    };

    const addItem = () => {
        form.setData('items', [...form.data.items, { raw_material_id: '', qty_per_batch: '', unit: '' }]);
        setItemSearches((prev) => [...prev, '']);
    };

    const removeItem = (idx: number) => {
        form.setData('items', form.data.items.filter((_, i) => i !== idx));
        setItemSearches((prev) => prev.filter((_, i) => i !== idx));
    };

    const addCharge = () => {
        form.setData('charges', [...form.data.charges, { label: '', amount: '' }]);
    };

    const removeCharge = (idx: number) => {
        form.setData('charges', form.data.charges.filter((_, i) => i !== idx));
    };

    const updateCharge = (idx: number, field: 'label' | 'amount', value: string) => {
        const charges = [...form.data.charges];
        charges[idx] = { ...charges[idx], [field]: value };
        form.setData('charges', charges);
    };

    const chargesTotal = form.data.charges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

    const updateItemSearch = (idx: number, val: string) => {
        setItemSearches((prev) => { const n = [...prev]; n[idx] = val; return n; });
        const mat = materials.find((m) => m.name.toLowerCase() === val.trim().toLowerCase());
        const items = [...form.data.items];
        if (mat) {
            items[idx] = { ...items[idx], raw_material_id: String(mat.id), unit: mat.unit };
        } else {
            items[idx] = { ...items[idx], raw_material_id: '' };
        }
        form.setData('items', items);
    };

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
            const newCat = (form.data.category ?? '').trim() || UNCATEGORIZED;
            form.post(bomStore().url, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditModal(false);
                    form.reset();
                    // Expand the group the new BOM landed in
                    setCollapsedGroups((prev) => { const n = new Set(prev); n.delete(newCat); return n; });
                },
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
        const words = bom.name.trim().split(/\s+/).filter(Boolean);
        const prefix = words.length > 1
            ? words.map((w) => w[0].toUpperCase()).join('')
            : bom.name.slice(0, 3).toUpperCase();
        const suggested = `${prefix}-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
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
        const totalYield  = (Number(bom.batch_size) * batchCount).toLocaleString('en-IN', { maximumFractionDigits: 3 });
        const outputWarning = bom.output_raw_material_id
            ? ''
            : '\n\n⚠️ WARNING: This BOM has no "Output Product in Inventory" linked. The produced quantity will NOT be added to Inventory stock — only raw materials will be deducted. Edit the BOM and select an Output Product first if you want inventory stock to update.';
        const msg = `Confirm Production Run\n\nBatch No.: ${batchNumber || '(auto)'}\nBOM: ${bom.name}\nBatches: ${batchCount}\nTotal yield: ${totalYield} ${bom.batch_unit}\n\nThis will deduct raw materials from stock and add to finished goods.${outputWarning}\n\nProceed?`;
        if (!window.confirm(msg)) return;
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
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${it.qtyUsed.toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${normalizeUnitDisplay(it.itemUnit)}</td>
                ${hasDiffUnit ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#555">${same ? '—' : `${it.qtyDeducted.toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${normalizeUnitDisplay(it.matUnit)}`}</td>` : ''}
                ${costCol ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">₹${it.cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
            </tr>`;
        }).join('');
        const totalRow = costCol && s.totalCost != null
            ? `<tr><td colspan="${2 + (hasDiffUnit ? 1 : 0)}" style="padding:8px 10px;font-weight:700;text-align:right;border-top:2px solid #333">Total Batch Cost</td><td style="padding:8px 10px;font-weight:700;text-align:right;border-top:2px solid #333">₹${s.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>` : '';
        const win = window.open('', '_blank', 'width=700,height=800');
        if (!win) return;
        win.document.write(`<html><head><title>Production Run — ${s.batchNumber ?? s.bomName}</title>
        <style>body{font-family:Arial,sans-serif;padding:14px 16px;color:#111;font-size:11px}h1{font-size:15px;margin:0 0 3px}table{width:100%;border-collapse:collapse;margin-top:10px}th{text-align:left;font-size:10px;color:#555}@media print{@page{size:A6;margin:6mm}button{display:none}}</style>
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

    const calcCost = (bom: Bom, batches = 1) => {
        const materialCost = bom.items.reduce((sum, item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            if (!mat) return sum;
            const itemUnit = item.unit || mat.unit;
            const qtyInMatUnit = convertQty(Number(item.qty_per_batch), itemUnit, mat.unit);
            return sum + qtyInMatUnit * Number(mat.cost_per_unit) * batches;
        }, 0);
        const chargeCost = (bom.charges ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0) * batches, 0);
        return materialCost + chargeCost;
    };

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
                <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${normalizeUnitDisplay(item.unit ?? mat?.unit ?? '')}</td>
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

    const scrollToCard = (bomId: number) => {
        setPageView('boms');
        setHighlightedId(bomId);
        const bom = boms.find((b) => b.id === bomId);
        const groupKey = (bom?.category ?? '').trim() || UNCATEGORIZED;
        setCollapsedGroups((prev) => {
            if (!prev.has(groupKey)) return prev;
            const next = new Set(prev);
            next.delete(groupKey);
            return next;
        });
        setTimeout(() => {
            document.getElementById(`bom-card-${bomId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        setTimeout(() => setHighlightedId(null), 2500);
    };

    // Jump to a BOM card when arriving from inventory (e.g. /bom?output=<materialId>)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const output = params.get('output');
        if (!output) return;
        const bom = boms.find((b) => String(b.output_raw_material_id) === output);
        if (bom) {
            scrollToCard(bom.id);
            if (canRun(bom)) openRun(bom);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const lowStockBoms = boms.filter((b) => {
        const m = b.output_material;
        if (!m) return false;
        const stock = Number(m.stock_qty ?? 0);
        const min   = Number(m.min_stock ?? 0);
        return stock <= min || stock <= 0;
    });

    // Distinct BOM groups (PGR, Pesticide, Fungicide, …) for the category picker
    const bomCategories = useMemo(() => {
        const set = new Set<string>();
        for (const b of boms) {
            const c = (b.category ?? '').trim();
            if (c) set.add(c);
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [boms]);

    const filtered = boms.filter((b) => {
        if (typeFilter !== 'all' && bomType(b.batch_unit) !== typeFilter) return false;
        if (categoryFilter !== 'all' && ((b.category ?? '').trim() || UNCATEGORIZED) !== categoryFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return b.name.toLowerCase().includes(q)
                || (b.category ?? '').toLowerCase().includes(q)
                || b.items.some((i) => (i.raw_material?.name ?? '').toLowerCase().includes(q));
        }
        return true;
    });

    // Group filtered BOMs by category, named groups first (alphabetical), Uncategorized last
    const groupedBoms = useMemo(() => {
        const groups = new Map<string, Bom[]>();
        for (const b of filtered) {
            const key = (b.category ?? '').trim() || UNCATEGORIZED;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(b);
        }
        return [...groups.entries()].sort((a, b) => {
            if (a[0] === UNCATEGORIZED) return 1;
            if (b[0] === UNCATEGORIZED) return -1;
            return a[0].localeCompare(b[0]);
        });
    }, [filtered]);

    const showGroupHeaders = groupedBoms.length > 1 || (groupedBoms.length === 1 && groupedBoms[0][0] !== UNCATEGORIZED);

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

                {flash?.success && <div className="alert-success" style={{ marginBottom: 16 }}>{flash.success}</div>}
                {flash?.error   && <div className="alert-error"   style={{ marginBottom: 16 }}>{flash.error}</div>}

                {/* Production Required Alerts */}
                {lowStockBoms.length > 0 && (
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#9a3412', marginBottom: 8 }}>
                            ⚗️ BOM Production Required ({lowStockBoms.length})
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {lowStockBoms.map((b) => {
                                const m     = b.output_material!;
                                const isOut = Number(m.stock_qty ?? 0) <= 0;
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => scrollToCard(b.id)}
                                        style={{
                                            border: `1px solid ${isOut ? '#fca5a5' : '#fcd34d'}`,
                                            background: isOut ? '#fef2f2' : '#fffbeb',
                                            borderRadius: 8, padding: '5px 12px', fontSize: 12,
                                            fontWeight: 600, cursor: 'pointer', color: isOut ? '#dc2626' : '#92400e',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {isOut ? '🔴' : '🟡'} {b.name}{b.packing_size ? ` ${b.packing_size}` : ''}
                                        <span style={{ fontWeight: 400, marginLeft: 4 }}>
                                            — {Number(m.stock_qty ?? 0).toFixed(2)} {m.unit}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

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
                    {bomCategories.length > 0 && (
                        <div className="filter-bar" style={{ margin: 0 }}>
                            <button
                                className={`pill${categoryFilter === 'all' ? ' active' : ''}`}
                                onClick={() => setCategoryFilter('all')}
                                style={{ fontWeight: categoryFilter === 'all' ? 600 : 400 }}
                            >
                                🏷️ All Groups
                            </button>
                            {bomCategories.map((c) => (
                                <button
                                    key={c}
                                    className={`pill${categoryFilter === c ? ' active' : ''}`}
                                    onClick={() => setCategoryFilter(c)}
                                    style={{ fontWeight: categoryFilter === c ? 600 : 400 }}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cards grid */}
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">⚗️</div>
                        <p>{boms.length === 0 ? 'No BOMs yet. Create one to define a product formulation.' : 'No BOMs match the current filter.'}</p>
                    </div>
                ) : (
                    groupedBoms.map(([cat, list]) => {
                    const isCollapsed = collapsedGroups.has(cat);
                    return (
                    <div key={cat} style={{ marginBottom: 24 }}>
                        {showGroupHeaders && (
                            <div
                                onClick={() => toggleGroup(cat)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                                    padding: '10px 16px', borderRadius: 10, marginBottom: isCollapsed ? 0 : 14,
                                    background: cat === UNCATEGORIZED ? 'var(--bg-paper)' : '#f5f3ff',
                                    border: `1.5px solid ${cat === UNCATEGORIZED ? 'var(--border)' : '#c4b5fd'}`,
                                    userSelect: 'none',
                                    transition: 'background 0.15s',
                                }}
                            >
                                <span style={{
                                    fontSize: 13, display: 'inline-block',
                                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                    color: 'var(--tx-muted)',
                                }}>▼</span>
                                <span style={{ fontWeight: 700, fontSize: 15, flex: 1, color: cat === UNCATEGORIZED ? 'var(--tx-head)' : '#6d28d9' }}>
                                    {cat === UNCATEGORIZED ? '📦 Uncategorized' : `🏷️ ${cat}`}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, background: cat === UNCATEGORIZED ? 'var(--bg-secondary)' : '#ede9fe', color: cat === UNCATEGORIZED ? 'var(--tx-muted)' : '#6d28d9', border: '1px solid ' + (cat === UNCATEGORIZED ? 'var(--border)' : '#c4b5fd'), padding: '2px 10px', borderRadius: 10 }}>
                                    {list.length}
                                </span>
                                {isAdmin && cat !== UNCATEGORIZED && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); openCatRename(cat); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: '#6d28d9' }}
                                            title="Rename category"
                                        >✏️</button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); deleteCat(cat); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: '#dc2626' }}
                                            title="Delete category"
                                        >🗑️</button>
                                    </>
                                )}
                            </div>
                        )}
                        {!isCollapsed && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {list.map((bom) => {
                            const type        = bomType(bom.batch_unit);
                            const cfg         = TYPE_CONFIG[type];
                            const runnable    = canRun(bom);
                            const highlighted = highlightedId === bom.id;
                            return (
                                <div
                                    id={`bom-card-${bom.id}`}
                                    key={bom.id}
                                    style={{
                                        background: highlighted ? '#fff7ed' : '#fff',
                                        border: `1px solid ${highlighted ? '#fb923c' : 'var(--border)'}`,
                                        borderLeft: `4px solid ${highlighted ? '#ea580c' : cfg.border}`,
                                        borderRadius: 10,
                                        padding: '16px 18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        boxShadow: highlighted ? '0 0 0 3px #fed7aa' : '0 1px 4px rgba(0,0,0,.06)',
                                        transition: 'all 0.4s ease',
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
                                        {bom.category && (
                                            <span style={{ background: '#ede9fe', color: '#6d28d9', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                                                🏷️ {bom.category}
                                            </span>
                                        )}
                                        {bom.packing_size && (
                                            <span style={{ fontSize: 12, color: 'var(--tx-sub)' }}>{bom.packing_size}</span>
                                        )}
                                        {!bom.is_active && (
                                            <span className="badge gray" style={{ fontSize: 11 }}>Inactive</span>
                                        )}
                                        {bom.created_at && (
                                            <span style={{ fontSize: 11, color: 'var(--tx-faint)', marginLeft: 'auto' }}>
                                                Created: {new Date(bom.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>

                                    {/* Output inventory link */}
                                    {bom.output_material && (
                                        <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', display: 'inline-block' }}>
                                            📦 Output → {bom.output_material.name} ({bom.output_material.unit})
                                        </div>
                                    )}

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
                                                        <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>{normalizeUnitDisplay(itemUnit)}</span>
                                                    </span>
                                                    {canSeeCost && mat && (
                                                        <span style={{ fontSize: 12, color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>
                                                            ₹{(neededInMatUnit * Number(mat.cost_per_unit)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        fontSize: 11, whiteSpace: 'nowrap',
                                                        color: sufficient ? '#059669' : '#dc2626',
                                                        background: sufficient ? '#d1fae5' : '#fee2e2',
                                                        padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                                                    }}>
                                                        Stock: {mat ? `${formatQty(inStock)} ${normalizeUnitDisplay(matUnit)}` : '—'}
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
                                        {canDeleteBom && <button className="btn danger-xs" onClick={() => deleteBom(bom)} style={{ marginLeft: 'auto', fontSize: 12 }}>Delete</button>}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                        )}
                    </div>
                    );
                    })
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
                                                    <button className="btn sm" onClick={() => printRunSummary(normalizeRun(r))} style={{ marginRight: 4 }}>🖨</button>
                                                    {canDeleteBom && <button className="btn sm danger" onClick={() => {
                                                        if (!confirm(`Delete run ${r.batch_number ?? r.id}?\n\nThis will reverse the stock deduction for all materials used in this run.`)) return;
                                                        router.delete(`/bom/runs/${r.id}`, { preserveScroll: true });
                                                    }}>Delete</button>}
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
            <ModalPortal>
            <div className={`modal-overlay${editModal ? ' open' : ''}`} onClick={() => setEditModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="modal-header">
                        <h2>{editingBom ? 'Edit BOM' : 'New BOM'}</h2>
                        <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
                    </div>
                    <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>
                                    📦 Output Product in Inventory
                                    <span style={{ fontWeight: 400, color: 'var(--tx-muted)', marginLeft: 6, fontSize: 11 }}>
                                        (stock will be added here when BOM is run)
                                    </span>
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 32px', gap: 8 }}>
                                    <select
                                        value={form.data.output_raw_material_id}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            const mat = id ? materials.find((m) => m.id === Number(id)) : null;
                                            form.setData({
                                                ...form.data,
                                                output_raw_material_id: id,
                                                output_category: mat?.category ?? '',
                                                name: mat?.name ?? form.data.name,
                                            });
                                        }}
                                    >
                                        <option value="">— Not linked (won't update inventory stock) —</option>
                                        {materials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.unit}) — Stock: {formatQty(m.stock_qty)}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={form.data.output_category}
                                        onChange={(e) => form.setData('output_category', e.target.value)}
                                        disabled={!form.data.output_raw_material_id}
                                        title="Category for the output inventory item"
                                    >
                                        <option value="">— Category —</option>
                                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        title="Add new material to inventory"
                                        onClick={() => { quickForm.reset(); setQSellMode('manual'); setQProfitPct(''); setQuickAddOpen(true); }}
                                        style={{
                                            height: 36, width: 32, border: '1px dashed #2563eb',
                                            borderRadius: 6, background: '#eff6ff', color: '#2563eb',
                                            fontSize: 20, fontWeight: 700, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >+</button>
                                </div>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>
                                    🏷️ Group / Category
                                    <span style={{ fontWeight: 400, color: 'var(--tx-muted)', marginLeft: 6, fontSize: 11 }}>
                                        (e.g. PGR, Pesticide, Fungicide)
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    list="bom-category-list"
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    placeholder="Type or pick a group…"
                                />
                                <datalist id="bom-category-list">
                                    {bomCategories.map((c) => <option key={c} value={c} />)}
                                </datalist>
                                {form.errors.category && <div className="form-error">{form.errors.category}</div>}
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
                            <datalist id="bom-materials-list">
                                {materials.map((m) => (
                                    <option key={m.id} value={m.name}>{formatQty(m.stock_qty)} {m.unit}</option>
                                ))}
                            </datalist>
                            {form.data.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--tx-faint)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    No ingredients added yet.
                                </div>
                            ) : form.data.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        list="bom-materials-list"
                                        placeholder="Search material…"
                                        value={itemSearches[idx] ?? ''}
                                        onChange={(e) => updateItemSearch(idx, e.target.value)}
                                        style={{ borderColor: item.raw_material_id ? undefined : itemSearches[idx] ? '#f87171' : undefined }}
                                    />
                                    <input type="number" placeholder="Qty" value={item.qty_per_batch} onChange={(e) => updateItem(idx, 'qty_per_batch', e.target.value)} step="0.001" min="0" />
                                    <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}>
                                        <option value="">— unit —</option>
                                        {['kg', 'gm', 'g', 'mg', 'L', 'ml', 'pcs', 'nos'].map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <button type="button" className="btn danger-xs" onClick={() => removeItem(idx)} style={{ padding: '0 8px', height: 32 }}>✕</button>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)' }}>💡 Other Charges <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(per batch — man power, electricity, etc.)</span></div>
                                <button type="button" className="btn sm" onClick={addCharge}>+ Add Charge</button>
                            </div>
                            {form.data.charges.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--tx-faint)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    No extra charges added.
                                </div>
                            ) : (
                                <>
                                    {form.data.charges.map((charge, idx) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                            <input type="text" placeholder="Charge name (e.g. Man Power)" value={charge.label} onChange={(e) => updateCharge(idx, 'label', e.target.value)} />
                                            <input type="number" placeholder="₹ / batch" value={charge.amount} onChange={(e) => updateCharge(idx, 'amount', e.target.value)} step="0.01" min="0" />
                                            <button type="button" className="btn danger-xs" onClick={() => removeCharge(idx)} style={{ padding: '0 8px', height: 32 }}>✕</button>
                                        </div>
                                    ))}
                                    <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--tx-sub)', marginTop: 4 }}>
                                        Charges per batch: <strong>₹{chargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                    </div>
                                </>
                            )}
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
            </ModalPortal>

            {/* ── Quick Add Material modal (full inventory form) ───────────── */}
            {quickAddOpen && (
                <ModalPortal>
                <div className="modal-overlay open" style={{ zIndex: 1100 }} onClick={() => setQuickAddOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h2>➕ Add Material to Inventory</h2>
                            <button className="modal-close" onClick={() => setQuickAddOpen(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label>Name *</label>
                                    <input autoFocus type="text" value={quickForm.data.name} onChange={(e) => quickForm.setData('name', e.target.value)} placeholder="e.g. Amino Liquid" />
                                    {quickForm.errors.name && <div className="form-error">{quickForm.errors.name}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select value={quickForm.data.unit} onChange={(e) => quickForm.setData('unit', e.target.value)}>
                                        {['kg', 'g', 'gm', 'mg', 'L', 'ml', 'pcs', 'nos', 'bags', 'drums', 'litre', 'ltr'].map((u) => <option key={u}>{u}</option>)}
                                    </select>
                                    {quickForm.errors.unit && <div className="form-error">{quickForm.errors.unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <select value={quickForm.data.category} onChange={(e) => quickForm.setData('category', e.target.value)}>
                                        <option value="">— None —</option>
                                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>SKU / Item Code</label>
                                    <input type="text" value={quickForm.data.sku} onChange={(e) => quickForm.setData('sku', e.target.value)} placeholder="SKU" />
                                    {quickForm.errors.sku && <div className="form-error">{quickForm.errors.sku}</div>}
                                </div>
                                <div className="form-group">
                                    <label>HSN Code</label>
                                    <input type="text" value={quickForm.data.hsn} onChange={(e) => quickForm.setData('hsn', e.target.value)} placeholder="HSN" />
                                </div>
                                <div className="form-group">
                                    <label>GST %</label>
                                    <select value={quickForm.data.gst} onChange={(e) => quickForm.setData('gst', e.target.value)}>
                                        <option value="">— None —</option>
                                        {['0','5','12','18','28'].map((g) => <option key={g} value={g}>{g}%</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Min Stock</label>
                                    <input type="number" min="0" step="any" value={quickForm.data.min_stock} onChange={(e) => quickForm.setData('min_stock', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label>Reorder Level</label>
                                    <input type="number" min="0" step="any" value={quickForm.data.reorder_level} onChange={(e) => quickForm.setData('reorder_level', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label>Initial Stock</label>
                                    <input type="number" min="0" step="any" value={quickForm.data.stock_qty} onChange={(e) => quickForm.setData('stock_qty', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label>Cost / Unit (₹)</label>
                                    <input type="number" min="0" step="any" value={quickForm.data.cost_per_unit} onChange={(e) => quickForm.setData('cost_per_unit', e.target.value)} placeholder="0.00" />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>Selling Rate (₹)</span>
                                        <span style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', fontSize: 11, height: 20 }}>
                                            <button type="button" onClick={() => setQSellMode('manual')} style={{ padding: '0 8px', border: 'none', cursor: 'pointer', background: qSellMode === 'manual' ? 'var(--accent)' : 'var(--bg-paper)', color: qSellMode === 'manual' ? '#fff' : 'var(--tx-muted)', fontWeight: 600 }}>Manual</button>
                                            <button type="button" onClick={() => setQSellMode('profit')} style={{ padding: '0 8px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', background: qSellMode === 'profit' ? '#059669' : 'var(--bg-paper)', color: qSellMode === 'profit' ? '#fff' : 'var(--tx-muted)', fontWeight: 600 }}>% Profit</button>
                                        </span>
                                    </label>
                                    {qSellMode === 'manual' ? (
                                        <input type="number" min="0" step="any" value={quickForm.data.selling_rate} onChange={(e) => quickForm.setData('selling_rate', e.target.value)} placeholder="0.00" />
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input type="number" min="0" step="0.1" placeholder="Profit %" value={qProfitPct} onChange={(e) => { setQProfitPct(e.target.value); const cost = Number(quickForm.data.cost_per_unit) || 0; quickForm.setData('selling_rate', String(cost * (1 + Number(e.target.value) / 100))); }} style={{ paddingRight: 28 }} />
                                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', fontSize: 13, pointerEvents: 'none' }}>%</span>
                                            </div>
                                            <span style={{ fontSize: 13, color: '#059669', fontWeight: 700, whiteSpace: 'nowrap' }}>= ₹{(Number(quickForm.data.cost_per_unit) * (1 + Number(qProfitPct || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <input type="text" value={quickForm.data.supplier} onChange={(e) => quickForm.setData('supplier', e.target.value)} placeholder="Supplier name" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label>Notes</label>
                                    <textarea rows={2} value={quickForm.data.notes} onChange={(e) => quickForm.setData('notes', e.target.value)} placeholder="Any notes" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" type="button" onClick={() => setQuickAddOpen(false)}>Cancel</button>
                            <button className="btn primary" type="button" onClick={submitQuickAdd} disabled={quickForm.processing || !quickForm.data.name.trim()}>
                                {quickForm.processing ? 'Adding…' : '+ Add & Select'}
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* ── Run production modal ─────────────────────────────────────── */}
            <ModalPortal>
            <div className={`modal-overlay${runModal ? ' open' : ''}`} onClick={() => setRunModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                    <div className="modal-header">
                        <h2>Run Production — {runTarget?.name}</h2>
                        <button className="modal-close" onClick={() => setRunModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        {/* Today's runs for this BOM */}
                        {runTarget && (() => {
                            const today = new Date().toDateString();
                            const todayRuns = productionRuns.filter(
                                (r) => r.bom_id === runTarget.id && new Date(r.created_at).toDateString() === today
                            );
                            if (todayRuns.length === 0) return null;
                            return (
                                <div style={{ marginBottom: 14, padding: '10px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#92400e' }}>
                                    <strong>⚠ Aaj aa product nu production aagal levayu che:</strong>
                                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                                        {todayRuns.map((r) => (
                                            <li key={r.id}>
                                                {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} —{' '}
                                                <strong>{r.batch_count} × {r.batch_size} {normalizeUnitDisplay(r.batch_unit)} = {(r.batch_count * r.batch_size).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {normalizeUnitDisplay(r.batch_unit)}</strong>
                                                {r.batch_number ? ` (${r.batch_number})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })()}
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Batch Number <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>(auto-generated, you can change)</span></label>
                                <input type="text" value={runForm.data.batch_number} onChange={(e) => runForm.setData('batch_number', e.target.value)} placeholder="e.g. NO-20260530-001" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Batch Qty ({runTarget?.batch_unit}) *</label>
                                <input type="number" value={runForm.data.batch_count} onChange={(e) => runForm.setData('batch_count', e.target.value)} min="0.001" step="0.001" />
                                {runTarget && Number(runForm.data.batch_count) > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 4 }}>
                                        {runForm.data.batch_count} × {formatQty(runTarget.batch_size)} {runTarget.batch_unit} = <strong>{(Number(runForm.data.batch_count) * Number(runTarget.batch_size)).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {runTarget.batch_unit}</strong> total yield
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live material breakdown */}
                        {runTarget && runTarget.items.length > 0 && Number(runForm.data.batch_count) > 0 && (() => {
                            const qty = Number(runForm.data.batch_count);
                            return (
                                <div style={{ margin: '12px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <div style={{ padding: '7px 12px', background: 'var(--bg-paper)', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', borderBottom: '1px solid var(--border)' }}>
                                        Materials required for this run
                                    </div>
                                    {runTarget.items.map((item, i) => {
                                        const mat      = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
                                        const matUnit  = mat?.unit ?? '';
                                        const itemUnit = item.unit || matUnit;
                                        const needed   = Number(item.qty_per_batch) * qty;
                                        const neededInMatUnit = mat ? convertQty(needed, itemUnit, matUnit) : needed;
                                        const inStock  = mat ? Number(mat.stock_qty) : 0;
                                        const ok       = inStock >= neededInMatUnit;
                                        return (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: i < runTarget.items.length - 1 ? '1px solid var(--border)' : undefined, fontSize: 13, gap: 8 }}>
                                                <span style={{ flex: 1, color: ok ? 'var(--tx-body)' : '#dc2626' }}>{mat?.name ?? `Material #${item.raw_material_id}`}</span>
                                                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {fmtSmart(needed, itemUnit)}
                                                    {!ok && <span style={{ marginLeft: 8, fontSize: 11, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 8 }}>⚠ short by {fmtSmart(neededInMatUnit - inStock, matUnit)}</span>}
                                                    {ok && <span style={{ marginLeft: 8, fontSize: 11, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 8 }}>✓</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        <div className="form-grid" style={{ marginTop: 4 }}>
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
                            ▶ Run {runForm.data.batch_count} {runTarget?.batch_unit}
                        </button>
                    </div>
                </div>
            </div>
            </ModalPortal>

            {/* ── Run summary modal ────────────────────────────────────────── */}
            {runSummary && (
                <ModalPortal>
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
                                                    {Number(it.qtyUsed.toFixed(6)).toLocaleString('en-IN', { maximumFractionDigits: 6 })} <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 11 }}>{normalizeUnitDisplay(it.itemUnit)}</span>
                                                </td>
                                                {showDeductedCol && (
                                                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--tx-muted)' }}>
                                                        {sameUnit ? '—' : `${Number(it.qtyDeducted.toFixed(6)).toLocaleString('en-IN', { maximumFractionDigits: 6 })} ${normalizeUnitDisplay(it.matUnit)}`}
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
                </ModalPortal>
            )}
            {/* Category rename modal */}
            {catRenameOpen && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setCatRenameOpen(false)}>
                    <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>✏️ Rename Category</h2>
                            <button className="modal-close" onClick={() => setCatRenameOpen(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>New Category Name *</label>
                                <input
                                    type="text"
                                    value={catRenameNew}
                                    onChange={(e) => setCatRenameNew(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') submitCatRename(); }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setCatRenameOpen(false)}>Cancel</button>
                            <button className="btn primary" onClick={submitCatRename} disabled={!catRenameNew.trim()}>Rename</button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
        </>
    );
}
