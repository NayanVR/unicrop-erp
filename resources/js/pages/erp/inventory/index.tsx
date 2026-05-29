import {
    store as matStore,
    transactions as matTransaction,
    update as matUpdate,
} from '@/routes/inventory/materials';
import type { Auth } from '@/types/auth';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type RawMaterial = {
    id: number;
    name: string;
    sku: string | null;
    hsn: string | null;
    gst: string | number;
    category: string | null;
    unit: string;
    stock_qty: string | number;
    min_stock: string | number;
    reorder_level: string | number;
    cost_per_unit: string | number;
    selling_rate: string | number;
    dim_l: string | number | null;
    dim_w: string | number | null;
    dim_h: string | number | null;
    supplier: string | null;
    notes: string | null;
    is_active: boolean;
    transactions_count?: number;
};

type Transaction = {
    id: number;
    raw_material_id: number;
    type: 'purchase' | 'issue' | 'adjustment' | 'return';
    qty: string | number;
    previous_stock: string | number | null;
    new_stock: string | number | null;
    cost_per_unit: string | number | null;
    reference: string | null;
    notes: string | null;
    created_at: string;
    raw_material: { id: number; name: string; unit: string } | null;
    user: { id: number; name: string } | null;
};

type PurchaseBillItem = {
    id: number;
    material_name: string;
    sku: string | null;
    category: string | null;
    hsn: string | null;
    qty: string | number;
    unit: string;
    rate: string | number;
    gst: string | number;
    amount: string | number;
};

type PurchaseBill = {
    id: number;
    vendor_name: string;
    bill_number: string | null;
    bill_date: string | null;
    total_amount: string | number;
    bill_file: string | null;
    bill_name: string | null;
    add_to_stock: boolean;
    created_at: string;
    items: PurchaseBillItem[];
    user: { id: number; name: string } | null;
};

type Reorder = {
    id: number;
    raw_material_id: number;
    qty_ordered: string | number;
    unit: string;
    supplier: string | null;
    order_date: string;
    expected_delivery: string | null;
    transport_name: string | null;
    lr_number: string | null;
    notes: string | null;
    status: 'pending' | 'received';
    received_at: string | null;
    raw_material: { id: number; name: string } | null;
};

type Stats = {
    totalMaterials: number;
    lowStock: number;
    outOfStock: number;
    totalStockValue: number;
};

type Props = {
    materials: RawMaterial[];
    recentTransactions: Transaction[];
    purchaseBills: PurchaseBill[];
    reorders: Reorder[];
    stats: Stats;
};

// ── Route constants ───────────────────────────────────────────────────────────

const ROUTES = {
    destroyMaterial: (id: number) => `/inventory/materials/${id}`,
    storePurchaseBill: '/inventory/purchase-bills',
    destroyPurchaseBill: (id: number) => `/inventory/purchase-bills/${id}`,
    storeReorder: '/inventory/reorders',
    receiveReorder: (id: number) => `/inventory/reorders/${id}/receive`,
    destroyReorder: (id: number) => `/inventory/reorders/${id}`,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'bags', 'drums', 'bottles'];
const GST_OPTIONS = ['0', '5', '12', '18', '28'];

const PACKAGING_CATEGORIES = [
    { label: 'Bottle', icon: '🫙', code: 'BOT', unit: 'pcs' },
    { label: 'Box/Carton', icon: '📦', code: 'BOX', unit: 'pcs' },
    { label: 'Printed Box', icon: '🖨️', code: 'PBOX', unit: 'pcs' },
    { label: 'Label', icon: '🏷️', code: 'LBL', unit: 'pcs' },
    { label: 'Drum', icon: '🥁', code: 'DRM', unit: 'pcs' },
    { label: 'Pouch', icon: '👝', code: 'PCH', unit: 'pcs' },
    { label: 'Jar', icon: '🫙', code: 'JAR', unit: 'pcs' },
    { label: 'Cap/Closure', icon: '🔩', code: 'CAP', unit: 'pcs' },
];

const SHAPE_ABBR: Record<string, string> = {
    round: 'RND',
    square: 'SQ',
    flat: 'FLT',
    oval: 'OVL',
    rectangular: 'RECT',
};

// ── Helper functions ──────────────────────────────────────────────────────────

function stockStatus(m: RawMaterial): 'out' | 'low' | 'reorder' | 'good' {
    const qty = Number(m.stock_qty);
    const min = Number(m.min_stock);
    const reorder = Number(m.reorder_level);
    if (qty <= 0) return 'out';
    if (min > 0 && qty <= min) return 'low';
    if (reorder > 0 && qty <= reorder) return 'reorder';
    return 'good';
}

const fmt = (v: string | number, decimals = 3) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: decimals });

const fmtAmt = (v: string | number) =>
    '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function normalizeSize(s: string): string {
    return s.toUpperCase().replace(/\s+/g, '');
}

function abbrevShape(s: string): string {
    const key = s.toLowerCase().trim();
    if (SHAPE_ABBR[key]) return SHAPE_ABBR[key];
    return s.slice(0, 3).toUpperCase();
}

