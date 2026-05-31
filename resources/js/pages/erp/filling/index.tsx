import type { Auth } from '@/types/auth';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

type OrderItem = {
    id: number;
    order_id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    quantity: string | number;
    status: string;
};

type Order = {
    id: number;
    order_number: string;
    company_name: string;
    priority?: string | null;
    items: OrderItem[];
};

type Material = {
    id: number;
    name: string;
    unit: string;
    stock_qty: string | number;
    category?: string | null;
};

type Config = {
    id: number;
    our_brand: string;
    packing_size: string | null;
    fill_material_id: number | null;
    bottle_id: number | null;
    label_id: number | null;
    outer_box_id: number | null;
    printed_box_id: number | null;
    carton_size: number;
    fill_material?: Material | null;
    bottle?: Material | null;
    label?: Material | null;
    outer_box?: Material | null;
    printed_box?: Material | null;
};

type FillingRunItem = { role: string; raw_material_id: number; name: string; qty: number; unit: string };
type FillingRun = {
    id: number;
    our_brand: string;
    packing_size: string | null;
    quantity: number;
    user?: { id: number; name: string } | null;
    items: FillingRunItem[];
    created_at: string;
};

type Props = {
    orders: Order[];
    configs: Config[];
    materials: Material[];
    fillingRuns: FillingRun[];
};

function packingToLiters(size: string | null | undefined): number | null {
    if (!size) return null;
    const s = size.toLowerCase().trim();
    const num = parseFloat(s);
    if (isNaN(num)) return null;
    if (s.includes('ml')) return num / 1000;
    if (s.includes('l')) return num;
    return null;
}

function fillNeedFrontend(liters: number, unit: string): number {
    const u = unit.toLowerCase().trim();
    if (['ml', 'milliliter', 'millilitre', 'g', 'gm', 'gram', 'grams'].includes(u)) return liters * 1000;
    return liters;
}

