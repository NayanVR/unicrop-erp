import ErpLayout from '@/layouts/erp-layout';
import {
    advance as designAdvance,
    destroy as designDestroy,
    store as designStore,
    update as designUpdate,
} from '@/routes/design';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

type Designer = { id: number; name: string };

type StageLogEntry = { stage: string; at: string; by: string };

type DesignOrder = {
    id: number;
    created_by: number | null;
    assigned_to: number | null;
    order_id: number | null;
    party_brand: string;
    product_name: string;
    packing_size: string | null;
    label_dimensions: string | null;
    instructions: string | null;
    notes: string | null;
    status: string;
    stage_log: StageLogEntry[] | null;
    due_date: string | null;
    created_at: string;
    creator: { id: number; name: string } | null;
    assignee: { id: number; name: string } | null;
    order: { id: number; order_number: string; company_name: string } | null;
};

type Stats = { total: number; in_progress: number; completed: number; received_factory: number };

type PageProps = {
    designOrders: DesignOrder[];
    designers: Designer[];
    stats: Stats;
    flash?: { success?: string; error?: string };
};

const STAGES = [
    { key: 'accepted', label: 'Accepted' },
    { key: 'design-ready', label: 'Design Ready' },
    { key: 'approved-party', label: 'Party Approved' },
    { key: 'sent-print', label: 'Sent to Print' },
    { key: 'completed', label: 'Completed' },
    { key: 'received-factory', label: 'Received at Factory' },
];

const STAGE_COLORS: Record<string, string> = {
    accepted: 'badge-gray',
    'design-ready': 'badge-blue',
    'approved-party': 'badge-yellow',
    'sent-print': 'badge-orange',
    completed: 'badge-teal',
    'received-factory': 'badge-green',
};

const defaultForm = {
    assigned_to: '',
    order_id: '',
    party_brand: '',
    product_name: '',
    packing_size: '',
    label_dimensions: '',
    instructions: '',
    notes: '',
    due_date: '',
};

export default function DesignIndex() {
    const { designOrders, designers, stats, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<DesignOrder | null>(null);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [filterStage, setFilterStage] = useState('all');

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => {
        reset();
        setEditing(null);
        setShowModal(true);
    };

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

    const advance = (d: DesignOrder) => {
        router.post(designAdvance(d.id).url);
    };

    const deleteOrder = (d: DesignOrder) => {
        if (!confirm(`Delete design order for "${d.party_brand} – ${d.product_name}"?`)) return;
        router.delete(designDestroy(d.id).url);
    };

    const stageIndex = (s: string) => STAGES.findIndex((st) => st.key === s);

    const filtered = designOrders.filter((d) => {
        if (filterStage !== 'all' && d.status !== filterStage) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!d.party_brand.toLowerCase().includes(q) && !d.product_name.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <ErpLayout>
            <div className="page-header">
                <h1 className="page-title">Design Workflow</h1>
                <button className="btn-primary" onClick={openAdd}>+ New Design Order</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Orders</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.in_progress}</div>
                    <div className="stat-label">In Progress</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.completed}</div>
                    <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.received_factory}</div>
                    <div className="stat-label">At Factory</div>
                </div>
            </div>

            <div className="card">
                <div className="card-toolbar">
                    <input
                        className="search-input"
                        placeholder="Search brand or product..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="filter-tabs">
                        <button className={`filter-tab${filterStage === 'all' ? ' active' : ''}`} onClick={() => setFilterStage('all')}>All</button>
                        {STAGES.map((s) => (
                            <button
                                key={s.key}
                                className={`filter-tab${filterStage === s.key ? ' active' : ''}`}
                                onClick={() => setFilterStage(s.key)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="order-list">
                    {filtered.length === 0 && <div className="empty-row">No design orders found.</div>}
                    {filtered.map((d) => {
                        const isExpanded = expanded === d.id;
                        const isDone = d.status === 'received-factory';
                        const progress = Math.round(((stageIndex(d.status) + 1) / STAGES.length) * 100);

                        return (
                            <div key={d.id} className="order-card">
                                <div className="order-card-header" onClick={() => setExpanded(isExpanded ? null : d.id)} style={{ cursor: 'pointer' }}>
                                    <div className="order-card-meta">
                                        <span className="font-medium">{d.party_brand}</span>
                                        <span className="text-muted"> — {d.product_name}</span>
                                        {d.packing_size && <span className="badge badge-gray ml-2">{d.packing_size}</span>}
                                    </div>
                                    <div className="order-card-actions" onClick={(e) => e.stopPropagation()}>
                                        <span className={`badge ${STAGE_COLORS[d.status] ?? 'badge-gray'}`}>
                                            {STAGES.find((s) => s.key === d.status)?.label ?? d.status}
                                        </span>
                                        {!isDone && (
                                            <button className="btn-xs btn-teal" onClick={() => advance(d)}>
                                                Advance →
                                            </button>
                                        )}
                                        <button className="btn-icon" onClick={() => openEdit(d)} title="Edit">✏️</button>
                                        <button className="btn-icon btn-danger-icon" onClick={() => deleteOrder(d)} title="Delete">🗑️</button>
                                    </div>
                                </div>

                                <div className="progress-bar-wrap">
                                    <div className="progress-bar-track">
                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <span className="progress-label">{progress}%</span>
                                </div>

                                <div className="stage-pills">
                                    {STAGES.map((s, i) => (
                                        <span
                                            key={s.key}
                                            className={`stage-pill ${i < stageIndex(d.status) ? 'done' : i === stageIndex(d.status) ? 'active' : 'pending'}`}
                                        >
                                            {s.label}
                                        </span>
                                    ))}
                                </div>

                                {isExpanded && (
                                    <div className="order-card-detail">
                                        {d.assignee && <p><strong>Assigned to:</strong> {d.assignee.name}</p>}
                                        {d.label_dimensions && <p><strong>Label dimensions:</strong> {d.label_dimensions}</p>}
                                        {d.due_date && <p><strong>Due:</strong> {new Date(d.due_date).toLocaleDateString('en-IN')}</p>}
                                        {d.instructions && <p><strong>Instructions:</strong> {d.instructions}</p>}
                                        {d.notes && <p><strong>Notes:</strong> {d.notes}</p>}
                                        {d.stage_log && d.stage_log.length > 0 && (
                                            <div className="stage-log">
                                                <strong>Stage History</strong>
                                                <ul>
                                                    {d.stage_log.map((entry, i) => (
                                                        <li key={i} className="text-muted text-sm">
                                                            <span className="font-medium">{STAGES.find((s) => s.key === entry.stage)?.label ?? entry.stage}</span>
                                                            {' — '}{new Date(entry.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                            {entry.by && ` by ${entry.by}`}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
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
