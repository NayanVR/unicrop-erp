
import {
    destroy as designDestroy,
    setStage as designSetStage,
    store as designStore,
    update as designUpdate,
} from '@/routes/design';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Designer = { id: number; name: string };
type StageLogEntry = { stage: string; at: string; by?: string | null };

type DesignOrder = {
    id: number;
    created_by: number | null;
    assigned_to: number | null;
    order_id: number | null;
    order_qty: number | null;
    pcs_to_print: number | null;
    labels_received: number | null;
    party_brand: string;
    product_name: string;
    packing_size: string | null;
    label_dimensions: string | null;
    instructions: string | null;
    notes: string | null;
    status: string;
    skip_party_approval: boolean;
    stage_log: StageLogEntry[] | null;
    due_date: string | null;
    created_at: string;
    creator: { id: number; name: string } | null;
    assignee: { id: number; name: string } | null;
    order: { id: number; order_number: string; company_name: string; customer_name?: string } | null;
};

type Stats = { total: number; pending: number; in_progress: number; completed: number; received_factory: number };

type GalleryPhoto = {
    id: number;
    party_name: string | null;
    our_brand: string | null;
    party_brand: string | null;
    packing_size: string | null;
    mrp: string | number | null;
    sizes: { packing_size: string; mrp: string | number }[];
    bottle_jar: string | null;
    cap_color: string | null;
    photo_url: string;
};

type PageProps = {
    designOrders: DesignOrder[];
    designers: Designer[];
    stats: Stats;
    galleryPhotos: GalleryPhoto[];
    flash?: { success?: string; error?: string };
};

const STAGES = [
    { key: 'pending',          label: 'Pending Acceptance' },
    { key: 'accepted',         label: 'Accepted' },
    { key: 'design-ready',     label: 'Design Ready' },
    { key: 'approved-party',   label: 'Party Approved' },
    { key: 'sent-print',       label: 'Sent to Print' },
    { key: 'completed',        label: 'Completed' },
    { key: 'received-factory', label: 'Received at Factory' },
];

const statusLabel = (s: string) => STAGES.find((st) => st.key === s)?.label ?? s;

const defaultForm = {
    assigned_to: '', order_id: '', party_brand: '', product_name: '',
    packing_size: '', label_dimensions: '', instructions: '', notes: '', due_date: '',
};

