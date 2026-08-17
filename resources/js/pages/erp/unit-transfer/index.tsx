
import {
    destroy as transferDestroy,
    status as transferStatus,
    store as transferStore,
} from '@/routes/unit-transfer';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Transfer = {
    id: number;
    created_by: number | null;
    order_number: string | null;
    from_unit: string;
    to_unit: string;
    item_type: 'raw_material' | 'finished_good' | 'other';
    item_name: string;
    quantity: number;
    unit: string;
    notes: string | null;
    received_by_user_id: number | null;
    received_at: string | null;
    status: 'in-transit' | 'unloaded' | 'cancelled';
    transferred_at: string | null;
    created_at: string;
    creator: { id: number; name: string } | null;
    receiver: { id: number; name: string } | null;
};

type Godown = { id: number; name: string; is_default: boolean };
type InventoryItem = { id: number; name: string; unit: string; category: string };

type Stats = { total: number; in_transit: number; received: number; cancelled: number };

type PageProps = {
    transfers: Transfer[];
    stats: Stats;
    godowns: Godown[];
    inventoryItems: InventoryItem[];
    flash?: { success?: string; error?: string };
};

const guessItemType = (category: string): 'raw_material' | 'finished_good' | 'other' => {
    const c = category.toLowerCase();
    if (/finish|product|fg|goods/i.test(c)) return 'finished_good';
    if (/raw|material|ingredient|feed/i.test(c)) return 'raw_material';
    return 'other';
};

const STATUS_COLORS: Record<string, string> = {
    'in-transit': 'badge-blue',
    unloaded:     'badge-teal',
    cancelled:    'badge-gray',
};

const STATUS_LABELS: Record<string, string> = {
    'in-transit': 'On the Way',
    unloaded:     'Received',
    cancelled:    'Cancelled',
};

const fmtTime = (s: string) =>
    new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const defaultForm = {
    from_unit:    '',
    to_unit:      '',
    item_type:    'raw_material' as 'raw_material' | 'finished_good' | 'other',
    item_name:    '',
    quantity:     '',
    unit:         'kg',
    notes:        '',
    order_number: '',
};

