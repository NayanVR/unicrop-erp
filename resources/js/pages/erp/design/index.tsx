
import {
    destroy as designDestroy,
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
type PageProps = {
    designOrders: DesignOrder[];
    designers: Designer[];
    stats: Stats;
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
    const { designOrders, designers, stats, flash } = usePage<PageProps>().props;

    const [showModal, setShowModal]     = useState(false);
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
                <button className="btn primary" onClick={openAdd}>＋ New Design Order</button>
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
                                                <td><span className="prod-name">{d.product_name}</span></td>
                                                <td>{d.party_brand}</td>
                                                <td>{d.packing_size ?? '—'}</td>
                                                <td>{d.label_dimensions ?? '—'}</td>
                                                <td><strong>{d.order_qty || '—'}</strong></td>
                                                <td>{d.pcs_to_print ?? '—'}</td>
                                                <td>{d.labels_received ?? '—'}</td>
                                                <td><span className="badge purple">{statusLabel(d.status)}</span></td>
                                                <td>
                                                    <button className="btn-icon" onClick={() => openEdit(d)} title="Edit">✏️</button>
                                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteOrder(d)} title="Delete">🗑️</button>
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
