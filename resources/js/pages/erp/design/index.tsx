import ErpLayout from '@/layouts/erp-layout';
import {
    advance as designAdvance,
    destroy as designDestroy,
    store as designStore,
    tracking as designTracking,
    update as designUpdate,
} from '@/routes/design';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

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

const ALL_STAGES = [
    { key: 'pending',          label: 'Pending Acceptance',  advanceLabel: '✓ Mark Accepted' },
    { key: 'accepted',         label: 'Accepted',            advanceLabel: '✓ Mark Design Ready' },
    { key: 'design-ready',     label: 'Design Ready',        advanceLabel: '✓ Party Approved' },
    { key: 'approved-party',   label: 'Party Approved',      advanceLabel: '✓ Sent to Print' },
    { key: 'sent-print',       label: 'Sent to Print',       advanceLabel: '✓ Mark Completed' },
    { key: 'completed',        label: 'Completed',           advanceLabel: '✓ Received at Factory' },
    { key: 'received-factory', label: 'Received at Factory', advanceLabel: '' },
];

const defaultForm = {
    assigned_to: '', order_id: '', party_brand: '', product_name: '',
    packing_size: '', label_dimensions: '', instructions: '', notes: '', due_date: '',
};

const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

type PrintModal  = { id: number; orderQty: number; current: number | null };
type LabelsModal = { id: number; maxQty: number; current: number | null };