function fmtQty(n: number) {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function StockBadge({ needed, stock, unit }: { needed: number; stock: number; unit: string }) {
    const ok = stock >= needed;
    return (
        <span style={{
            fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap',
            color: ok ? '#059669' : '#dc2626',
            background: ok ? '#d1fae5' : '#fee2e2',
        }}>
            Stock: {fmtQty(stock)} {unit}
        </span>
    );
}

type MatRow = { icon: string; label: string; mat: Material | null | undefined; need: number; unit: string };

function calculateNeeds(cfg: Config, qty: number): MatRow[] {
    const liters = packingToLiters(cfg.packing_size);
    const cartonQty = Math.max(1, cfg.carton_size ?? 12);
    const rows: MatRow[] = [];

    if (cfg.fill_material && liters != null) {
        const raw  = qty * liters;
        const need = fillNeedFrontend(raw, cfg.fill_material.unit);
        rows.push({ icon: '🧪', label: 'Fill', mat: cfg.fill_material, need, unit: cfg.fill_material.unit });
    }
    if (cfg.bottle)      rows.push({ icon: '🍶', label: 'Bottle',      mat: cfg.bottle,      need: qty,                        unit: cfg.bottle.unit });
    if (cfg.label)       rows.push({ icon: '🏷', label: 'Label',       mat: cfg.label,       need: qty,                        unit: cfg.label.unit });
    if (cfg.outer_box)   rows.push({ icon: '📦', label: 'Outer Box',   mat: cfg.outer_box,   need: Math.ceil(qty / cartonQty), unit: cfg.outer_box.unit });
    if (cfg.printed_box) rows.push({ icon: '🗃', label: 'Printed Box', mat: cfg.printed_box, need: qty,                        unit: cfg.printed_box.unit });

    return rows;
}

const MATERIAL_DEFS = [
    { key: 'fill_material_id', label: '🧪 Fill Material', hint: 'The liquid/powder to be filled' },
    { key: 'bottle_id',        label: '🍶 Bottle',        hint: '1 pcs per unit' },
    { key: 'label_id',         label: '🏷 Label',         hint: '1 pcs per unit' },
    { key: 'outer_box_id',     label: '📦 Outer Box',     hint: 'Carton holding multiple bottles' },
    { key: 'printed_box_id',   label: '🗃 Printed Box',   hint: '1 pcs per unit (retail box)' },
] as const;

const MAT_ICON: Record<string, string> = {
    fill_material: '🧪', bottle: '🍶', label: '🏷', outer_box: '📦', printed_box: '🗃',
};
const MAT_KEYS = ['fill_material', 'bottle', 'label', 'outer_box', 'printed_box'] as const;

export default function FillingIndex({ orders, configs, materials, fillingRuns }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin = auth.user?.role === 'admin';

    const [pageView, setPageView] = useState<'recipes' | 'filling' | 'history'>('recipes');
    const [histSearch, setHistSearch] = useState('');
    const [recipeQtys, setRecipeQtys] = useState<Record<number, string>>({});

    // Config modal
    const [configModal, setConfigModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<Config | null>(null);
    const [configForm, setConfigForm] = useState({
        our_brand: '', packing_size: '',
        fill_material_id: '', bottle_id: '', label_id: '',
        outer_box_id: '', printed_box_id: '', carton_size: '12',
    });
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState<string | null>(null);

    // Group filling-stage order items by brand
    const brandMap = new Map<string, { sizes: Map<string, number>; orders: Set<string> }>();
    for (const order of orders) {
        for (const item of order.items) {
            if (item.status !== 'filling') continue;
            const brand = item.our_brand ?? '(unknown)';
            const size  = item.packing_size ?? '—';
            if (!brandMap.has(brand)) brandMap.set(brand, { sizes: new Map(), orders: new Set() });
            const entry = brandMap.get(brand)!;
            entry.sizes.set(size, (entry.sizes.get(size) ?? 0) + Number(item.quantity));
            entry.orders.add(order.order_number);
        }
    }

    // Get config for brand+size (exact first, then brand-level fallback)
    const getConfig = (brand: string, size: string | null) =>
        configs.find((c) => c.our_brand === brand && c.packing_size === size) ??
        configs.find((c) => c.our_brand === brand && c.packing_size === null);

    // Open modal for new recipe
    const openNewRecipe = () => {
        setEditingConfig(null);
        setConfigForm({ our_brand: '', packing_size: '', fill_material_id: '', bottle_id: '', label_id: '', outer_box_id: '', printed_box_id: '', carton_size: '12' });
        setConfigModal(true);
    };

    // Open modal for editing existing config
    const openEditConfig = (cfg: Config) => {
        setEditingConfig(cfg);
        setConfigForm({
            our_brand:        cfg.our_brand,
            packing_size:     cfg.packing_size ?? '',
            fill_material_id: String(cfg.fill_material_id ?? ''),
            bottle_id:        String(cfg.bottle_id ?? ''),
            label_id:         String(cfg.label_id ?? ''),
            outer_box_id:     String(cfg.outer_box_id ?? ''),
            printed_box_id:   String(cfg.printed_box_id ?? ''),
            carton_size:      String(cfg.carton_size ?? 12),
        });
        setConfigModal(true);
    };

    // Open modal from order card ⚙ button
    const openConfigFromOrder = (brand: string, size: string | null) => {
        const existing = getConfig(brand, size);
        if (existing) {
            openEditConfig(existing);
        } else {
            setEditingConfig(null);
            setConfigForm({ our_brand: brand, packing_size: size ?? '', fill_material_id: '', bottle_id: '', label_id: '', outer_box_id: '', printed_box_id: '', carton_size: '12' });
            setConfigModal(true);
        }
    };

    const saveConfig = () => {
        setSaving(true);
        router.post('/filling/configs', {
            our_brand:        configForm.our_brand,
            packing_size:     configForm.packing_size || null,
            fill_material_id: configForm.fill_material_id || null,
            bottle_id:        configForm.bottle_id || null,
            label_id:         configForm.label_id || null,
            outer_box_id:     configForm.outer_box_id || null,
            printed_box_id:   configForm.printed_box_id || null,
            carton_size:      configForm.carton_size || '12',
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
            onSuccess: () => setConfigModal(false),
        });
    };

    const deleteConfig = (cfg: Config) => {
        const label = cfg.our_brand + (cfg.packing_size ? ` ${cfg.packing_size}` : '');
        if (!confirm(`Delete filling recipe "${label}"?\n\nThis only removes the recipe — it won't affect run history.`)) return;
        router.delete(`/filling/configs/${cfg.id}`, { preserveScroll: true });
    };

    // Run filling from recipe card
    const runFromRecipe = (cfg: Config, qty: number) => {
        const rows = calculateNeeds(cfg, qty);
        const label = cfg.our_brand + (cfg.packing_size ? ` ${cfg.packing_size}` : '');
        if (rows.length === 0) {
            alert('No materials configured for this recipe. Click Edit to set them up first.');
            return;
        }
        const lines = rows.map((r) => `  ${r.icon} ${r.mat!.name}: ${fmtQty(r.need)} ${r.unit}`).join('\n');
        if (!window.confirm(`Run Filling — ${label} × ${qty} pcs\n\nThis will deduct from inventory:\n${lines}\n\nProceed?`)) return;
        const key = `r${cfg.id}`;
        setRunning(key);
        router.post('/filling/run', { our_brand: cfg.our_brand, packing_size: cfg.packing_size, quantity: qty }, {
            preserveScroll: true,
            onFinish: () => setRunning(null),
            onSuccess: () => setRecipeQtys((q) => ({ ...q, [cfg.id]: '' })),
        });
    };

    // Run filling from In Filling order card
    const runFilling = (
        brand: string,
        size: string,
        qty: number,
        rows: MatRow[],
    ) => {
        const lines = rows
            .filter((r) => r.mat)
            .map((r) => `  ${r.icon} ${r.mat!.name}: ${fmtQty(r.need)} ${r.unit}`)
            .join('\n');
        if (!lines) {
            alert('No materials configured for this product. Click ⚙ to set up first.');
            return;
        }
        if (!window.confirm(`Run Filling — ${brand} ${size} × ${qty} pcs\n\nThis will deduct from inventory:\n${lines}\n\nProceed?`)) return;
        const key = `o${brand}|${size}`;
        setRunning(key);
        router.post('/filling/run', { our_brand: brand, packing_size: size, quantity: qty }, {
            preserveScroll: true,
            onFinish: () => setRunning(null),
        });
    };

    return (
        <>
            <Head title="Filling" />
            <div id="view-filling" className="view active">

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🧪 Filling</h1>
                    {pageView === 'recipes' && isAdmin && (
                        <button className="btn primary" onClick={openNewRecipe} style={{ fontWeight: 600 }}>
                            + Add New Filling Product
                        </button>
                    )}
                </div>

                {/* Tab switcher */}
                <div className="filter-bar" style={{ marginBottom: 20 }}>
                    <button className={`pill${pageView === 'recipes' ? ' active' : ''}`} onClick={() => setPageView('recipes')} style={{ fontWeight: pageView === 'recipes' ? 600 : 400 }}>
                        🧾 Recipes ({configs.length})
                    </button>
                    <button className={`pill${pageView === 'filling' ? ' active' : ''}`} onClick={() => setPageView('filling')} style={{ fontWeight: pageView === 'filling' ? 600 : 400 }}>
                        🧪 In Filling ({brandMap.size})
                    </button>
                    <button className={`pill${pageView === 'history' ? ' active' : ''}`} onClick={() => setPageView('history')} style={{ fontWeight: pageView === 'history' ? 600 : 400 }}>
                        📋 Run History ({fillingRuns.length})
                    </button>
                </div>

                {/* ── Recipes tab ── */}
                {pageView === 'recipes' && (
                    configs.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🧾</div>
                            <p>No filling recipes yet.{isAdmin ? ' Click "Add New Filling Product" to create one.' : ''}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                            {configs.map((cfg) => {
                                const label      = cfg.our_brand + (cfg.packing_size ? ` ${cfg.packing_size}` : '');
                                const inputQty   = Number(recipeQtys[cfg.id] ?? 0);
                                const needs      = inputQty > 0 ? calculateNeeds(cfg, inputQty) : [];
                                const hasMatCfg  = MAT_KEYS.some((k) => cfg[k]);
                                const runKey     = `r${cfg.id}`;

                                return (
                                    <div
                                        key={cfg.id}
                                        style={{
                                            background: '#fff',
                                            border: '1px solid var(--border)',
                                            borderLeft: '4px solid #7c3aed',
                                            borderRadius: 10,
                                            padding: '16px 18px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 12,
                                            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                        }}
                                    >
                                        {/* Card header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 17 }}>{cfg.our_brand}</div>
                                                <div style={{ fontSize: 13, color: 'var(--tx-muted)', marginTop: 2 }}>
                                                    {cfg.packing_size ?? <span style={{ fontStyle: 'italic', color: 'var(--tx-faint)' }}>all sizes</span>}
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                    <button className="btn sm" onClick={() => openEditConfig(cfg)} style={{ fontSize: 11 }}>✏ Edit</button>
                                                    <button className="btn sm danger" onClick={() => deleteConfig(cfg)} style={{ fontSize: 11 }}>Delete</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Materials list */}
                                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8 }}>
                                                Materials
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {MAT_KEYS.map((k) => {
                                                    const mat  = cfg[k] as Material | null | undefined;
                                                    const icon = MAT_ICON[k];
                                                    const lbl  = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                                                    const needRow = needs.find((r) => r.mat?.id === mat?.id);
                                                    return (
                                                        <div
                                                            key={k}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                padding: '5px 10px',
                                                                background: 'var(--bg-paper)',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--border)',
                                                                fontSize: 13,
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                                                <span>{icon}</span>
                                                                <span style={{ color: 'var(--tx-muted)', fontSize: 11, width: 72, flexShrink: 0 }}>{lbl}</span>
                                                                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {mat?.name ?? <span style={{ color: 'var(--tx-faint)', fontStyle: 'italic', fontWeight: 400 }}>not set</span>}
                                                                </span>
                                                            </div>
                                                            {mat && needRow && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                    <span style={{ fontWeight: 700, fontSize: 12 }}>{fmtQty(needRow.need)} {needRow.unit}</span>
                                                                    <StockBadge needed={needRow.need} stock={Number(mat.stock_qty)} unit={needRow.unit} />
                                                                </div>
                                                            )}
                                                            {mat && !needRow && (
                                                                <span style={{ fontSize: 11, color: 'var(--tx-muted)' }}>
                                                                    Stock: {fmtQty(Number(mat.stock_qty))} {mat.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {cfg.packing_size && (
                                                    <div style={{ fontSize: 11, color: 'var(--tx-muted)', padding: '2px 4px' }}>
                                                        📦 Carton size: <strong>{cfg.carton_size}</strong> bottles per box
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Run section */}
                                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8 }}>
                                                Run Filling
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Quantity (pcs)"
                                                    value={recipeQtys[cfg.id] ?? ''}
                                                    onChange={(e) => setRecipeQtys((q) => ({ ...q, [cfg.id]: e.target.value }))}
                                                    style={{ width: 150 }}
                                                />
                                                <button
                                                    className="btn primary"
                                                    disabled={!recipeQtys[cfg.id] || Number(recipeQtys[cfg.id]) < 1 || !hasMatCfg || running === runKey}
                                                    title={!hasMatCfg ? 'Configure materials first (Edit)' : ''}
                                                    onClick={() => runFromRecipe(cfg, inputQty)}
                                                >
                                                    {running === runKey ? '…' : '▶ Run Filling'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}

                {/* ── In Filling tab ── */}
                {pageView === 'filling' && (brandMap.size === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🧪</div>
                        <p>No orders are currently in the filling stage.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {[...brandMap.entries()].map(([brand, { sizes, orders: orderNums }]) => (
                            <div
                                key={brand}
                                style={{
                                    background: '#fff',
                                    border: '1px solid var(--border)',
                                    borderLeft: '4px solid #2563eb',
                                    borderRadius: 10,
                                    padding: '16px 18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                }}
                            >
                                {/* Brand header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontWeight: 700, fontSize: 17 }}>{brand}</div>
                                    <div style={{ fontSize: 11, color: 'var(--tx-muted)', textAlign: 'right' }}>
                                        {[...orderNums].join(', ')}
                                    </div>
                                </div>

                                {/* Pack sizes */}
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8 }}>Pack Sizes</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {[...sizes.entries()]
                                            .sort(([a], [b]) => (packingToLiters(b) ?? 0) - (packingToLiters(a) ?? 0))
                                            .map(([size, qty]) => (
                                                <div
                                                    key={size}
                                                    style={{
                                                        background: '#eff6ff', border: '1px solid #bfdbfe',
                                                        borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 70,
                                                    }}
                                                >
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{size}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{fmtQty(qty)}</div>
                                                    <div style={{ fontSize: 10, color: '#6b7280' }}>pcs</div>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Materials per size */}
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Materials Needed</span>
                                        {isAdmin && (
                                            <button className="btn sm" style={{ fontSize: 10, padding: '1px 8px' }} onClick={() => openConfigFromOrder(brand, null)}>
                                                ⚙ Setup
                                            </button>
                                        )}
                                    </div>

                                    {[...sizes.entries()].map(([size, qty]) => {
                                        const cfg    = getConfig(brand, size);
                                        const rows: MatRow[] = cfg
                                            ? calculateNeeds(cfg, qty)
                                            : [
                                                { icon: '🧪', label: 'Fill',        mat: null, need: qty, unit: '—' },
                                                { icon: '🍶', label: 'Bottle',      mat: null, need: qty, unit: '—' },
                                                { icon: '🏷', label: 'Label',       mat: null, need: qty, unit: '—' },
                                                { icon: '📦', label: 'Outer Box',   mat: null, need: qty, unit: '—' },
                                                { icon: '🗃', label: 'Printed Box', mat: null, need: qty, unit: '—' },
                                            ];
                                        const hasConfig = rows.some((r) => r.mat);
                                        const runKey   = `o${brand}|${size}`;

                                        return (
                                            <div key={size} style={{ marginBottom: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '1px 8px', borderRadius: 6 }}>{size}</span>
                                                    {isAdmin && (
                                                        <button className="btn sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => openConfigFromOrder(brand, size)}>⚙</button>
                                                    )}
                                                    <button
                                                        className="btn sm primary"
                                                        style={{ fontSize: 10, padding: '1px 8px', marginLeft: 'auto' }}
                                                        disabled={!hasConfig || running === runKey}
                                                        title={hasConfig ? '' : 'Configure materials first'}
                                                        onClick={() => runFilling(brand, size, qty, rows)}
                                                    >
                                                        {running === runKey ? '…' : '▶ Run Filling'}
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {rows.map((row) => (
                                                        <div
                                                            key={row.label}
                                                            style={{
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                gap: 8, padding: '5px 10px',
                                                                background: 'var(--bg-paper)', borderRadius: 6,
                                                                border: '1px solid var(--border)', fontSize: 13,
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                                                <span>{row.icon}</span>
                                                                <span style={{ color: 'var(--tx-muted)', fontSize: 11, width: 64, flexShrink: 0 }}>{row.label}</span>
                                                                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {row.mat?.name ?? <span style={{ color: 'var(--tx-faint)', fontStyle: 'italic', fontWeight: 400 }}>not configured</span>}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                <span style={{ fontWeight: 700 }}>{fmtQty(row.need)} {row.unit}</span>
                                                                {row.mat && (
                                                                    <StockBadge needed={row.need} stock={Number(row.mat.stock_qty)} unit={row.unit} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {/* ── Run History tab ── */}
                {pageView === 'history' && (
                    <div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                            <input
                                type="search"
                                value={histSearch}
                                onChange={(e) => setHistSearch(e.target.value)}
                                placeholder="🔍 Search by product or size..."
                                style={{ width: 280 }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--tx-muted)' }}>{fillingRuns.length} run{fillingRuns.length !== 1 ? 's' : ''}</span>
                        </div>
                        {fillingRuns.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon">📋</div>
                                <p>No filling runs yet. Run a filling to start recording history.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-paper)', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date &amp; Time</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Product</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Size</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Qty (pcs)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Materials Used</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)' }}>By</th>
                                            {isAdmin && <th style={{ padding: '8px 12px' }}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fillingRuns
                                            .filter((r) => {
                                                if (!histSearch.trim()) return true;
                                                const q = histSearch.toLowerCase();
                                                return r.our_brand.toLowerCase().includes(q) || (r.packing_size ?? '').toLowerCase().includes(q);
                                            })
                                            .map((r) => (
                                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--tx-muted)', fontSize: 12 }}>
                                                        {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.our_brand}</td>
                                                    <td style={{ padding: '8px 12px' }}>{r.packing_size ?? '—'}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtQty(Number(r.quantity))}</td>
                                                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--tx-sub)', maxWidth: 320 }}>
                                                        {(r.items ?? []).map((it) => `${it.name} (${fmtQty(it.qty)} ${it.unit})`).join(', ') || '—'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', color: 'var(--tx-muted)', fontSize: 12 }}>{r.user?.name ?? '—'}</td>
                                                    {isAdmin && (
                                                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                            <button className="btn sm danger" onClick={() => {
                                                                if (!confirm(`Delete this filling run?\n\n${r.our_brand} ${r.packing_size ?? ''} × ${r.quantity} pcs\n\nThis will restore the deducted materials to stock.`)) return;
                                                                router.delete(`/filling/runs/${r.id}`, { preserveScroll: true });
                                                            }}>Delete</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Config / Recipe Modal */}
            {configModal && (
                <div className="modal-overlay open" onClick={() => setConfigModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2>{editingConfig ? '✏ Edit Filling Recipe' : '+ Add New Filling Product'}</h2>
                            <button className="modal-close" onClick={() => setConfigModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">

                            {/* Product name */}
                            <div className="form-group">
                                <label>Product Name <span style={{ color: '#dc2626' }}>*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Ultra Gold"
                                    value={configForm.our_brand}
                                    onChange={(e) => setConfigForm((f) => ({ ...f, our_brand: e.target.value }))}
                                />
                            </div>

                            {/* Packing size */}
                            <div className="form-group">
                                <label>
                                    Packing Size
                                    <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--tx-muted)' }}> — optional, e.g. 500ml, 1L, 5ltr</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Leave blank to apply to all sizes"
                                    value={configForm.packing_size}
                                    onChange={(e) => setConfigForm((f) => ({ ...f, packing_size: e.target.value }))}
                                />
                                {!configForm.packing_size && (
                                    <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                                        Without a size this will apply to all pack sizes unless a size-specific recipe exists.
                                    </div>
                                )}
                            </div>

                            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0 16px' }} />

                            {/* Material dropdowns */}
                            {MATERIAL_DEFS.map(({ key, label, hint }) => (
                                <div className="form-group" key={key}>
                                    <label>{label} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--tx-muted)' }}>— {hint}</span></label>
                                    <select
                                        value={configForm[key as keyof typeof configForm]}
                                        onChange={(e) => setConfigForm((f) => ({ ...f, [key]: e.target.value }))}
                                    >
                                        <option value="">— Not configured —</option>
                                        {materials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({fmtQty(Number(m.stock_qty))} {m.unit} in stock)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}

                            <div className="form-group">
                                <label>📦 Outer Box Carton Size <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--tx-muted)' }}>— bottles per carton</span></label>
                                <input
                                    type="number"
                                    min="1"
                                    value={configForm.carton_size}
                                    onChange={(e) => setConfigForm((f) => ({ ...f, carton_size: e.target.value }))}
                                    style={{ width: 120 }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setConfigModal(false)}>Cancel</button>
                            <button className="btn primary" onClick={saveConfig} disabled={saving || !configForm.our_brand.trim()}>
                                {saving ? 'Saving…' : '💾 Save Recipe'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
