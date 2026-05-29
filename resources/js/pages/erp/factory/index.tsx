import { labels as itemLabels, setStage as itemSetStage } from '@/routes/factory/items';
import { dispatch as orderDispatch, notes as orderNotes } from '@/routes/factory/orders';
import { approveUrgent as ordersApproveUrgent, rejectUrgent as ordersRejectUrgent } from '@/routes/orders';
import { index as unitTransferIndex } from '@/routes/unit-transfer';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type StageLogEntry = {
    from: string;
    to: string;
    by?: number | null;
    name?: string | null;
    at: string;
    revert?: boolean;
};

type OrderItem = {
    id: number;
    order_id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    box_size?: number | null;
    labels_received?: number | null;
    quantity: string | number;
    rate: string | number;
    amount: string | number;
    type?: string | null;
    shape?: string | null;
    cap_color?: string | null;
    status: string;
    stage_log?: StageLogEntry[] | null;
};

type DesignStatus = {
    stage: string;
    label: string;
    by?: string | null;
    at?: string | null;
};

type Order = {
    id: number;
    order_number: string;
    company_name: string;
    customer_name: string;
    destination?: string | null;
    transport_name?: string | null;
    order_date?: string | null;
    priority?: string | null;
    status?: string | null;
    notes?: string | null;
    factory_notes?: string | null;
    sales_user_name?: string | null;
    created_by_name?: string | null;
    design_status?: DesignStatus | null;
    tax_docs_pending?: boolean;
    items: OrderItem[];
};

type UrgentPendingOrder = {
    id: number;
    order_number: string;
    company_name: string;
    customer_name: string;
    order_date?: string | null;
    sales_user?: { id: number; name: string } | null;
    created_by?: { id: number; name: string } | null;
    items: { id: number; our_brand?: string | null; packing_size?: string | null; quantity: string | number }[];
};

type Props = {
    orders: Order[];
    urgentPending: UrgentPendingOrder[];
    canAdvance: boolean;
};

const STAGE_ORDER = ['pending', 'processing', 'filling', 'labeling', 'ready', 'dispatched'];

const STAGE_LABELS: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    filling: 'Filling',
    labeling: 'Labeling',
    ready: 'Ready',
    dispatched: 'Dispatched',
};

const STAGE_CLASS: Record<string, string> = {
    pending: 's-pending',
    processing: 's-processing',
    filling: 's-filling',
    labeling: 's-labeling',
    ready: 's-ready',
    dispatched: 's-dispatched',
};

type FilterKey = 'all' | 'pending' | 'in-process' | 'ready' | 'dispatched';

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in-process', label: 'In Process' },
    { key: 'ready', label: 'Ready' },
    { key: 'dispatched', label: 'Dispatched' },
];

const stageIndex = (status?: string | null) => {
    const idx = STAGE_ORDER.indexOf(status ?? 'pending');
    return idx < 0 ? 0 : idx;
};

const itemProgress = (item: OrderItem) => Math.round((stageIndex(item.status) / (STAGE_ORDER.length - 1)) * 100);

const orderProgress = (order: Order) => {
    if (order.items.length === 0) return 0;
    const sum = order.items.reduce((acc, i) => acc + stageIndex(i.status) / (STAGE_ORDER.length - 1), 0);
    return Math.round((sum / order.items.length) * 100);
};