export default function DesignIndex() {
    const { designOrders, designers, stats, flash } = usePage<PageProps>().props;

    const [showModal, setShowModal]     = useState(false);
    const [editing, setEditing]         = useState<DesignOrder | null>(null);
    const [search, setSearch]           = useState('');
    const [filterStage, setFilterStage] = useState('all');

    // Print modal
    const [printModal, setPrintModal]   = useState<PrintModal | null>(null);
    const [printValue, setPrintValue]   = useState('');
    const [printSaving, setPrintSaving] = useState(false);

    // Labels modal
    const [labelsModal, setLabelsModal]   = useState<LabelsModal | null>(null);
    const [labelsValue, setLabelsValue]   = useState('');
    const [labelsSaving, setLabelsSaving] = useState(false);

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

    const advance = (d: DesignOrder) => router.post(designAdvance(d.id).url, {}, { preserveScroll: true });
    const deleteOrder = (d: DesignOrder) => {
        if (!confirm(`Delete design order for "${d.party_brand} – ${d.product_name}"?`)) return;
        router.delete(designDestroy(d.id).url);
    };

    // Print modal helpers
    const openPrintModal = (d: DesignOrder) => {
        const orderQty = d.order_qty ?? 0;
        const remaining = orderQty - (d.pcs_to_print ?? 0);
        setPrintModal({ id: d.id, orderQty, current: d.pcs_to_print });
        setPrintValue(String(remaining > 0 ? remaining : 0));
    };
    const submitPrint = () => {
        if (!printModal) return;
        const val = parseInt(printValue, 10);
        if (isNaN(val) || val < 0) return;
        if (val > printModal.orderQty - (printModal.current ?? 0)) return;
        setPrintSaving(true);
        router.patch(designTracking(printModal.id).url, {
            pcs_to_print: (printModal.current ?? 0) + val,
        }, {
            preserveScroll: true,
            onFinish: () => { setPrintSaving(false); setPrintModal(null); },
        });
    };

    // Labels modal helpers
    const openLabelsModal = (d: DesignOrder) => {
        const maxQty = d.pcs_to_print ?? (d.order_qty ?? 0);
        setLabelsModal({ id: d.id, maxQty, current: d.labels_received });
        setLabelsValue(String(d.labels_received ?? 0));
    };
    const submitLabels = () => {
        if (!labelsModal) return;
        const val = parseInt(labelsValue, 10);
        if (isNaN(val) || val < 0 || val > labelsModal.maxQty) return;
        setLabelsSaving(true);
        router.patch(designTracking(labelsModal.id).url, {
            labels_received: val,
        }, {
            preserveScroll: true,
            onFinish: () => { setLabelsSaving(false); setLabelsModal(null); },
        });
    };

    const stageIndex = (s: string) => ALL_STAGES.findIndex((st) => st.key === s);

    const visibleStages = (d: DesignOrder) =>
        d.skip_party_approval
            ? ALL_STAGES.filter((s) => s.key !== 'approved-party')
            : ALL_STAGES;

    const filtered = designOrders.filter((d) => {
        if (filterStage !== 'all' && d.status !== filterStage) return false;
        if (search) {
            const q = search.toLowerCase();
            return d.party_brand.toLowerCase().includes(q) || d.product_name.toLowerCase().includes(q);
        }
        return true;
    });

    return (
        <ErpLayout>
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
                {ALL_STAGES.map((s) => (
                    <button key={s.key} className={`pill${filterStage === s.key ? ' active' : ''}`} onClick={() => setFilterStage(s.key)}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Order cards */}
            {filtered.length === 0 ? (
                <div className="empty-state"><div className="icon">🎨</div><p>No design orders found.</p></div>
            ) : (
                filtered.map((d) => {
                    const isUnlocked = d.status !== 'pending';
                    const orderQty   = d.order_qty ?? 0;
                    const pcsPending = orderQty - (d.pcs_to_print ?? 0);
                    const labelPending = (d.pcs_to_print ?? orderQty) - (d.labels_received ?? 0);
                    const stages     = visibleStages(d);
                    const curIdx     = stages.findIndex((s) => s.key === d.status);
                    const isDone     = d.status === 'received-factory';

                    return (
                        <div key={d.id} className="design-order-card">
                            {/* ── Card Header ── */}
                            <div className="design-card-head">
                                <div className="design-card-left">
                                    {d.order && (
                                        <span className="design-order-num">{d.order.order_number}</span>
                                    )}
                                    <span className="design-company">
                                        {d.order?.company_name ?? '—'}
                                    </span>
                                    <div className="design-card-meta">
                                        {d.order?.customer_name && <span>{d.order.customer_name}</span>}
                                        {d.assignee && <span>· {d.assignee.name}</span>}
                                        <span>· {fmt(d.created_at)}</span>
                                    </div>
                                </div>
                                <div className="design-card-right">
                                    <button className="btn-icon" onClick={() => openEdit(d)} title="Edit">✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteOrder(d)} title="Delete">🗑️</button>
                                </div>
                            </div>

                            {/* ── Products Table ── */}
                            <div className="prod-wrap" style={{ margin: '0 0 0 0' }}>
                                <table className="prod-table design-items-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Our Brand</th>
                                            <th>Party Brand</th>
                                            <th>Size</th>
                                            <th>Order Qty</th>
                                            <th style={{ color: isUnlocked ? 'var(--accent-green, #059669)' : 'var(--tx-muted)' }}>
                                                Pcs to Print
                                            </th>
                                            <th style={{ color: isUnlocked ? 'var(--accent-red, #dc2626)' : 'var(--tx-muted)' }}>
                                                Labels Recv'd
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>1</td>
                                            <td><span className="prod-name">{d.product_name}</span></td>
                                            <td>{d.party_brand}</td>
                                            <td>{d.packing_size ?? '—'}</td>
                                            <td><strong>{orderQty || '—'}</strong></td>

                                            {/* PCS TO PRINT */}
                                            <td>
                                                {isUnlocked ? (
                                                    <button
                                                        className="tracking-cell clickable"
                                                        onClick={() => openPrintModal(d)}
                                                        title="Click to set pieces to print"
                                                    >
                                                        <span className="tracking-value green">
                                                            {d.pcs_to_print ?? '—'}
                                                        </span>
                                                        {pcsPending > 0 && (
                                                            <span className="tracking-sub">
                                                                {pcsPending} pending
                                                            </span>
                                                        )}
                                                        {pcsPending === 0 && d.pcs_to_print !== null && (
                                                            <span className="tracking-sub done">✓ done</span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="tracking-cell locked" title="Accept order to enable">
                                                        <span className="tracking-value muted">—</span>
                                                        <span className="tracking-sub">🔒 locked</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* LABELS RECV'D */}
                                            <td>
                                                {isUnlocked ? (
                                                    <button
                                                        className="tracking-cell clickable"
                                                        onClick={() => openLabelsModal(d)}
                                                        title="Click to update labels received"
                                                    >
                                                        <span className="tracking-value red">
                                                            {d.labels_received ?? '—'}
                                                        </span>
                                                        {labelPending > 0 && (
                                                            <span className="tracking-sub red">
                                                                {labelPending} pending
                                                            </span>
                                                        )}
                                                        {labelPending <= 0 && d.labels_received !== null && (
                                                            <span className="tracking-sub done">✓ all received</span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="tracking-cell locked" title="Accept order to enable">
                                                        <span className="tracking-value muted">—</span>
                                                        <span className="tracking-sub">🔒 locked</span>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Instructions if any */}
                            {d.instructions && (
                                <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--tx-muted)', borderTop: '1px solid var(--border)' }}>
                                    📌 {d.instructions}
                                </div>
                            )}

                            {/* ── Design Stage Progress ── */}
                            <div className="design-stage-progress">
                                <div className="design-stage-title">Design Stage Progress</div>
                                {stages.map((s, i) => {
                                    const isPast    = i < curIdx;
                                    const isCurrent = i === curIdx;
                                    const isFuture  = i > curIdx;

                                    return (
                                        <div
                                            key={s.key}
                                            className={`design-stage-row${isCurrent ? ' current' : ''}${isPast ? ' past' : ''}${isFuture ? ' future' : ''}`}
                                        >
                                            <span className="stage-dot">
                                                {isPast ? '✓' : isCurrent ? '●' : '○'}
                                            </span>
                                            <span className="stage-row-label">{s.label}</span>
                                            {isCurrent && !isDone && (
                                                <button
                                                    className={`btn sm${s.key === 'pending' ? ' primary' : ' teal'}`}
                                                    onClick={() => advance(d)}
                                                >
                                                    {s.advanceLabel}
                                                </button>
                                            )}
                                            {(isFuture || (isCurrent && isDone)) && (
                                                <span className="stage-row-dash">—</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Stage log */}
                            {d.stage_log && d.stage_log.length > 1 && (
                                <div className="design-stage-log">
                                    {d.stage_log.slice().reverse().map((entry, i) => (
                                        <span key={i} className="stage-log-chip">
                                            {ALL_STAGES.find((s) => s.key === entry.stage)?.label ?? entry.stage}
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

            {/* ── Send to Print Modal ── */}
            {printModal && (
                <div className="modal-overlay open" onClick={() => !printSaving && setPrintModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                        <div className="modal-header">
                            <h2>🖨️ Send to Print</h2>
                            <button className="modal-close" onClick={() => setPrintModal(null)} disabled={printSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Total Order Qty</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-head)' }}>
                                        {printModal.orderQty}
                                    </div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Already Sent</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-muted)' }}>
                                        {printModal.current ?? 0}
                                    </div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Remaining</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--accent-green, #059669)' }}>
                                        {printModal.orderQty - (printModal.current ?? 0)}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label>Pieces to Send Now</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={printModal.orderQty - (printModal.current ?? 0)}
                                    value={printValue}
                                    onChange={(e) => setPrintValue(e.target.value)}
                                    style={{ fontSize: '16px', fontWeight: 700 }}
                                    autoFocus
                                    disabled={printSaving}
                                />
                                {parseInt(printValue, 10) > printModal.orderQty - (printModal.current ?? 0) && (
                                    <span style={{ color: 'var(--red, #dc2626)', fontSize: '12px' }}>
                                        Cannot exceed remaining quantity ({printModal.orderQty - (printModal.current ?? 0)})
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setPrintModal(null)} disabled={printSaving}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={submitPrint}
                                    disabled={
                                        printSaving ||
                                        !printValue ||
                                        parseInt(printValue, 10) <= 0 ||
                                        parseInt(printValue, 10) > printModal.orderQty - (printModal.current ?? 0)
                                    }
                                >
                                    {printSaving ? 'Saving…' : '🖨️ Send to Print'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Labels Received Modal ── */}
            {labelsModal && (
                <div className="modal-overlay open" onClick={() => !labelsSaving && setLabelsModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px' }}>
                        <div className="modal-header">
                            <h2>🏷️ Labels Received</h2>
                            <button className="modal-close" onClick={() => setLabelsModal(null)} disabled={labelsSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Printed / Expected</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-head)' }}>
                                        {labelsModal.maxQty}
                                    </div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Pending</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--accent-red, #dc2626)' }}>
                                        {labelsModal.maxQty - (labelsModal.current ?? 0)}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label>Total Labels Received</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={labelsModal.maxQty}
                                    value={labelsValue}
                                    onChange={(e) => setLabelsValue(e.target.value)}
                                    style={{ fontSize: '16px', fontWeight: 700 }}
                                    autoFocus
                                    disabled={labelsSaving}
                                />
                                {parseInt(labelsValue, 10) > labelsModal.maxQty && (
                                    <span style={{ color: 'var(--red, #dc2626)', fontSize: '12px' }}>
                                        Cannot exceed pieces to print ({labelsModal.maxQty})
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setLabelsModal(null)} disabled={labelsSaving}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={submitLabels}
                                    disabled={
                                        labelsSaving ||
                                        labelsValue === '' ||
                                        parseInt(labelsValue, 10) < 0 ||
                                        parseInt(labelsValue, 10) > labelsModal.maxQty
                                    }
                                >
                                    {labelsSaving ? 'Saving…' : '✓ Update Labels'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create / Edit Modal ── */}
            {showModal && (
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
                                        {designers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
            )}
        </ErpLayout>
    );
}
