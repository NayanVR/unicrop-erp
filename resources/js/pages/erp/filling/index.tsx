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

type Props = {
    orders: Order[];
    configs: Config[];
    materials: Material[];
};

// Parse packing size string to liters  (e.g. "500ml" → 0.5, "1L" → 1, "5ltr" → 5)
function packingToLiters(size: string | null | undefined): number | null {
    if (!size) return null;
    const s = size.toLowerCase().trim();
    const num = parseFloat(s);
    if (isNaN(num)) return null;
    if (s.includes('ml')) return num / 1000;
    if (s.includes('l')) return num;
    return null;
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

const PRIORITY_BORDER: Record<string, string> = {
    urgent: '#dc2626', high: '#d97706', normal: '#2563eb',
};

export default function FillingIndex({ orders, configs, materials }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin = auth.user?.role === 'admin';

    const [configModal, setConfigModal] = useState<{ brand: string; size: string | null } | null>(null);
    const [configForm, setConfigForm] = useState({
        fill_material_id: '', bottle_id: '', label_id: '',
        outer_box_id: '', printed_box_id: '', carton_size: '12',
    });
    const [saving, setSaving] = useState(false);

    // Group all filling items by our_brand
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

    // Get config for brand+size (exact match first, then brand-level fallback)
    const getConfig = (brand: string, size: string | null) =>
        configs.find((c) => c.our_brand === brand && c.packing_size === size) ??
        configs.find((c) => c.our_brand === brand && c.packing_size === null);

    const openConfig = (brand: string, size: string | null) => {
        const existing = getConfig(brand, size);
        setConfigForm({
            fill_material_id: String(existing?.fill_material_id ?? ''),
            bottle_id:        String(existing?.bottle_id ?? ''),
            label_id:         String(existing?.label_id ?? ''),
            outer_box_id:     String(existing?.outer_box_id ?? ''),
            printed_box_id:   String(existing?.printed_box_id ?? ''),
            carton_size:      String(existing?.carton_size ?? 12),
        });
        setConfigModal({ brand, size });
    };

    const saveConfig = () => {
        if (!configModal) return;
        setSaving(true);
        router.post('/filling/configs', {
            our_brand:        configModal.brand,
            packing_size:     configModal.size,
            fill_material_id: configForm.fill_material_id || null,
            bottle_id:        configForm.bottle_id || null,
            label_id:         configForm.label_id || null,
            outer_box_id:     configForm.outer_box_id || null,
            printed_box_id:   configForm.printed_box_id || null,
            carton_size:      configForm.carton_size || '12',
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
            onSuccess: () => setConfigModal(null),
        });
    };

    return (
        <>
            <Head title="Filling" />
            <div id="view-filling" className="view active">

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🧪 Filling</h1>
                    </div>
                    <span style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
                        {brandMap.size} product{brandMap.size !== 1 ? 's' : ''}
                    </span>
                </div>

                {brandMap.size === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🧪</div>
                        <p>No orders are currently in the filling stage.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {[...brandMap.entries()].map(([brand, { sizes, orders: orderNums }]) => {
                            const border = '#2563eb';
                            return (
                                <div
                                    key={brand}
                                    style={{
                                        background: '#fff',
                                        border: '1px solid var(--border)',
                                        borderLeft: `4px solid ${border}`,
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

                                    {/* Pack sizes breakdown */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8 }}>Pack Sizes</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {[...sizes.entries()]
                                                .sort(([a], [b]) => {
                                                    const la = packingToLiters(a) ?? 0;
                                                    const lb = packingToLiters(b) ?? 0;
                                                    return lb - la;
                                                })
                                                .map(([size, qty]) => (
                                                    <div
                                                        key={size}
                                                        style={{
                                                            background: '#eff6ff',
                                                            border: '1px solid #bfdbfe',
                                                            borderRadius: 8,
                                                            padding: '6px 12px',
                                                            textAlign: 'center',
                                                            minWidth: 70,
                                                        }}
                                                    >
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{size}</div>
                                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{fmtQty(qty)}</div>
                                                        <div style={{ fontSize: 10, color: '#6b7280' }}>pcs</div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Materials needed — one row per pack size */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Materials Needed</span>
                                            {isAdmin && (
                                                <button
                                                    className="btn sm"
                                                    style={{ fontSize: 10, padding: '1px 8px' }}
                                                    onClick={() => openConfig(brand, null)}
                                                >
                                                    ⚙ Setup
                                                </button>
                                            )}
                                        </div>

                                        {[...sizes.entries()].map(([size, qty]) => {
                                            const cfg     = getConfig(brand, size);
                                            const liters  = packingToLiters(size);
                                            const fillQty = liters != null ? qty * liters : null;
                                            const boxQty  = cfg ? Math.ceil(qty / cfg.carton_size) : null;

                                            const rows: { icon: string; label: string; mat: Material | null | undefined; need: number; unit: string }[] = [
                                                { icon: '🧪', label: 'Fill', mat: cfg?.fill_material, need: fillQty ?? qty, unit: fillQty != null ? 'L' : cfg?.fill_material?.unit ?? '—' },
                                                { icon: '🍶', label: 'Bottle', mat: cfg?.bottle, need: qty, unit: cfg?.bottle?.unit ?? 'pcs' },
                                                { icon: '🏷', label: 'Label', mat: cfg?.label, need: qty, unit: cfg?.label?.unit ?? 'pcs' },
                                                { icon: '📦', label: 'Outer Box', mat: cfg?.outer_box, need: boxQty ?? qty, unit: cfg?.outer_box?.unit ?? 'pcs' },
                                                { icon: '🗃', label: 'Printed Box', mat: cfg?.printed_box, need: qty, unit: cfg?.printed_box?.unit ?? 'pcs' },
                                            ];

                                            return (
                                                <div key={size} style={{ marginBottom: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '1px 8px', borderRadius: 6 }}>{size}</span>
                                                        {isAdmin && (
                                                            <button
                                                                className="btn sm"
                                                                style={{ fontSize: 10, padding: '1px 6px' }}
                                                                onClick={() => openConfig(brand, size)}
                                                            >
                                                                ⚙
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {rows.map((row) => (
                                                            <div
                                                                key={row.label}
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
                                                                    <span>{row.icon}</span>
                                                                    <span style={{ color: 'var(--tx-muted)', fontSize: 11, width: 64, flexShrink: 0 }}>{row.label}</span>
                                                                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {row.mat?.name ?? <span style={{ color: 'var(--tx-faint)', fontStyle: 'italic', fontWeight: 400 }}>not configured</span>}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                    <span style={{ fontWeight: 700 }}>{fmtQty(row.need)} {row.unit}</span>
                                                                    {row.mat && (
                                                                        <StockBadge
                                                                            needed={row.need}
                                                                            stock={Number(row.mat.stock_qty)}
                                                                            unit={row.unit}
                                                                        />
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
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Config Modal */}
            {configModal && (
                <div className="modal-overlay open" onClick={() => setConfigModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>⚙ Configure Materials — {configModal.brand}{configModal.size ? ` · ${configModal.size}` : ' (all sizes)'}</h2>
                            <button className="modal-close" onClick={() => setConfigModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 14, background: '#eff6ff', padding: '8px 12px', borderRadius: 6 }}>
                                Link each material type to an inventory item for <strong>{configModal.brand}{configModal.size ? ` ${configModal.size}` : ''}</strong>.
                                {!configModal.size && ' This will apply to all pack sizes unless a size-specific config exists.'}
                            </div>

                            {[
                                { key: 'fill_material_id', label: '🧪 Fill Material', hint: 'The liquid/powder to be filled' },
                                { key: 'bottle_id',        label: '🍶 Bottle',        hint: '1 pcs per unit' },
                                { key: 'label_id',         label: '🏷 Label',         hint: '1 pcs per unit' },
                                { key: 'outer_box_id',     label: '📦 Outer Box',     hint: 'Carton holding multiple bottles' },
                                { key: 'printed_box_id',   label: '🗃 Printed Box',   hint: '1 pcs per unit (retail box)' },
                            ].map(({ key, label, hint }) => (
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
                            <button className="btn" onClick={() => setConfigModal(null)}>Cancel</button>
                            <button className="btn primary" onClick={saveConfig} disabled={saving}>
                                {saving ? 'Saving…' : '💾 Save Config'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