const matchesFilter = (order: Order, filter: FilterKey) => {
    if (filter === 'all') return true;
    const statuses = order.items.map((i) => i.status ?? 'pending');
    switch (filter) {
        case 'pending':
            return statuses.some((s) => s === 'pending');
        case 'in-process':
            return statuses.some((s) => ['processing', 'filling', 'labeling'].includes(s));
        case 'ready':
            return statuses.some((s) => s === 'ready');
        case 'dispatched':
            return order.status === 'dispatched' || statuses.some((s) => s === 'dispatched');
        default:
            return true;
    }
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDay = (iso?: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const priorityClass = (priority?: string | null) => `badge priority-${priority ?? 'normal'}`;

const boxesFor = (item: OrderItem): number | null => {
    if (!item.box_size || item.box_size <= 0) return null;
    return Math.ceil(Number(item.quantity) / item.box_size);
};

export default function FactoryIndex({ orders, urgentPending, canAdvance }: Props) {
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');
    const [openOrders, setOpenOrders] = useState<number[]>([]);
    const [stagingItem, setStagingItem] = useState<number | null>(null);
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    // Factory notes (local editable copy, keyed by order id)
    const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
    const [savingNotes, setSavingNotes] = useState<number | null>(null);

    // Fill modal
    const [labelsModal, setLabelsModal] = useState<{ item: OrderItem } | null>(null);
    const [labelsValue, setLabelsValue] = useState('');
    const [labelsSaving, setLabelsSaving] = useState(false);

    const visibleOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        return orders.filter((o) => {
            if (!matchesFilter(o, activeFilter)) return false;
            if (!q) return true;
            return (
                o.order_number.toLowerCase().includes(q) ||
                o.company_name.toLowerCase().includes(q) ||
                o.customer_name.toLowerCase().includes(q)
            );
        });
    }, [orders, activeFilter, search]);

    const toggleOrder = (orderId: number) =>
        setOpenOrders((curr) => (curr.includes(orderId) ? curr.filter((id) => id !== orderId) : [...curr, orderId]));

    const setItemStage = (itemId: number, stage: string, current: string) => {
        if (stage === current) return;
        const targetIdx = STAGE_ORDER.indexOf(stage);
        const currentIdx = STAGE_ORDER.indexOf(current);
        if (targetIdx < currentIdx && !confirm(`Move this item back to "${STAGE_LABELS[stage] ?? stage}"?`)) return;
        setStagingItem(itemId);
        router.post(
            itemSetStage(itemId).url,
            { stage },
            { preserveScroll: true, onFinish: () => setStagingItem(null) },
        );
    };

    const dispatchReady = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        const ready = order.items.filter((i) => i.status === 'ready').length;
        if (ready === 0) return;
        if (!confirm(`Dispatch ${ready} ready item(s) for ${order.order_number}?`)) return;
        setDispatchingOrder(order.id);
        router.post(orderDispatch(order.id).url, {}, { preserveScroll: true, onFinish: () => setDispatchingOrder(null) });
    };

    const approveUrgent = (orderId: number) => {
        setApprovingId(orderId);
        router.post(ordersApproveUrgent(orderId).url, {}, { preserveScroll: true, onFinish: () => setApprovingId(null) });
    };

    const rejectUrgent = (orderId: number) => {
        if (!confirm('Reject this urgent order? The office will need to address it.')) return;
        setRejectingId(orderId);
        router.post(ordersRejectUrgent(orderId).url, {}, { preserveScroll: true, onFinish: () => setRejectingId(null) });
    };

    const saveNotes = (order: Order) => {
        const value = notesDraft[order.id] ?? order.factory_notes ?? '';
        setSavingNotes(order.id);
        router.post(
            orderNotes(order.id).url,
            { factory_notes: value },
            { preserveScroll: true, onFinish: () => setSavingNotes(null) },
        );
    };

    const openLabelsModal = (item: OrderItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setLabelsModal({ item });
        setLabelsValue(item.labels_received != null ? String(item.labels_received) : '');
    };

    const submitLabels = () => {
        if (!labelsModal) return;
        const qty = parseInt(labelsValue, 10);
        if (isNaN(qty) || qty < 0) return;
        setLabelsSaving(true);
        router.post(
            itemLabels(labelsModal.item.id).url,
            { labels_received: qty },
            {
                preserveScroll: true,
                onFinish: () => {
                    setLabelsSaving(false);
                    setLabelsModal(null);
                },
            },
        );
    };

    const printBoxLabels = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        const win = window.open('', '_blank', 'width=800,height=600');
        if (!win) return;
        const labels: string[] = [];
        order.items.forEach((item) => {
            const boxes = boxesFor(item) ?? 1;
            for (let b = 1; b <= boxes; b++) {
                labels.push(`
                    <div class="label">
                        <div class="brand">${item.our_brand ?? '—'}</div>
                        ${item.party_brand ? `<div class="sub">${item.party_brand}</div>` : ''}
                        <div class="row"><span>Packing</span><b>${item.packing_size ?? '—'}</b></div>
                        <div class="row"><span>Box</span><b>${b} / ${boxes}</b></div>
                        ${item.box_size ? `<div class="row"><span>Qty/Box</span><b>${item.box_size}</b></div>` : ''}
                        <div class="ord">${order.order_number} · ${order.company_name}</div>
                    </div>`);
            }
        });
        win.document.write(`
            <html><head><title>Box Labels — ${order.order_number}</title>
            <style>
                body { font-family: system-ui, sans-serif; margin: 16px; }
                .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .label { border: 1px dashed #888; border-radius: 8px; padding: 14px; }
                .brand { font-size: 18px; font-weight: 800; }
                .sub { color: #555; font-size: 13px; margin-bottom: 6px; }
                .row { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
                .ord { margin-top: 8px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 6px; }
                @media print { .grid { grid-template-columns: repeat(2, 1fr); } }
            </style></head>
            <body><div class="grid">${labels.join('')}</div>
            <script>window.onload = () => window.print();</script>
            </body></html>`);
        win.document.close();
    };

    const allLogEntries = orders.flatMap((o) => o.items);
    void allLogEntries; // history is rendered inline per item below

    return (
        <>
            <Head title="Production Orders" />
            <div id="view-factory" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Production Orders</h1>
                        <p>Manage item stage progression for confirmed orders.</p>
                    </div>
                </div>

                {/* ── Filter bar + search ── */}
                <div className="filter-bar" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ marginRight: '4px' }}>Production Orders</h2>
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={`pill ${activeFilter === f.key ? 'active' : ''}`}
                            onClick={() => setActiveFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', minWidth: '220px', flex: '0 1 320px' }}>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="🔍 Search order, company, customer…"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                {/* ── Urgent Approval Requests (factory/admin only) ── */}
                {canAdvance && urgentPending.length > 0 && (
                    <div className="card" style={{ marginBottom: '20px', border: '2px solid #ef4444' }}>
                        <div className="card-title" style={{ color: '#ef4444' }}>
                            🚨 Urgent Approval Requests
                            <span className="ct-badge" style={{ background: '#ef4444', color: '#fff' }}>
                                {urgentPending.length} pending
                            </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--tx-sub)', marginBottom: '14px' }}>
                            These urgent orders are waiting for your approval before office can confirm them for production.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {urgentPending.map((order) => (
                                <div
                                    key={order.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        background: 'var(--bg-page)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div style={{ minWidth: '80px', fontWeight: 700, color: 'var(--accent)', fontSize: '13px' }}>
                                        {order.order_number}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '140px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--tx-head)' }}>{order.company_name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--tx-sub)' }}>{order.customer_name}</div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--tx-muted)', minWidth: '100px' }}>
                                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                        {order.items.slice(0, 2).map((item, idx) => (
                                            <div key={idx} style={{ color: 'var(--tx-faint)' }}>
                                                {item.our_brand ?? '—'} {item.packing_size ? `(${item.packing_size})` : ''} ×{item.quantity}
                                            </div>
                                        ))}
                                        {order.items.length > 2 && <div style={{ color: 'var(--tx-faint)' }}>+{order.items.length - 2} more</div>}
                                    </div>
                                    {order.order_date && <div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>{formatDate(order.order_date)}</div>}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn primary"
                                            style={{ padding: '6px 16px', fontSize: '13px' }}
                                            onClick={() => approveUrgent(order.id)}
                                            disabled={approvingId === order.id || rejectingId === order.id}
                                        >
                                            {approvingId === order.id ? '…' : '✓ Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn danger-xs"
                                            style={{ padding: '6px 14px', fontSize: '13px' }}
                                            onClick={() => rejectUrgent(order.id)}
                                            disabled={approvingId === order.id || rejectingId === order.id}
                                        >
                                            {rejectingId === order.id ? '…' : '✕ Reject'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {visibleOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🏭</div>
                        <p>
                            {orders.length === 0
                                ? 'No confirmed orders in production. Orders must be confirmed by office/admin first.'
                                : 'No orders match this filter.'}
                        </p>
                    </div>
                ) : (
                    visibleOrders.map((order) => {
                        const isOpen = openOrders.includes(order.id);
                        const progress = orderProgress(order);
                        const readyCount = order.items.filter((i) => i.status === 'ready').length;
                        const notesValue = notesDraft[order.id] ?? order.factory_notes ?? '';

                        return (
                            <div key={order.id} className={`order-card${isOpen ? ' open' : ''}`}>
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleOrder(order.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') toggleOrder(order.id);
                                    }}
                                >
                                    <div className="o-id" style={order.status === 'dispatched' ? { background: '#d1fae5', color: '#065f46' } : undefined}>
                                        {order.order_number}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{order.company_name}</div>
                                        <div className="o-customer">
                                            {order.customer_name} · {order.items.length} product(s)
                                        </div>
                                    </div>
                                    <div className="o-meta" style={{ alignItems: 'flex-end' }}>
                                        <div>
                                            {formatDate(order.order_date)}
                                            {order.sales_user_name ? ` · ${order.sales_user_name}` : ''}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="progress-bar" style={{ width: '90px' }}>
                                                <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--tx-muted)', fontWeight: 600 }}>{progress}%</span>
                                        </div>
                                        <span className={priorityClass(order.priority)}>{(order.priority ?? 'normal').toUpperCase()}</span>
                                        {order.status === 'dispatched' && (
                                            <span className="badge s-dispatched">✓ Dispatched</span>
                                        )}
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    {/* ── Action toolbar ── */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: '8px',
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                            padding: '10px 12px',
                                            background: 'var(--bg-page)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginBottom: '14px',
                                        }}
                                    >
                                        <button type="button" className="btn sm" onClick={() => toggleOrder(order.id)}>
                                            👁 {isOpen ? 'Hide' : 'View'}
                                        </button>
                                        <button type="button" className="btn sm" onClick={() => window.print()}>
                                            🖨 Print
                                        </button>
                                        {canAdvance && (
                                            <button
                                                type="button"
                                                className={`btn sm${readyCount > 0 ? ' primary' : ''}`}
                                                onClick={(e) => dispatchReady(order, e)}
                                                disabled={readyCount === 0 || dispatchingOrder === order.id}
                                                title={readyCount === 0 ? 'No items ready for dispatch' : `Dispatch ${readyCount} ready item(s)`}
                                            >
                                                {dispatchingOrder === order.id ? '…' : `📦 Dispatch${readyCount > 0 ? ` (${readyCount})` : ''}`}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn sm"
                                            style={{ marginLeft: 'auto', borderColor: '#d97706', color: '#d97706' }}
                                            onClick={(e) => printBoxLabels(order, e)}
                                        >
                                            🏷 Box Labels
                                        </button>
                                    </div>

                                    {/* ── Design status banner ── */}
                                    {order.design_status && (
                                        <div
                                            style={{
                                                borderLeft: '3px solid var(--accent, #7c3aed)',
                                                background: 'var(--accent-soft, #f5f3ff)',
                                                borderRadius: '6px',
                                                padding: '8px 12px',
                                                marginBottom: '10px',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <span style={{ fontWeight: 700, color: 'var(--accent, #7c3aed)' }}>
                                                🎨 DESIGN: {order.design_status.label.toUpperCase()}
                                            </span>
                                            {order.design_status.by && <span style={{ color: 'var(--tx-muted)' }}> · {order.design_status.by}</span>}
                                            {order.design_status.at && (
                                                <span style={{ color: 'var(--tx-faint)' }}>
                                                    {' · '}
                                                    {formatTime(order.design_status.at)} · {formatDay(order.design_status.at)}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Tax documents banner ── */}
                                    {order.tax_docs_pending && (
                                        <div
                                            style={{
                                                background: 'var(--bg-yellow, #fefce8)',
                                                border: '1px solid var(--border-yellow, #fde68a)',
                                                borderRadius: '6px',
                                                padding: '8px 12px',
                                                marginBottom: '10px',
                                                fontSize: '13px',
                                                color: '#92400e',
                                            }}
                                        >
                                            📄 Tax documents pending — accountant will upload invoice &amp; e-way bill
                                        </div>
                                    )}

                                    {/* ── Factory notes ── */}
                                    <div style={{ marginBottom: '14px' }}>
                                        {canAdvance ? (
                                            <>
                                                <textarea
                                                    value={notesValue}
                                                    onChange={(e) => setNotesDraft((d) => ({ ...d, [order.id]: e.target.value }))}
                                                    placeholder="Factory notes…"
                                                    rows={2}
                                                    style={{ width: '100%', resize: 'vertical' }}
                                                />
                                                {notesValue !== (order.factory_notes ?? '') && (
                                                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                                                        <button
                                                            type="button"
                                                            className="btn sm primary"
                                                            onClick={() => saveNotes(order)}
                                                            disabled={savingNotes === order.id}
                                                        >
                                                            {savingNotes === order.id ? 'Saving…' : '💾 Save notes'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn sm"
                                                            onClick={() => setNotesDraft((d) => ({ ...d, [order.id]: order.factory_notes ?? '' }))}
                                                            disabled={savingNotes === order.id}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            order.factory_notes && (
                                                <div style={{ fontSize: '13px', color: 'var(--tx-muted)', fontStyle: 'italic' }}>
                                                    🏭 {order.factory_notes}
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* ── Items table ── */}
                                    <div className="prod-wrap">
                                        <table className="prod-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Details</th>
                                                    <th>Stage Actions</th>
                                                    <th style={{ width: '150px' }}>Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item) => {
                                                    const isDispatched = item.status === 'dispatched';
                                                    const boxes = boxesFor(item);
                                                    const total = Number(item.quantity);
                                                    const received = item.labels_received ?? null;
                                                    const short = received != null ? total - received : null;
                                                    const showLabels = received != null || item.status !== 'pending';
                                                    const log = [...(item.stage_log ?? [])].reverse();

                                                    return (
                                                        <tr key={item.id}>
                                                            {/* Product */}
                                                            <td>
                                                                <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                {item.party_brand && <div className="prod-detail">{item.party_brand}</div>}
                                                                <span className={`badge ${STAGE_CLASS[item.status] ?? 'gray'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                                                                    {STAGE_LABELS[item.status] ?? item.status}
                                                                </span>
                                                            </td>

                                                            {/* Details */}
                                                            <td>
                                                                <div style={{ fontSize: '13px' }}>
                                                                    {item.packing_size ? `${item.packing_size} · ` : ''}Qty: {item.quantity}
                                                                </div>
                                                                {boxes != null && (
                                                                    <div className="prod-detail">
                                                                        📦 {boxes} box{boxes !== 1 ? 'es' : ''} ({item.box_size}/box)
                                                                    </div>
                                                                )}
                                                                {item.type && (
                                                                    <div className="prod-detail" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                        {item.type}
                                                                        {item.cap_color && (
                                                                            <span
                                                                                title={item.cap_color}
                                                                                style={{
                                                                                    display: 'inline-block',
                                                                                    width: '10px',
                                                                                    height: '10px',
                                                                                    borderRadius: '50%',
                                                                                    border: '1px solid var(--border)',
                                                                                    background: item.cap_color,
                                                                                }}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Stage actions */}
                                                            <td>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        {showLabels && (
                                                                            <span
                                                                                className={`badge ${short != null && short > 0 ? 'red' : received != null ? 'green' : 'gray'}`}
                                                                                style={{ cursor: canAdvance ? 'pointer' : 'default' }}
                                                                                onClick={canAdvance ? (e) => openLabelsModal(item, e) : undefined}
                                                                                title={canAdvance ? 'Record labels received at factory' : 'Labels received at factory'}
                                                                            >
                                                                                🏷 Labels: {received != null ? `${received}/${total}` : `—/${total}`}
                                                                                {short != null && short > 0 ? ` (${short} short)` : received != null ? ' ✓' : ''}
                                                                            </span>
                                                                        )}
                                                                        {!canAdvance && isDispatched && (
                                                                            <span style={{ fontSize: '12px', color: 'var(--tx-faint)' }}>✓ Completed</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Stage selector — factory user can pick any stage */}
                                                                    {canAdvance && (
                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                            {STAGE_ORDER.map((stage) => {
                                                                                const isCurrent = item.status === stage;
                                                                                return (
                                                                                    <button
                                                                                        key={stage}
                                                                                        type="button"
                                                                                        className={`badge ${isCurrent ? (STAGE_CLASS[stage] ?? 'gray') : 'gray'}`}
                                                                                        onClick={() => setItemStage(item.id, stage, item.status)}
                                                                                        disabled={stagingItem === item.id || isCurrent}
                                                                                        title={isCurrent ? 'Current stage' : `Set to ${STAGE_LABELS[stage]}`}
                                                                                        style={{
                                                                                            cursor: isCurrent ? 'default' : 'pointer',
                                                                                            border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                                                                                            opacity: isCurrent ? 1 : 0.75,
                                                                                            fontWeight: isCurrent ? 700 : 500,
                                                                                        }}
                                                                                    >
                                                                                        {isCurrent ? '● ' : ''}
                                                                                        {STAGE_LABELS[stage]}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                            {stagingItem === item.id && <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>…</span>}
                                                                        </div>
                                                                    )}

                                                                    {/* Inline stage history */}
                                                                    {log.length > 0 && (
                                                                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {log.map((entry, idx) => (
                                                                                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                                                                    <span>{entry.revert ? '↩' : '▶'}</span>
                                                                                    <b>{STAGE_LABELS[entry.to] ?? entry.to}</b>
                                                                                    {entry.name && <span style={{ color: 'var(--tx-muted)' }}>— {entry.name}</span>}
                                                                                    <span style={{ color: 'var(--tx-faint)' }}>
                                                                                        · {formatTime(entry.at)} · {formatDay(entry.at)}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {canAdvance && (
                                                                        <div>
                                                                            <Link href={unitTransferIndex()} className="btn sm" onClick={(e) => e.stopPropagation()}>
                                                                                🔄 Transfer Unit
                                                                            </Link>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Progress */}
                                                            <td>
                                                                <div className="progress-bar">
                                                                    <div className="progress-fill" style={{ width: `${itemProgress(item)}%`, background: 'var(--accent)' }} />
                                                                </div>
                                                                <div className="prod-detail" style={{ marginTop: '4px' }}>{STAGE_LABELS[item.status] ?? item.status}</div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Fill progress modal ── */}
            {labelsModal && (
                <div className="modal-overlay open" onClick={() => !labelsSaving && setLabelsModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px' }}>
                        <div className="modal-header">
                            <h2>🏷 Labels Received at Factory</h2>
                            <button className="modal-close" onClick={() => setLabelsModal(null)} disabled={labelsSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <p style={{ fontSize: '13px', color: 'var(--tx-muted)', marginBottom: '14px' }}>
                                {labelsModal.item.our_brand ?? '—'} · Total Qty: <strong>{labelsModal.item.quantity}</strong>
                            </p>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Labels Received</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={Number(labelsModal.item.quantity)}
                                    value={labelsValue}
                                    onChange={(e) => setLabelsValue(e.target.value)}
                                    autoFocus
                                    disabled={labelsSaving}
                                />
                                {labelsValue !== '' && parseInt(labelsValue, 10) < Number(labelsModal.item.quantity) && (
                                    <span style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                                        {Number(labelsModal.item.quantity) - parseInt(labelsValue, 10)} short
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setLabelsModal(null)} disabled={labelsSaving}>Cancel</button>
                                <button type="button" className="btn-primary" onClick={submitLabels} disabled={labelsSaving || labelsValue === ''}>
                                    {labelsSaving ? 'Saving…' : '✓ Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