function buildSku(catCode: string, size: string, shape: string): string {
    const parts = ['PKG', catCode];
    if (size) parts.push(normalizeSize(size));
    if (shape) parts.push(abbrevShape(shape));
    return parts.join('-');
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryIndex({ materials, recentTransactions, purchaseBills, reorders, stats }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const canSeeCost = auth.user?.role === 'admin' || auth.user?.cost_access === true;

    // Tab
    const [tab, setTab] = useState<'materials' | 'log' | 'bills' | 'reorders'>('materials');

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
    const [catFilter, setCatFilter] = useState<string>('all');

    // Modal states
    const [matModal, setMatModal] = useState(false);
    const [txnModal, setTxnModal] = useState(false);
    const [billModal, setBillModal] = useState(false);
    const [reorderModal, setReorderModal] = useState(false);
    const [packModal, setPackModal] = useState(false);
    const [scanModal, setScanModal] = useState(false);

    // Modal targets
    const [editingMat, setEditingMat] = useState<RawMaterial | null>(null);
    const [txnTarget, setTxnTarget] = useState<RawMaterial | null>(null);
    const [expandedBill, setExpandedBill] = useState<number | null>(null);

    // Packaging wizard
    const [packStep, setPackStep] = useState(1);
    const [packCat, setPackCat] = useState<(typeof PACKAGING_CATEGORIES)[0] | null>(null);
    const [packForm, setPackForm] = useState({
        size: '',
        shape: '',
        dim_l: '',
        dim_w: '',
        dim_h: '',
        hsn: '',
        gst: '18',
        sku: '',
        unit: 'pcs',
        supplier: '',
        stock: '0',
        cost_per_unit: '',
        selling_rate: '',
        notes: '',
    });

    // Bill form (local state for dynamic rows)
    const [billForm, setBillForm] = useState({
        vendor_name: '',
        bill_number: '',
        bill_date: '',
        add_to_stock: true,
    });
    const [billFile, setBillFile] = useState<File | null>(null);
    const [billRows, setBillRows] = useState<
        { material_name: string; sku: string; category: string; hsn: string; qty: string; unit: string; rate: string; gst: string; amount: string }[]
    >([]);
    const [billProcessing, setBillProcessing] = useState(false);

    // Material form
    const matForm = useForm({
        name: '',
        sku: '',
        hsn: '',
        gst: '18',
        unit: 'kg',
        category: '',
        min_stock: '0',
        reorder_level: '0',
        cost_per_unit: '0',
        selling_rate: '0',
        dim_l: '',
        dim_w: '',
        dim_h: '',
        supplier: '',
        notes: '',
        is_active: true,
    });

    // Transaction form
    const txnForm = useForm({
        type: 'purchase',
        qty: '',
        cost_per_unit: '',
        reference: '',
        notes: '',
    });

    // Reorder form
    const reorderForm = useForm({
        raw_material_id: '',
        qty_ordered: '',
        unit: '',
        supplier: '',
        order_date: new Date().toISOString().slice(0, 10),
        expected_delivery: '',
        transport_name: '',
        lr_number: '',
        notes: '',
    });

    // Packaging form (useForm for submission)
    const packSubmitForm = useForm({
        name: '',
        sku: '',
        hsn: '',
        gst: '18',
        unit: 'pcs',
        category: '',
        min_stock: '0',
        reorder_level: '0',
        cost_per_unit: '0',
        selling_rate: '0',
        dim_l: '',
        dim_w: '',
        dim_h: '',
        supplier: '',
        notes: '',
        stock_qty: '0',
        is_active: true,
    });

    // ── Derived data ──────────────────────────────────────────────────────────

    const categories = Array.from(new Set(materials.map((m) => m.category).filter(Boolean))) as string[];

    const filteredMaterials = materials.filter((m) => {
        const s = stockStatus(m);
        if (statusFilter === 'low' && s !== 'low') return false;
        if (statusFilter === 'out' && s !== 'out') return false;
        if (catFilter !== 'all' && m.category !== catFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            if (
                !m.name.toLowerCase().includes(q) &&
                !(m.sku ?? '').toLowerCase().includes(q) &&
                !(m.category ?? '').toLowerCase().includes(q)
            )
                return false;
        }
        return true;
    });

    const alertMaterials = materials.filter((m) => {
        const s = stockStatus(m);
        if (s !== 'low' && s !== 'out') return false;
        return !reorders.some((r) => r.raw_material_id === m.id && r.status === 'pending');
    });

    const pendingReorders = reorders.filter((r) => r.status === 'pending');

    const isDuplicateBillNumber =
        billForm.bill_number.trim() !== '' &&
        purchaseBills.some((b) => b.bill_number === billForm.bill_number.trim());

    // ── Handlers ──────────────────────────────────────────────────────────────

    const openNewMat = () => {
        matForm.reset();
        matForm.clearErrors();
        setEditingMat(null);
        setMatModal(true);
    };

    const openEditMat = (m: RawMaterial) => {
        matForm.setData({
            name: m.name,
            sku: m.sku ?? '',
            hsn: m.hsn ?? '',
            gst: String(m.gst),
            unit: m.unit,
            category: m.category ?? '',
            min_stock: String(m.min_stock),
            reorder_level: String(m.reorder_level),
            cost_per_unit: String(m.cost_per_unit),
            selling_rate: String(m.selling_rate),
            dim_l: m.dim_l != null ? String(m.dim_l) : '',
            dim_w: m.dim_w != null ? String(m.dim_w) : '',
            dim_h: m.dim_h != null ? String(m.dim_h) : '',
            supplier: m.supplier ?? '',
            notes: m.notes ?? '',
            is_active: m.is_active,
        });
        matForm.clearErrors();
        setEditingMat(m);
        setMatModal(true);
    };

    const submitMat = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingMat) {
            matForm.patch(matUpdate(editingMat.id).url, {
                preserveScroll: true,
                onSuccess: () => setMatModal(false),
            });
        } else {
            matForm.post(matStore().url, {
                preserveScroll: true,
                onSuccess: () => setMatModal(false),
            });
        }
    };

    const deleteMaterial = (id: number) => {
        if (!confirm('Delete this material? This cannot be undone.')) return;
        router.delete(ROUTES.destroyMaterial(id), { preserveScroll: true });
    };

    const openTxn = (m: RawMaterial) => {
        txnForm.reset();
        txnForm.clearErrors();
        setTxnTarget(m);
        setTxnModal(true);
    };

    const submitTxn = (e: React.FormEvent) => {
        e.preventDefault();
        if (!txnTarget) return;
        txnForm.post(matTransaction(txnTarget.id).url, {
            preserveScroll: true,
            onSuccess: () => setTxnModal(false),
        });
    };

    const computedNewStock = (() => {
        if (!txnTarget) return null;
        const current = Number(txnTarget.stock_qty);
        const qty = Number(txnForm.data.qty) || 0;
        if (!qty) return null;
        switch (txnForm.data.type) {
            case 'purchase':
            case 'return':
                return current + qty;
            case 'issue':
                return current - qty;
            case 'adjustment':
                return qty;
            default:
                return null;
        }
    })();

    const addBillRow = () => {
        setBillRows((prev) => [
            ...prev,
            { material_name: '', sku: '', category: '', hsn: '', qty: '', unit: 'kg', rate: '', gst: '18', amount: '' },
        ]);
    };

    const updateBillRow = (i: number, key: string, val: string) => {
        setBillRows((prev) => {
            const rows = [...prev];
            rows[i] = { ...rows[i], [key]: val };
            if (key === 'qty' || key === 'rate' || key === 'gst') {
                const qty = Number(key === 'qty' ? val : rows[i].qty) || 0;
                const rate = Number(key === 'rate' ? val : rows[i].rate) || 0;
                const gst = Number(key === 'gst' ? val : rows[i].gst) || 0;
                const base = qty * rate;
                const amount = base + (base * gst) / 100;
                rows[i].amount = amount.toFixed(2);
            }
            return rows;
        });
    };

    const removeBillRow = (i: number) => {
        setBillRows((prev) => prev.filter((_, idx) => idx !== i));
    };

    const billTotal = billRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const resetBillForm = () => {
        setBillForm({ vendor_name: '', bill_number: '', bill_date: '', add_to_stock: true });
        setBillFile(null);
        setBillRows([]);
    };

    const submitBill = () => {
        const fd = new FormData();
        fd.append('vendor_name', billForm.vendor_name);
        fd.append('bill_number', billForm.bill_number);
        fd.append('bill_date', billForm.bill_date);
        fd.append('add_to_stock', billForm.add_to_stock ? '1' : '0');
        fd.append('total_amount', String(billTotal));
        if (billFile) fd.append('bill_file', billFile);
        billRows.forEach((row, i) => {
            Object.entries(row).forEach(([k, v]) => fd.append(`items[${i}][${k}]`, String(v)));
        });
        setBillProcessing(true);
        router.post(ROUTES.storePurchaseBill, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setBillModal(false);
                resetBillForm();
                setBillProcessing(false);
            },
            onError: () => setBillProcessing(false),
        });
    };

    const deleteBill = (id: number) => {
        if (!confirm('Delete this purchase bill?')) return;
        router.delete(ROUTES.destroyPurchaseBill(id), { preserveScroll: true });
    };

    const submitReorder = (e: React.FormEvent) => {
        e.preventDefault();
        reorderForm.post(ROUTES.storeReorder, {
            preserveScroll: true,
            onSuccess: () => setReorderModal(false),
        });
    };

    const receiveReorder = (id: number) => {
        router.post(ROUTES.receiveReorder(id), {}, { preserveScroll: true });
    };

    const deleteReorder = (id: number) => {
        if (!confirm('Delete this reorder?')) return;
        router.delete(ROUTES.destroyReorder(id), { preserveScroll: true });
    };

    const openReorderModal = () => {
        reorderForm.reset();
        reorderForm.clearErrors();
        reorderForm.setData('order_date', new Date().toISOString().slice(0, 10));
        setReorderModal(true);
    };

    const openOrderPlaced = (m: RawMaterial) => {
        reorderForm.reset();
        reorderForm.clearErrors();
        reorderForm.setData({
            raw_material_id: String(m.id),
            qty_ordered: '',
            unit: m.unit,
            supplier: '',
            order_date: new Date().toISOString().slice(0, 10),
            expected_delivery: '',
            transport_name: '',
            lr_number: '',
            notes: '',
        });
        setReorderModal(true);
    };

    const handleReorderMaterialChange = (id: string) => {
        reorderForm.setData('raw_material_id', id);
        const mat = materials.find((m) => String(m.id) === id);
        if (mat) reorderForm.setData('unit', mat.unit);
    };

    // Packaging wizard helpers
    const openPackModal = () => {
        setPackStep(1);
        setPackCat(null);
        setPackForm({ size: '', shape: '', dim_l: '', dim_w: '', dim_h: '', hsn: '', gst: '18', sku: '', unit: 'pcs', supplier: '', stock: '0', cost_per_unit: '', selling_rate: '', notes: '' });
        setPackModal(true);
    };

    const packSelectCat = (cat: (typeof PACKAGING_CATEGORIES)[0]) => {
        setPackCat(cat);
        setPackForm((prev) => ({ ...prev, unit: cat.unit }));
        setPackStep(2);
    };

    const packGoStep3 = () => {
        if (!packCat) return;
        const sku = buildSku(packCat.code, packForm.size, packForm.shape);
        setPackForm((prev) => ({ ...prev, sku }));
        setPackStep(3);
    };

    const packGoStep4 = () => setPackStep(4);

    const submitPackaging = () => {
        if (!packCat) return;
        packSubmitForm.setData({
            name: `${packCat.label}${packForm.size ? ' ' + packForm.size : ''}${packForm.shape ? ' ' + packForm.shape : ''}`,
            sku: packForm.sku,
            hsn: packForm.hsn,
            gst: packForm.gst,
            unit: packForm.unit,
            category: packCat.label,
            min_stock: '0',
            reorder_level: '0',
            cost_per_unit: packForm.cost_per_unit || '0',
            selling_rate: packForm.selling_rate || '0',
            dim_l: packForm.dim_l || '',
            dim_w: packForm.dim_w || '',
            dim_h: packForm.dim_h || '',
            supplier: packForm.supplier,
            notes: packForm.notes,
            stock_qty: packForm.stock || '0',
            is_active: true,
        });
        packSubmitForm.post(matStore().url, {
            preserveScroll: true,
            onSuccess: () => setPackModal(false),
        });
    };

    // ── Status badge helper ───────────────────────────────────────────────────

    const StatusBadge = ({ m }: { m: RawMaterial }) => {
        const s = stockStatus(m);
        const map: Record<string, [string, string]> = {
            out: ['badge red', 'Out of Stock'],
            low: ['badge amber', 'Low Stock'],
            reorder: ['badge sky', 'Reorder'],
            good: ['badge teal', 'Good Stock'],
        };
        const [cls, label] = map[s];
        return <span className={cls}>{label}</span>;
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div id="view-inventory" className="view active">
            <Head title="Inventory" />

            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Inventory</h1>
                    <p>Raw material stock levels &amp; transaction history</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => setScanModal(true)}>📸 Scan Bill</button>
                    <button className="btn sm" onClick={() => setBillModal(true)}>📄 Purchase Bill</button>
                    <button className="btn sm" onClick={openPackModal}>📦 Packaging</button>
                    <button className="btn sm primary" onClick={openNewMat}>+ Add Material</button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#d1fae5' }}>📦</div>
                    <div>
                        <div className="stat-val">{stats.totalMaterials}</div>
                        <div className="stat-label">Total Materials</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7' }}>⚠️</div>
                    <div>
                        <div className="stat-val">{stats.lowStock}</div>
                        <div className="stat-label">Low Stock</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fee2e2' }}>🚫</div>
                    <div>
                        <div className="stat-val">{stats.outOfStock}</div>
                        <div className="stat-label">Out of Stock</div>
                    </div>
                </div>
                {canSeeCost && (
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#e0f2fe' }}>💰</div>
                        <div>
                            <div className="stat-val">{fmtAmt(stats.totalStockValue)}</div>
                            <div className="stat-label">Total Stock Value</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Low Stock Alerts */}
            {alertMaterials.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>⚠ Low Stock Alerts</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {alertMaterials.map((m) => {
                            const s = stockStatus(m);
                            return (
                                <div
                                    key={m.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '6px 10px',
                                        borderRadius: 8,
                                        border: `1px solid ${s === 'out' ? '#fca5a5' : '#fcd34d'}`,
                                        background: s === 'out' ? '#fef2f2' : '#fffbeb',
                                        fontSize: 13,
                                    }}
                                >
                                    <span
                                        style={{ cursor: 'pointer', fontWeight: 600, color: s === 'out' ? '#dc2626' : '#d97706' }}
                                        onClick={() => { setSearch(m.name); setTab('materials'); }}
                                    >
                                        {s === 'out' ? '🔴' : '🟡'} {m.name}: {fmt(m.stock_qty)} {m.unit}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn sm primary"
                                        style={{ fontSize: 11, padding: '2px 8px' }}
                                        onClick={() => openOrderPlaced(m)}
                                    >
                                        + Order Placed
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* On The Way */}
            {pendingReorders.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>On The Way</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {pendingReorders.map((r) => (
                            <div
                                key={r.id}
                                className="pill"
                                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
                            >
                                <strong>{r.raw_material?.name ?? '—'}</strong>
                                {' — '}{fmt(r.qty_ordered)} {r.unit}
                                {r.supplier ? ` | Supplier: ${r.supplier}` : ''}
                                {r.expected_delivery ? ` | EDD: ${fmtDate(r.expected_delivery)}` : ''}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="filter-bar" style={{ marginBottom: 0, borderBottom: '1px solid #e5e7eb' }}>
                {(['materials', 'log', 'bills', 'reorders'] as const).map((t) => (
                    <button
                        key={t}
                        className={`pill${tab === t ? ' active' : ''}`}
                        onClick={() => setTab(t)}
                        style={{ fontWeight: tab === t ? 600 : 400 }}
                    >
                        {t === 'materials' && 'Materials'}
                        {t === 'log' && 'Transaction Log'}
                        {t === 'bills' && 'Purchase Bills'}
                        {t === 'reorders' && 'Reorders'}
                    </button>
                ))}
            </div>

            {/* ── Materials Tab ─────────────────────────────────────────────── */}
            {tab === 'materials' && (
                <div className="card" style={{ marginTop: 16 }}>
                    {/* Filter bar */}
                    <div className="filter-bar" style={{ marginBottom: 12 }}>
                        <input
                            type="text"
                            placeholder="Search materials..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', minWidth: 200 }}
                        />
                        {(['all', 'low', 'out'] as const).map((s) => (
                            <button
                                key={s}
                                className={`pill${statusFilter === s ? ' active' : ''}`}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s === 'all' ? 'All' : s === 'low' ? 'Low' : 'Out'}
                            </button>
                        ))}
                        <button
                            className={`pill${catFilter === 'all' ? ' active' : ''}`}
                            onClick={() => setCatFilter('all')}
                        >
                            All Categories
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c}
                                className={`pill${catFilter === c ? ' active' : ''}`}
                                onClick={() => setCatFilter(c)}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    {filteredMaterials.length === 0 ? (
                        <div className="empty-state">No materials found.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Material / SKU</th>
                                        <th>Category</th>
                                        <th>Stock</th>
                                        <th>Min</th>
                                        <th>Status</th>
                                        {canSeeCost && <th>Cost/Unit</th>}
                                        {canSeeCost && <th>Value</th>}
                                        <th>Selling Rate</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.map((m) => (
                                        <tr key={m.id}>
                                            <td>
                                                <div className="prod-name">{m.name}</div>
                                                {m.sku && <div className="prod-detail">{m.sku}</div>}
                                                {(m.dim_l || m.dim_w || m.dim_h) && (
                                                    <div className="prod-detail" style={{ color: '#6b7280' }}>
                                                        📐 {[m.dim_l, m.dim_w, m.dim_h].map((d) => d != null && Number(d) > 0 ? Number(d) : '?').join(' × ')} mm
                                                    </div>
                                                )}
                                            </td>
                                            <td>{m.category ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                            <td>{fmt(m.stock_qty)} {m.unit}</td>
                                            <td>{fmt(m.min_stock)}</td>
                                            <td><StatusBadge m={m} /></td>
                                            {canSeeCost && <td>{fmtAmt(m.cost_per_unit)}</td>}
                                            {canSeeCost && <td>{fmtAmt(Number(m.stock_qty) * Number(m.cost_per_unit))}</td>}
                                            <td>{fmtAmt(m.selling_rate)}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn sm primary" onClick={() => openTxn(m)}>+ Stock</button>
                                                    <button className="btn sm" onClick={() => openEditMat(m)}>Edit</button>
                                                    <button className="btn danger sm" onClick={() => deleteMaterial(m.id)}>🗑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Transaction Log Tab ───────────────────────────────────────── */}
            {tab === 'log' && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>Transaction Log</div>
                    {recentTransactions.length === 0 ? (
                        <div className="empty-state">No transactions recorded yet.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Material</th>
                                        <th>Type</th>
                                        <th>Qty</th>
                                        <th>Before → After</th>
                                        <th>Reference</th>
                                        <th>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTransactions.map((t) => {
                                        const isPositive = t.type === 'purchase' || t.type === 'return';
                                        const badgeMap: Record<string, string> = {
                                            purchase: 'badge teal',
                                            issue: 'badge amber',
                                            adjustment: 'badge sky',
                                            return: 'badge gray',
                                        };
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.created_at)}</td>
                                                <td>{t.raw_material?.name ?? '—'}</td>
                                                <td>
                                                    <span className={badgeMap[t.type] ?? 'badge gray'}>
                                                        {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                                                    </span>
                                                </td>
                                                <td style={{ color: isPositive ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                                    {isPositive ? '+' : t.type === 'adjustment' ? '=' : '-'}{fmt(t.qty)} {t.raw_material?.unit ?? ''}
                                                </td>
                                                <td>
                                                    {t.previous_stock != null && t.new_stock != null
                                                        ? `${fmt(t.previous_stock)} → ${fmt(t.new_stock)}`
                                                        : '—'}
                                                </td>
                                                <td>{t.reference ?? '—'}</td>
                                                <td>{t.user?.name ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Purchase Bills Tab ────────────────────────────────────────── */}
            {tab === 'bills' && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title">Purchase Bills</div>
                        <button className="btn sm primary" onClick={() => setBillModal(true)}>+ New Bill</button>
                    </div>
                    {purchaseBills.length === 0 ? (
                        <div className="empty-state">No purchase bills recorded.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Vendor</th>
                                        <th>Bill #</th>
                                        <th>Items</th>
                                        <th>Total</th>
                                        <th>Stock Added</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchaseBills.map((b) => (
                                        <>
                                            <tr
                                                key={b.id}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setExpandedBill(expandedBill === b.id ? null : b.id)}
                                            >
                                                <td style={{ whiteSpace: 'nowrap' }}>{b.bill_date ? fmtDate(b.bill_date) : fmtDate(b.created_at)}</td>
                                                <td>{b.vendor_name}</td>
                                                <td>{b.bill_number ?? '—'}</td>
                                                <td>
                                                    <span className="ct-badge">{b.items.length}</span>
                                                </td>
                                                <td>{fmtAmt(b.total_amount)}</td>
                                                <td>
                                                    {b.add_to_stock
                                                        ? <span className="badge teal">Yes</span>
                                                        : <span className="badge gray">No</span>}
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <button className="btn danger sm" onClick={() => deleteBill(b.id)}>🗑</button>
                                                </td>
                                            </tr>
                                            {expandedBill === b.id && b.items.length > 0 && (
                                                <tr key={`${b.id}-items`}>
                                                    <td colSpan={7} style={{ background: '#f9fafb', padding: 12 }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Material</th>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>SKU</th>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>HSN</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Unit</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Rate</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>GST%</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {b.items.map((item) => (
                                                                    <tr key={item.id}>
                                                                        <td style={{ padding: '4px 8px' }}>{item.material_name}</td>
                                                                        <td style={{ padding: '4px 8px' }}>{item.sku ?? '—'}</td>
                                                                        <td style={{ padding: '4px 8px' }}>{item.hsn ?? '—'}</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmt(item.qty)}</td>
                                                                        <td style={{ padding: '4px 8px' }}>{item.unit}</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtAmt(item.rate)}</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.gst}%</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtAmt(item.amount)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Reorders Tab ──────────────────────────────────────────────── */}
            {tab === 'reorders' && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title">Reorders</div>
                        <button className="btn sm primary" onClick={openReorderModal}>+ New Reorder</button>
                    </div>
                    {reorders.length === 0 ? (
                        <div className="empty-state">No reorders placed.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Qty</th>
                                        <th>Supplier</th>
                                        <th>Order Date</th>
                                        <th>EDD</th>
                                        <th>Transport</th>
                                        <th>LR #</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reorders.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.raw_material?.name ?? '—'}</td>
                                            <td>{fmt(r.qty_ordered)} {r.unit}</td>
                                            <td>{r.supplier ?? '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.order_date)}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{r.expected_delivery ? fmtDate(r.expected_delivery) : '—'}</td>
                                            <td>{r.transport_name ?? '—'}</td>
                                            <td>{r.lr_number ?? '—'}</td>
                                            <td>
                                                {r.status === 'received'
                                                    ? <span className="badge teal">Received</span>
                                                    : <span className="badge amber">Pending</span>}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {r.status === 'pending' && (
                                                        <button className="btn sm primary" onClick={() => receiveReorder(r.id)}>✓ Mark Received</button>
                                                    )}
                                                    <button className="btn danger sm" onClick={() => deleteReorder(r.id)}>🗑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                MODALS
            ════════════════════════════════════════════════════════════════ */}

            {/* ── Material Modal ────────────────────────────────────────────── */}
            <div className={`modal-overlay${matModal ? ' open' : ''}`} onClick={() => setMatModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '95%' }}>
                    <div className="modal-header">
                        <h3>{editingMat ? 'Edit Material' : 'Add Material'}</h3>
                        <button className="modal-close" onClick={() => setMatModal(false)}>×</button>
                    </div>
                    <form onSubmit={submitMat}>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={matForm.data.name}
                                        onChange={(e) => matForm.setData('name', e.target.value)}
                                        required
                                    />
                                    {matForm.errors.name && <div className="form-error">{matForm.errors.name}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select
                                        value={matForm.data.unit}
                                        onChange={(e) => matForm.setData('unit', e.target.value)}
                                        required
                                    >
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    {matForm.errors.unit && <div className="form-error">{matForm.errors.unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <input
                                        type="text"
                                        value={matForm.data.category}
                                        onChange={(e) => matForm.setData('category', e.target.value)}
                                        list="mat-cats"
                                    />
                                    <datalist id="mat-cats">
                                        {categories.map((c) => <option key={c} value={c} />)}
                                    </datalist>
                                    {matForm.errors.category && <div className="form-error">{matForm.errors.category}</div>}
                                </div>
                                <div className="form-group">
                                    <label>SKU</label>
                                    <input
                                        type="text"
                                        value={matForm.data.sku}
                                        onChange={(e) => matForm.setData('sku', e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && !matForm.data.sku && matForm.data.category) {
                                                matForm.setData('sku', `PKG-${matForm.data.category.toUpperCase().slice(0, 3)}-`);
                                            }
                                        }}
                                        placeholder="Press Tab to auto-suggest PKG-..."
                                    />
                                    {matForm.errors.sku && <div className="form-error">{matForm.errors.sku}</div>}
                                </div>
                                <div className="form-group">
                                    <label>HSN</label>
                                    <input
                                        type="text"
                                        value={matForm.data.hsn}
                                        onChange={(e) => matForm.setData('hsn', e.target.value)}
                                    />
                                    {matForm.errors.hsn && <div className="form-error">{matForm.errors.hsn}</div>}
                                </div>
                                <div className="form-group">
                                    <label>GST %</label>
                                    <select
                                        value={matForm.data.gst}
                                        onChange={(e) => matForm.setData('gst', e.target.value)}
                                    >
                                        {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                    </select>
                                    {matForm.errors.gst && <div className="form-error">{matForm.errors.gst}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Min Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.min_stock}
                                        onChange={(e) => matForm.setData('min_stock', e.target.value)}
                                    />
                                    {matForm.errors.min_stock && <div className="form-error">{matForm.errors.min_stock}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Reorder Level</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.reorder_level}
                                        onChange={(e) => matForm.setData('reorder_level', e.target.value)}
                                    />
                                    {matForm.errors.reorder_level && <div className="form-error">{matForm.errors.reorder_level}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Cost/Unit (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.cost_per_unit}
                                        onChange={(e) => matForm.setData('cost_per_unit', e.target.value)}
                                    />
                                    {matForm.errors.cost_per_unit && <div className="form-error">{matForm.errors.cost_per_unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Selling Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.selling_rate}
                                        onChange={(e) => matForm.setData('selling_rate', e.target.value)}
                                    />
                                    {matForm.errors.selling_rate && <div className="form-error">{matForm.errors.selling_rate}</div>}
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Box Dimensions (mm) — L × W × H</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={matForm.data.dim_l}
                                            onChange={(e) => matForm.setData('dim_l', e.target.value)}
                                            placeholder="L"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={matForm.data.dim_w}
                                            onChange={(e) => matForm.setData('dim_w', e.target.value)}
                                            placeholder="W"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={matForm.data.dim_h}
                                            onChange={(e) => matForm.setData('dim_h', e.target.value)}
                                            placeholder="H"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>mm</span>
                                    </div>
                                    {(matForm.errors.dim_l || matForm.errors.dim_w || matForm.errors.dim_h) && (
                                        <div className="form-error">Invalid dimensions</div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <input
                                        type="text"
                                        value={matForm.data.supplier}
                                        onChange={(e) => matForm.setData('supplier', e.target.value)}
                                    />
                                    {matForm.errors.supplier && <div className="form-error">{matForm.errors.supplier}</div>}
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={matForm.data.notes}
                                        onChange={(e) => matForm.setData('notes', e.target.value)}
                                    />
                                    {matForm.errors.notes && <div className="form-error">{matForm.errors.notes}</div>}
                                </div>
                                {editingMat && (
                                    <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <label style={{ margin: 0 }}>Active</label>
                                        <input
                                            type="checkbox"
                                            checked={matForm.data.is_active}
                                            onChange={(e) => matForm.setData('is_active', e.target.checked)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setMatModal(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={matForm.processing}>
                                {matForm.processing ? 'Saving...' : editingMat ? 'Update' : 'Add Material'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Transaction Modal ─────────────────────────────────────────── */}
            <div className={`modal-overlay${txnModal ? ' open' : ''}`} onClick={() => setTxnModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '95%' }}>
                    <div className="modal-header">
                        <h3>Stock Transaction</h3>
                        <button className="modal-close" onClick={() => setTxnModal(false)}>×</button>
                    </div>
                    <form onSubmit={submitTxn}>
                        <div className="modal-body">
                            {txnTarget && (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                                    <strong>{txnTarget.name}</strong>
                                    <span style={{ marginLeft: 12, color: '#374151' }}>
                                        Current Stock: {fmt(txnTarget.stock_qty)} {txnTarget.unit}
                                    </span>
                                </div>
                            )}
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Type *</label>
                                    <select
                                        value={txnForm.data.type}
                                        onChange={(e) => txnForm.setData('type', e.target.value)}
                                        required
                                    >
                                        <option value="purchase">📥 Stock In</option>
                                        <option value="issue">📤 Issue / Use</option>
                                        <option value="adjustment">⚖️ Adjust Stock</option>
                                        <option value="return">↩ Return</option>
                                    </select>
                                    {txnForm.errors.type && <div className="form-error">{txnForm.errors.type}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Qty *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={txnForm.data.qty}
                                        onChange={(e) => txnForm.setData('qty', e.target.value)}
                                        required
                                    />
                                    {txnForm.errors.qty && <div className="form-error">{txnForm.errors.qty}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Cost/Unit (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={txnForm.data.cost_per_unit}
                                        onChange={(e) => txnForm.setData('cost_per_unit', e.target.value)}
                                    />
                                    {txnForm.errors.cost_per_unit && <div className="form-error">{txnForm.errors.cost_per_unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Reference / Bill No</label>
                                    <input
                                        type="text"
                                        value={txnForm.data.reference}
                                        onChange={(e) => txnForm.setData('reference', e.target.value)}
                                    />
                                    {txnForm.errors.reference && <div className="form-error">{txnForm.errors.reference}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <input
                                        type="text"
                                        value={txnForm.data.notes}
                                        onChange={(e) => txnForm.setData('notes', e.target.value)}
                                    />
                                    {txnForm.errors.notes && <div className="form-error">{txnForm.errors.notes}</div>}
                                </div>
                                {computedNewStock !== null && (
                                    <div style={{ gridColumn: '1 / -1', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', fontWeight: 600, color: '#1e40af' }}>
                                        New Stock: {fmt(computedNewStock)} {txnTarget?.unit}
                                        {computedNewStock < 0 && (
                                            <span style={{ color: '#dc2626', marginLeft: 8 }}>⚠ Stock will go negative!</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setTxnModal(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={txnForm.processing}>
                                {txnForm.processing ? 'Saving...' : 'Record Transaction'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Purchase Bill Modal ───────────────────────────────────────── */}
            <div className={`modal-overlay${billModal ? ' open' : ''}`} onClick={() => setBillModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '98%' }}>
                    <div className="modal-header">
                        <h3>New Purchase Bill</h3>
                        <button className="modal-close" onClick={() => setBillModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Vendor Name *</label>
                                <input
                                    type="text"
                                    value={billForm.vendor_name}
                                    onChange={(e) => setBillForm((p) => ({ ...p, vendor_name: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Bill Number</label>
                                <input
                                    type="text"
                                    value={billForm.bill_number}
                                    onChange={(e) => setBillForm((p) => ({ ...p, bill_number: e.target.value }))}
                                />
                                {isDuplicateBillNumber && (
                                    <div className="form-error">⚠ This bill number already exists.</div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Bill Date</label>
                                <input
                                    type="date"
                                    value={billForm.bill_date}
                                    onChange={(e) => setBillForm((p) => ({ ...p, bill_date: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Upload Bill (Image / PDF)</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="checkbox"
                                    id="addToStock"
                                    checked={billForm.add_to_stock}
                                    onChange={(e) => setBillForm((p) => ({ ...p, add_to_stock: e.target.checked }))}
                                />
                                <label htmlFor="addToStock" style={{ margin: 0, cursor: 'pointer' }}>
                                    Add items to stock automatically
                                </label>
                            </div>
                        </div>

                        {/* Line items */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <strong>Line Items</strong>
                                <button type="button" className="btn sm" onClick={addBillRow}>+ Add Row</button>
                            </div>
                            {billRows.length === 0 ? (
                                <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 0' }}>No items added. Click "+ Add Row" to begin.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Material Name</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>SKU</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Category</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HSN</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Unit</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rate (₹)</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>GST %</th>
                                                <th style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                                <th style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {billRows.map((row, i) => (
                                                <tr key={i}>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <input
                                                            type="text"
                                                            value={row.material_name}
                                                            onChange={(e) => updateBillRow(i, 'material_name', e.target.value)}
                                                            style={{ width: '100%', minWidth: 120 }}
                                                            list="mat-names"
                                                        />
                                                        <datalist id="mat-names">
                                                            {materials.map((m) => <option key={m.id} value={m.name} />)}
                                                        </datalist>
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <input type="text" value={row.sku} onChange={(e) => updateBillRow(i, 'sku', e.target.value)} style={{ width: 80 }} />
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <input type="text" value={row.category} onChange={(e) => updateBillRow(i, 'category', e.target.value)} style={{ width: 90 }} />
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <input type="text" value={row.hsn} onChange={(e) => updateBillRow(i, 'hsn', e.target.value)} style={{ width: 70 }} />
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <input type="number" min="0" step="any" value={row.qty} onChange={(e) => updateBillRow(i, 'qty', e.target.value)} style={{ width: 70, textAlign: 'right' }} />
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <select value={row.unit} onChange={(e) => updateBillRow(i, 'unit', e.target.value)} style={{ width: 60 }}>
                                                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <input type="number" min="0" step="any" value={row.rate} onChange={(e) => updateBillRow(i, 'rate', e.target.value)} style={{ width: 80, textAlign: 'right' }} />
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <select value={row.gst} onChange={(e) => updateBillRow(i, 'gst', e.target.value)} style={{ width: 60 }}>
                                                            {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '3px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        {row.amount ? fmtAmt(row.amount) : '—'}
                                                    </td>
                                                    <td style={{ padding: '3px 4px' }}>
                                                        <button type="button" className="btn danger sm" onClick={() => removeBillRow(i)}>×</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {billRows.length > 0 && (
                                <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 700, fontSize: 15 }}>
                                    Total: {fmtAmt(billTotal)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn" onClick={() => { setBillModal(false); resetBillForm(); }}>Cancel</button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={submitBill}
                            disabled={billProcessing || !billForm.vendor_name.trim()}
                        >
                            {billProcessing ? 'Saving...' : 'Save Bill'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Reorder Modal ─────────────────────────────────────────────── */}
            <div className={`modal-overlay${reorderModal ? ' open' : ''}`} onClick={() => setReorderModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '95%' }}>
                    <div className="modal-header">
                        <h3>🚚 Order Placed</h3>
                        <button className="modal-close" onClick={() => setReorderModal(false)}>×</button>
                    </div>
                    <form onSubmit={submitReorder}>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Material *</label>
                                    {reorderForm.data.raw_material_id ? (
                                        <>
                                            <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 6, fontWeight: 600, color: '#1e40af', border: '1px solid #bfdbfe' }}>
                                                {materials.find((m) => String(m.id) === reorderForm.data.raw_material_id)?.name ?? '—'}
                                            </div>
                                            <input type="hidden" name="raw_material_id" value={reorderForm.data.raw_material_id} />
                                        </>
                                    ) : (
                                        <select
                                            value={reorderForm.data.raw_material_id}
                                            onChange={(e) => handleReorderMaterialChange(e.target.value)}
                                            required
                                        >
                                            <option value="">— Select material —</option>
                                            {materials.filter((m) => m.is_active).map((m) => (
                                                <option key={m.id} value={String(m.id)}>{m.name} ({m.unit})</option>
                                            ))}
                                        </select>
                                    )}
                                    {reorderForm.errors.raw_material_id && <div className="form-error">{reorderForm.errors.raw_material_id}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Qty Ordered *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={reorderForm.data.qty_ordered}
                                        onChange={(e) => reorderForm.setData('qty_ordered', e.target.value)}
                                        required
                                    />
                                    {reorderForm.errors.qty_ordered && <div className="form-error">{reorderForm.errors.qty_ordered}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select
                                        value={reorderForm.data.unit}
                                        onChange={(e) => reorderForm.setData('unit', e.target.value)}
                                        required
                                    >
                                        <option value="">— Unit —</option>
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    {reorderForm.errors.unit && <div className="form-error">{reorderForm.errors.unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Vendor / Supplier *</label>
                                    <input
                                        type="text"
                                        value={reorderForm.data.supplier}
                                        onChange={(e) => reorderForm.setData('supplier', e.target.value)}
                                        placeholder="Vendor name"
                                    />
                                    {reorderForm.errors.supplier && <div className="form-error">{reorderForm.errors.supplier}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Order Date *</label>
                                    <input
                                        type="date"
                                        value={reorderForm.data.order_date}
                                        onChange={(e) => reorderForm.setData('order_date', e.target.value)}
                                        required
                                    />
                                    {reorderForm.errors.order_date && <div className="form-error">{reorderForm.errors.order_date}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Transport LR Number</label>
                                    <input
                                        type="text"
                                        value={reorderForm.data.lr_number}
                                        onChange={(e) => reorderForm.setData('lr_number', e.target.value)}
                                        placeholder="LR / docket number"
                                    />
                                    {reorderForm.errors.lr_number && <div className="form-error">{reorderForm.errors.lr_number}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Transport Company</label>
                                    <input
                                        type="text"
                                        value={reorderForm.data.transport_name}
                                        onChange={(e) => reorderForm.setData('transport_name', e.target.value)}
                                        placeholder="e.g. DTDC, Delhivery"
                                    />
                                    {reorderForm.errors.transport_name && <div className="form-error">{reorderForm.errors.transport_name}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Expected Delivery</label>
                                    <input
                                        type="date"
                                        value={reorderForm.data.expected_delivery}
                                        onChange={(e) => reorderForm.setData('expected_delivery', e.target.value)}
                                    />
                                    {reorderForm.errors.expected_delivery && <div className="form-error">{reorderForm.errors.expected_delivery}</div>}
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={reorderForm.data.notes}
                                        onChange={(e) => reorderForm.setData('notes', e.target.value)}
                                    />
                                    {reorderForm.errors.notes && <div className="form-error">{reorderForm.errors.notes}</div>}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setReorderModal(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={reorderForm.processing}>
                                {reorderForm.processing ? 'Saving...' : 'Place Reorder'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Packaging Wizard Modal ────────────────────────────────────── */}
            <div className={`modal-overlay${packModal ? ' open' : ''}`} onClick={() => setPackModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: '95%' }}>
                    <div className="modal-header">
                        <h3>📦 Packaging Wizard — Step {packStep} of 4</h3>
                        <button className="modal-close" onClick={() => setPackModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        {/* Step indicator */}
                        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                            {['Category', 'Size & Details', 'SKU Preview', 'Cost'].map((label, idx) => (
                                <div
                                    key={label}
                                    style={{
                                        flex: 1,
                                        textAlign: 'center',
                                        padding: '8px 4px',
                                        fontSize: 12,
                                        fontWeight: packStep === idx + 1 ? 700 : 400,
                                        background: packStep === idx + 1 ? '#2563eb' : packStep > idx + 1 ? '#d1fae5' : '#f9fafb',
                                        color: packStep === idx + 1 ? '#fff' : packStep > idx + 1 ? '#059669' : '#6b7280',
                                        borderRight: idx < 3 ? '1px solid #e5e7eb' : undefined,
                                    }}
                                >
                                    {packStep > idx + 1 ? '✓ ' : ''}{label}
                                </div>
                            ))}
                        </div>

                        {/* Step 1: Category */}
                        {packStep === 1 && (
                            <div>
                                <p style={{ color: '#6b7280', marginBottom: 16 }}>Select the type of packaging material:</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    {PACKAGING_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.code}
                                            type="button"
                                            onClick={() => packSelectCat(cat)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '14px 8px',
                                                border: '2px solid #e5e7eb',
                                                borderRadius: 10,
                                                background: '#fff',
                                                cursor: 'pointer',
                                                transition: 'border-color 0.15s',
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
                                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                                        >
                                            <span style={{ fontSize: 28 }}>{cat.icon}</span>
                                            <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Size & Details */}
                        {packStep === 2 && packCat && (
                            <div className="form-grid">
                                <div style={{ gridColumn: '1 / -1', marginBottom: 8, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontWeight: 600, color: '#1e40af' }}>
                                    {packCat.icon} {packCat.label}
                                </div>
                                <div className="form-group">
                                    <label>Size (e.g. 500ml, 1L, 100gm)</label>
                                    <input
                                        type="text"
                                        value={packForm.size}
                                        onChange={(e) => setPackForm((p) => ({ ...p, size: e.target.value }))}
                                        placeholder="500ml"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Shape (e.g. Round, Square, Flat)</label>
                                    <input
                                        type="text"
                                        value={packForm.shape}
                                        onChange={(e) => setPackForm((p) => ({ ...p, shape: e.target.value }))}
                                        placeholder="Round"
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Box Dimensions (mm) — L × W × H</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={packForm.dim_l}
                                            onChange={(e) => setPackForm((p) => ({ ...p, dim_l: e.target.value }))}
                                            placeholder="L"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={packForm.dim_w}
                                            onChange={(e) => setPackForm((p) => ({ ...p, dim_w: e.target.value }))}
                                            placeholder="W"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={packForm.dim_h}
                                            onChange={(e) => setPackForm((p) => ({ ...p, dim_h: e.target.value }))}
                                            placeholder="H"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>mm</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>HSN</label>
                                    <input
                                        type="text"
                                        value={packForm.hsn}
                                        onChange={(e) => setPackForm((p) => ({ ...p, hsn: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>GST %</label>
                                    <select
                                        value={packForm.gst}
                                        onChange={(e) => setPackForm((p) => ({ ...p, gst: e.target.value }))}
                                    >
                                        {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 3: SKU Preview */}
                        {packStep === 3 && packCat && (
                            <div className="form-grid">
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Auto-generated SKU</div>
                                        <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#059669' }}>
                                            {packForm.sku || buildSku(packCat.code, packForm.size, packForm.shape)}
                                        </div>
                                        {(packForm.dim_l || packForm.dim_w || packForm.dim_h) && (
                                            <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                                                📐 {[packForm.dim_l || '?', packForm.dim_w || '?', packForm.dim_h || '?'].join(' × ')} mm
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>SKU (editable)</label>
                                    <input
                                        type="text"
                                        value={packForm.sku}
                                        onChange={(e) => setPackForm((p) => ({ ...p, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <select
                                        value={packForm.unit}
                                        onChange={(e) => setPackForm((p) => ({ ...p, unit: e.target.value }))}
                                    >
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <input
                                        type="text"
                                        value={packForm.supplier}
                                        onChange={(e) => setPackForm((p) => ({ ...p, supplier: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Cost */}
                        {packStep === 4 && (
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Initial Stock (qty)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packForm.stock}
                                        onChange={(e) => setPackForm((p) => ({ ...p, stock: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cost/Unit (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packForm.cost_per_unit}
                                        onChange={(e) => setPackForm((p) => ({ ...p, cost_per_unit: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Selling Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packForm.selling_rate}
                                        onChange={(e) => setPackForm((p) => ({ ...p, selling_rate: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={packForm.notes}
                                        onChange={(e) => setPackForm((p) => ({ ...p, notes: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        {packStep > 1 && (
                            <button type="button" className="btn" onClick={() => setPackStep((s) => s - 1)}>Back</button>
                        )}
                        <button type="button" className="btn" onClick={() => setPackModal(false)}>Cancel</button>
                        {packStep === 1 && null}
                        {packStep === 2 && (
                            <button type="button" className="btn primary" onClick={packGoStep3}>Next: SKU Preview</button>
                        )}
                        {packStep === 3 && (
                            <button type="button" className="btn primary" onClick={packGoStep4}>Next: Cost</button>
                        )}
                        {packStep === 4 && (
                            <button type="button" className="btn primary" onClick={submitPackaging} disabled={packSubmitForm.processing}>
                                {packSubmitForm.processing ? 'Creating...' : 'Create Packaging Item'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Scan Bill Modal ───────────────────────────────────────────── */}
            <div className={`modal-overlay${scanModal ? ' open' : ''}`} onClick={() => setScanModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '95%' }}>
                    <div className="modal-header">
                        <h3>📸 Scan Bill</h3>
                        <button className="modal-close" onClick={() => setScanModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div
                            style={{
                                border: '2px dashed #d1d5db',
                                borderRadius: 12,
                                padding: '40px 20px',
                                textAlign: 'center',
                                background: '#f9fafb',
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Upload Bill Image or PDF</div>
                            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
                                Drag &amp; drop or click to select
                            </div>
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                style={{ display: 'block', margin: '0 auto' }}
                            />
                        </div>
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
                            🤖 AI-powered bill scanning will automatically detect items. Upload a bill to get started.
                        </div>
                        <button
                            type="button"
                            className="btn primary"
                            disabled
                            style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                        >
                            🤖 Process with AI — Coming Soon
                        </button>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn" onClick={() => setScanModal(false)}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