export default function UnitTransferIndex() {
    const { transfers, stats, flash, godowns, inventoryItems } = usePage<PageProps>().props;
    const defaultGodown = godowns.find((g) => g.is_default)?.name ?? '';
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch]       = useState('');
    const [filter, setFilter]       = useState<'all' | 'in-transit' | 'unloaded' | 'cancelled'>('all');
    const [itemSearch, setItemSearch] = useState('');

    const { data, setData, post, processing, reset, errors } = useForm({
        ...defaultForm,
        from_unit: defaultGodown,
    });

    const openModal = () => {
        reset();
        setData('from_unit', defaultGodown);
        setItemSearch('');
        setShowModal(true);
    };

    const handleItemSearch = (val: string) => {
        setItemSearch(val);
        const found = inventoryItems.find((i) => i.name === val);
        setData((prev) => ({
            ...prev,
            item_name: val,
            ...(found ? { unit: found.unit ?? prev.unit, item_type: guessItemType(found.category ?? '') } : {}),
        }));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(transferStore().url, { onSuccess: () => { setShowModal(false); reset(); setItemSearch(''); } });
    };

    const receive = (t: Transfer) => {
        if (!confirm(`Mark "${t.item_name}" as Received?`)) return;
        router.patch(transferStatus(t.id).url, { status: 'unloaded' });
    };

    const cancel = (t: Transfer) => {
        if (!confirm('Cancel this transfer?')) return;
        router.patch(transferStatus(t.id).url, { status: 'cancelled' });
    };

    const deleteTransfer = (t: Transfer) => {
        if (!confirm(`Delete transfer "${t.item_name}"?`)) return;
        router.delete(transferDestroy(t.id).url);
    };

    const filtered = transfers.filter((t) => {
        if (filter !== 'all' && t.status !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!t.item_name.toLowerCase().includes(q) &&
                !t.from_unit.toLowerCase().includes(q) &&
                !t.to_unit.toLowerCase().includes(q) &&
                !(t.order_number ?? '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Unit Transfers</h1>
                <button className="btn-primary" onClick={openModal}>+ New Transfer</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error   && <div className="alert-error">{flash.error}</div>}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.in_transit}</div>
                    <div className="stat-label">On the Way</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.received}</div>
                    <div className="stat-label">Received</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.cancelled}</div>
                    <div className="stat-label">Cancelled</div>
                </div>
            </div>

            <div className="card">
                <div className="card-toolbar">
                    <input
                        type="search"
                        className="search-input"
                        placeholder="Search item, order, from/to unit…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="filter-tabs">
                        {(['all', 'in-transit', 'unloaded', 'cancelled'] as const).map((f) => (
                            <button
                                key={f}
                                className={`filter-tab${filter === f ? ' active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'All' : STATUS_LABELS[f] ?? f}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Order</th>
                                <th>From → To</th>
                                <th>Quantity</th>
                                <th>Sent By</th>
                                <th>Received By</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={8} className="empty-row">No transfers found.</td></tr>
                            )}
                            {filtered.map((t) => (
                                <tr key={t.id}>
                                    <td className="font-medium">
                                        {t.item_name}
                                        {t.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{t.notes}</div>}
                                    </td>
                                    <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                                        {t.order_number ?? '—'}
                                    </td>
                                    <td style={{ fontSize: 13, color: '#6b7280' }}>{t.from_unit} → {t.to_unit}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{Number(t.quantity).toFixed(3)} {t.unit}</td>
                                    <td style={{ fontSize: 12 }}>
                                        <div style={{ fontWeight: 600 }}>{t.creator?.name ?? '—'}</div>
                                        <div style={{ color: '#9ca3af' }}>{fmtTime(t.created_at)}</div>
                                    </td>
                                    <td style={{ fontSize: 12 }}>
                                        {t.receiver ? (
                                            <>
                                                <div style={{ fontWeight: 600 }}>{t.receiver.name}</div>
                                                <div style={{ color: '#9ca3af' }}>{t.received_at ? fmtTime(t.received_at) : ''}</div>
                                            </>
                                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                                    </td>
                                    <td>
                                        <span className={`badge ${STATUS_COLORS[t.status] ?? 'badge-gray'}`}>
                                            {STATUS_LABELS[t.status] ?? t.status}
                                        </span>
                                    </td>
                                    <td className="action-cell">
                                        {t.status === 'in-transit' && (
                                            <button className="btn-xs btn-teal" onClick={() => receive(t)}>✓ Receive</button>
                                        )}
                                        {t.status === 'in-transit' && (
                                            <button className="btn-xs btn-danger" onClick={() => cancel(t)}>Cancel</button>
                                        )}
                                        <button className="btn-icon btn-danger-icon" onClick={() => deleteTransfer(t)} title="Delete">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>New Transfer</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            {/* From / To godown dropdowns */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>From Unit *</label>
                                    {godowns.length > 0 ? (
                                        <select value={data.from_unit} onChange={(e) => setData('from_unit', e.target.value)} required>
                                            <option value="">— Select Godown —</option>
                                            {godowns.map((g) => (
                                                <option key={g.id} value={g.name}>{g.name}{g.is_default ? ' (Default)' : ''}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input value={data.from_unit} onChange={(e) => setData('from_unit', e.target.value)} placeholder="e.g. Main Factory" required />
                                    )}
                                    {errors.from_unit && <span className="field-error">{errors.from_unit}</span>}
                                </div>
                                <div className="form-group">
                                    <label>To Unit *</label>
                                    {godowns.length > 0 ? (
                                        <select value={data.to_unit} onChange={(e) => setData('to_unit', e.target.value)} required>
                                            <option value="">— Select Godown —</option>
                                            {godowns.map((g) => (
                                                <option key={g.id} value={g.name}>{g.name}{g.is_default ? ' (Default)' : ''}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input value={data.to_unit} onChange={(e) => setData('to_unit', e.target.value)} placeholder="e.g. Warehouse B" required />
                                    )}
                                    {errors.to_unit && <span className="field-error">{errors.to_unit}</span>}
                                </div>
                            </div>

                            {/* Item Select from inventory — native datalist (escapes modal overflow) */}
                            <div className="form-group">
                                <label>Select Item (Inventory)</label>
                                <input
                                    type="text"
                                    list="unit-transfer-items"
                                    value={itemSearch}
                                    onChange={(e) => handleItemSearch(e.target.value)}
                                    placeholder="Type to search inventory..."
                                    autoComplete="off"
                                />
                                <datalist id="unit-transfer-items">
                                    {inventoryItems.map((item) => (
                                        <option key={item.id} value={item.name}>
                                            {item.category} · {item.unit}
                                        </option>
                                    ))}
                                </datalist>
                            </div>

                            {/* Item Type (auto-filled, editable) */}
                            <div className="form-group">
                                <label>Item Type *</label>
                                <select value={data.item_type} onChange={(e) => setData('item_type', e.target.value as typeof data.item_type)}>
                                    <option value="raw_material">Raw Material</option>
                                    <option value="finished_good">Finished Good</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Quantity *</label>
                                    <input type="number" step="0.001" min="0" value={data.quantity} onChange={(e) => setData('quantity', e.target.value)} required />
                                    {errors.quantity && <span className="field-error">{errors.quantity}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select value={data.unit} onChange={(e) => setData('unit', e.target.value)}>
                                        {['pcs', 'kg', 'g', 'L', 'ml', 'bags', 'drums'].map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : 'Send Transfer'}
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