const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function DesignIndex() {
    const { designOrders, designers, stats, galleryPhotos, flash, auth } = usePage<PageProps & { auth: { user?: { role?: string; roles?: { slug: string }[] } } }>().props;
    const userRole = auth?.user?.role ?? auth?.user?.roles?.[0]?.slug ?? '';
    const canManage = userRole === 'design' || userRole === 'admin';

    const [showModal, setShowModal]     = useState(false);
    const [galleryPopup, setGalleryPopup] = useState<{ item: DesignOrder; matches: GalleryPhoto[] } | null>(null);

    const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

    const openGalleryPopup = (d: DesignOrder) => {
        const pn = norm(d.product_name);
        const pb = norm(d.party_brand);
        const photos = galleryPhotos ?? [];

        // Both strings must be non-empty and long enough before we accept a
        // partial hit — otherwise an empty field matches every product.
        const partial = (a: string, b: string) =>
            a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));

        // 1. Exact product-name match on either brand field
        let matches = photos.filter((g) => pn && (norm(g.our_brand) === pn || norm(g.party_brand) === pn));

        // 2. Same product name + party brand pair
        if (matches.length === 0 && pn && pb) {
            matches = photos.filter((g) => partial(norm(g.our_brand), pn) && partial(norm(g.party_brand), pb));
        }

        // 3. Fall back to a partial hit on the product name alone
        if (matches.length === 0 && pn) {
            matches = photos.filter((g) => partial(norm(g.our_brand), pn) || partial(norm(g.party_brand), pn));
        }

        setGalleryPopup({ item: d, matches });
    };
    const [editing, setEditing]         = useState<DesignOrder | null>(null);
    const [search, setSearch]           = useState('');
    const [filterStage, setFilterStage] = useState('all');

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => { reset(); setEditing(null); setShowModal(true); };
    const openEdit = (d: DesignOrder) => {
        setEditing(d);
        setData({
            assigned_to: d.assigned_to?.toString() ?? '',
            order_id: d.order_id?.toString() ?? '',
            party_brand: d.party_brand,
            product_name: d.product_name,
            packing_size: d.packing_size ?? '',
            label_dimensions: d.label_dimensions ?? '',
            instructions: d.instructions ?? '',
            notes: d.notes ?? '',
            due_date: d.due_date ? d.due_date.split('T')[0] : '',
        });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing) {
            patch(designUpdate(editing.id).url, { onSuccess: () => { setShowModal(false); reset(); } });
        } else {
            post(designStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
        }
    };

    const deleteOrder = (d: DesignOrder) => {
        if (!confirm(`Delete design order for "${d.party_brand} – ${d.product_name}"?`)) return;
        router.delete(designDestroy(d.id).url);
    };

    const changeStage = (d: DesignOrder, stage: string) => {
        router.post(designSetStage(d.id).url, { stage });
    };

    const filtered = designOrders.filter((d) => {
        if (filterStage !== 'all' && d.status !== filterStage) return false;
        if (search) {
            const q = search.toLowerCase();
            return d.party_brand.toLowerCase().includes(q)
                || d.product_name.toLowerCase().includes(q)
                || (d.order?.order_number ?? '').toLowerCase().includes(q)
                || (d.order?.company_name ?? '').toLowerCase().includes(q);
        }
        return true;
    });

    // Group by order_id — same order = one card; standalone (no order_id) = own card each
    const grouped: { key: string; items: DesignOrder[] }[] = [];
    const seen = new Map<string, DesignOrder[]>();
    for (const d of filtered) {
        const key = d.order_id ? `order-${d.order_id}` : `standalone-${d.id}`;
        if (!seen.has(key)) { seen.set(key, []); grouped.push({ key, items: seen.get(key)! }); }
        seen.get(key)!.push(d);
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Design Workflow</h1>
                    <p>Manage label design orders and track printing progress.</p>
                </div>
                {canManage && <button className="btn primary" onClick={openAdd}>＋ New Design Order</button>}
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: '20px' }}>
                {[
                    { label: 'Total', value: stats.total },
                    { label: 'Pending Acceptance', value: stats.pending },
                    { label: 'In Progress', value: stats.in_progress },
                    { label: 'Completed', value: stats.completed },
                    { label: 'At Factory', value: stats.received_factory },
                ].map((s) => (
                    <div key={s.label} className="stat-card">
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ marginBottom: '16px' }}>
                <input
                    className="search-input"
                    placeholder="Search brand or product…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, maxWidth: '260px' }}
                />
                <button className={`pill${filterStage === 'all' ? ' active' : ''}`} onClick={() => setFilterStage('all')}>All</button>
                {STAGES.map((s) => (
                    <button key={s.key} className={`pill${filterStage === s.key ? ' active' : ''}`} onClick={() => setFilterStage(s.key)}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Order cards — one per order */}
            {grouped.length === 0 ? (
                <div className="empty-state"><div className="icon">🎨</div><p>No design orders found.</p></div>
            ) : (
                grouped.map(({ key, items }) => {
                    const first = items[0];
                    const order = first.order;
                    return (
                        <div key={key} className="design-order-card">
                            {/* ── Card Header ── */}
                            <div className="design-card-head">
                                <div className="design-card-left">
                                    {order && <span className="design-order-num">{order.order_number}</span>}
                                    <span className="design-company">{order?.company_name ?? '—'}</span>
                                    <div className="design-card-meta">
                                        {order?.customer_name && <span>{order.customer_name}</span>}
                                        <span>· {fmt(first.created_at)}</span>
                                    </div>
                                </div>
                                <div className="design-card-right" style={{ alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>
                                        {items.length} item{items.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {/* ── Items Table ── */}
                            <div className="prod-wrap">
                                <table className="prod-table design-items-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Our Brand</th>
                                            <th>Party Brand</th>
                                            <th>Size</th>
                                            <th>Label Dimensions</th>
                                            <th>Order Qty</th>
                                            <th>Pcs to Print</th>
                                            <th>Labels Recv'd</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((d, i) => (
                                            <tr key={d.id}>
                                                <td>{i + 1}</td>
                                                <td>
                                                    <span
                                                        className="prod-name"
                                                        onClick={() => openGalleryPopup(d)}
                                                        style={{ cursor: 'pointer', color: '#0d9488', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                        title="View product details from gallery"
                                                    >{d.product_name}</span>
                                                </td>
                                                <td>{d.party_brand}</td>
                                                <td>{d.packing_size ?? '—'}</td>
                                                <td>{d.label_dimensions ?? '—'}</td>
                                                <td><strong>{d.order_qty || '—'}</strong></td>
                                                <td>{d.pcs_to_print ?? '—'}</td>
                                                <td>{d.labels_received ?? '—'}</td>
                                                <td>
                                                    {!canManage ? (
                                                        <span className="badge purple">{statusLabel(d.status)}</span>
                                                    ) : (
                                                    <select
                                                        value={d.status}
                                                        onChange={(e) => changeStage(d, e.target.value)}
                                                        style={{
                                                            fontSize: '12px',
                                                            padding: '3px 6px',
                                                            borderRadius: '6px',
                                                            border: '1px solid var(--border)',
                                                            background: 'var(--bg-card)',
                                                            color: 'var(--tx)',
                                                            cursor: 'pointer',
                                                            minWidth: '140px',
                                                        }}
                                                    >
                                                        {STAGES.map((s) => (
                                                            <option key={s.key} value={s.key}>{s.label}</option>
                                                        ))}
                                                    </select>
                                                    )}
                                                </td>
                                                <td>
                                                    {canManage ? (
                                                        <>
                                                            <button className="btn-icon" onClick={() => openEdit(d)} title="Edit">✏️</button>
                                                            <button className="btn-icon btn-danger-icon" onClick={() => deleteOrder(d)} title="Delete">🗑️</button>
                                                        </>
                                                    ) : <span style={{ color: 'var(--tx-muted)', fontSize: 12 }}>—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Instructions */}
                            {first.instructions && (
                                <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--tx-muted)', borderTop: '1px solid var(--border)' }}>
                                    📌 {first.instructions}
                                </div>
                            )}

                            {/* Stage log of first item */}
                            {first.stage_log && first.stage_log.length > 0 && (
                                <div className="design-stage-log">
                                    {first.stage_log.slice().reverse().map((entry, i) => (
                                        <span key={i} className="stage-log-chip">
                                            {STAGES.find((s) => s.key === entry.stage)?.label ?? entry.stage}
                                            {entry.by ? ` · ${entry.by}` : ''}
                                            {' · '}
                                            {new Date(entry.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {/* ── Gallery Product Details Popup ── */}
            {galleryPopup && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setGalleryPopup(null)}>
                    <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📦 {galleryPopup.item.product_name}</h2>
                            <button className="modal-close" onClick={() => setGalleryPopup(null)}>✕</button>
                        </div>
                        <div style={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
                            {galleryPopup.matches.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 30, color: 'var(--tx-muted)' }}>
                                    No details for this product in the gallery.
                                </div>
                            ) : galleryPopup.matches.map((g) => (
                                <div key={g.id} style={{ display: 'flex', gap: 16, marginBottom: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
                                    <img
                                        src={g.photo_url}
                                        alt={g.our_brand ?? ''}
                                        style={{ width: 160, height: 160, objectFit: 'contain', borderRadius: 8, background: '#f8fafc', flexShrink: 0, cursor: 'pointer' }}
                                        onClick={() => window.open(g.photo_url, '_blank')}
                                    />
                                    <div style={{ flex: 1, minWidth: 220, fontSize: 14 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{g.our_brand ?? '—'}</div>
                                        <table style={{ fontSize: 13, lineHeight: 1.9 }}>
                                            <tbody>
                                                {g.party_brand && <tr><td style={{ color: 'var(--tx-muted)', paddingRight: 14 }}>Party Brand</td><td><strong>{g.party_brand}</strong></td></tr>}
                                                {g.party_name && <tr><td style={{ color: 'var(--tx-muted)', paddingRight: 14 }}>Party</td><td>{g.party_name}</td></tr>}
                                                {g.bottle_jar && <tr><td style={{ color: 'var(--tx-muted)', paddingRight: 14 }}>Bottle / Jar</td><td>{g.bottle_jar}</td></tr>}
                                                {g.cap_color && <tr><td style={{ color: 'var(--tx-muted)', paddingRight: 14 }}>Cap Color</td><td>{g.cap_color}</td></tr>}
                                                {g.sizes?.length > 0 && (
                                                    <tr>
                                                        <td style={{ color: 'var(--tx-muted)', paddingRight: 14, verticalAlign: 'top' }}>Sizes / MRP</td>
                                                        <td>
                                                            {g.sizes.filter((s) => s.packing_size || s.mrp).map((s, i) => (
                                                                <div key={i}>{s.packing_size || '—'}{s.mrp ? ` — ₹${s.mrp}` : ''}</div>
                                                            ))}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Design Order' : 'New Design Order'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Party Brand *</label>
                                    <input value={data.party_brand} onChange={(e) => setData('party_brand', e.target.value)} required />
                                    {errors.party_brand && <span className="field-error">{errors.party_brand}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Product Name *</label>
                                    <input value={data.product_name} onChange={(e) => setData('product_name', e.target.value)} required />
                                    {errors.product_name && <span className="field-error">{errors.product_name}</span>}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Packing Size</label>
                                    <input value={data.packing_size} onChange={(e) => setData('packing_size', e.target.value)} placeholder="e.g. 1L, 500ml" />
                                </div>
                                <div className="form-group">
                                    <label>Label Dimensions</label>
                                    <input value={data.label_dimensions} onChange={(e) => setData('label_dimensions', e.target.value)} placeholder="e.g. 150mm × 100mm" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Assign To</label>
                                    <select value={data.assigned_to} onChange={(e) => setData('assigned_to', e.target.value)}>
                                        <option value="">— Unassigned —</option>
                                        {designers.map((des) => <option key={des.id} value={des.id}>{des.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Due Date</label>
                                    <input type="date" value={data.due_date} onChange={(e) => setData('due_date', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Instructions</label>
                                <textarea value={data.instructions} onChange={(e) => setData('instructions', e.target.value)} rows={3} />
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : editing ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </ModalPortal>
            )}
        </>
    );
}
