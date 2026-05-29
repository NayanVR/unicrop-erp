import { labels as itemLabels, setStage as itemSetStage } from '@/routes/factory/items';
import { dispatch as orderDispatch, notes as orderNotes } from '@/routes/factory/orders';
import { approveUrgent as ordersApproveUrgent, rejectUrgent as ordersRejectUrgent } from '@/routes/orders';
import { index as unitTransferIndex } from '@/routes/unit-transfer';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type ProductPhoto = {
    id: number;
    party_id: number | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    photo_url: string;
};

function buildPhotoMap(photos: ProductPhoto[]) {
    const ob = new Map<string, string>();
    const pb = new Map<string, string>();
    for (const p of photos) {
        const size = (p.packing_size ?? '').toLowerCase();
        if (p.party_id === null) {
            ob.set(`${p.our_brand.toLowerCase()}|${size}`, p.photo_url);
            if (!p.packing_size) ob.set(`${p.our_brand.toLowerCase()}|`, p.photo_url);
        } else if (p.party_brand) {
            pb.set(`${p.party_id}|${p.party_brand.toLowerCase()}|${size}`, p.photo_url);
        }
    }
    return { ob, pb };
}

function getItemPhoto(
    item: OrderItem,
    partyId: number | null | undefined,
    map: { ob: Map<string, string>; pb: Map<string, string> },
): string | null {
    if (!item.our_brand) return null;
    const size = (item.packing_size ?? '').toLowerCase();
    if (partyId && item.party_brand) {
        const key = `${partyId}|${item.party_brand.toLowerCase()}|${size}`;
        const url = map.pb.get(key) ?? map.pb.get(`${partyId}|${item.party_brand.toLowerCase()}|`);
        if (url) return url;
    }
    return map.ob.get(`${item.our_brand.toLowerCase()}|${size}`)
        ?? map.ob.get(`${item.our_brand.toLowerCase()}|`)
        ?? null;
}

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
    party_id?: number | null;
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
    productPhotos?: ProductPhoto[];
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

type EditableLabel = {
    key: string;
    transport: string;
    destination: string;
    party: string;
    boxNum: number;
    totalBoxes: number;
    itemBoxNum: number;   // this box's position within its product (1-of-3)
    itemTotalBoxes: number; // total boxes for this product
    brand: string;
    inBoxPcs: string;
    orderRef: string;
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

export default function FactoryIndex({ orders, urgentPending, canAdvance, productPhotos = [] }: Props) {
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

    // Labels received modal
    const [labelsModal, setLabelsModal] = useState<{ item: OrderItem } | null>(null);
    const [labelsValue, setLabelsValue] = useState('');
    const [labelsSaving, setLabelsSaving] = useState(false);

    const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);
    const [labelEditor, setLabelEditor] = useState<{ order: Order; labels: EditableLabel[] } | null>(null);
    const [boxSizeDraft, setBoxSizeDraft] = useState<Record<number, string>>({});
    const [savingBoxSize, setSavingBoxSize] = useState<number | null>(null);

    const photoMap = useMemo(() => buildPhotoMap(productPhotos), [productPhotos]);

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

    const saveBoxSize = (itemId: number) => {
        const raw = boxSizeDraft[itemId];
        if (raw === undefined) return;
        const num = parseInt(raw, 10);
        if (isNaN(num) || num < 1) return;
        setSavingBoxSize(itemId);
        router.patch(
            `/factory/items/${itemId}`,
            { box_size: num },
            { preserveScroll: true, onFinish: () => setSavingBoxSize(null) },
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

    const openLabelEditor = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        const totalBoxes = order.items.reduce((sum, item) => sum + (boxesFor(item) ?? 1), 0);
        const labels: EditableLabel[] = [];
        let seq = 1;
        order.items.forEach((item) => {
            const itemBoxes = boxesFor(item) ?? 1;
            const brand = item.party_brand || item.our_brand || '—';
            for (let b = 1; b <= itemBoxes; b++) {
                labels.push({
                    key: `${item.id}-${b}`,
                    transport: order.transport_name ?? '',
                    destination: order.destination ?? '',
                    party: order.company_name,
                    boxNum: seq++,
                    totalBoxes,
                    itemBoxNum: b,
                    itemTotalBoxes: itemBoxes,
                    brand: `${brand}${item.packing_size ? ' · ' + item.packing_size : ''}`,
                    inBoxPcs: item.box_size ? String(item.box_size) : '',
                    orderRef: order.order_number,
                });
            }
        });
        setLabelEditor({ order, labels });
    };

    const updateLabelField = (idx: number, field: keyof Omit<EditableLabel, 'key' | 'boxNum' | 'totalBoxes' | 'itemBoxNum' | 'itemTotalBoxes'>, value: string) => {
        setLabelEditor((prev) => {
            if (!prev) return prev;
            const labels = [...prev.labels];
            labels[idx] = { ...labels[idx], [field]: value };
            return { ...prev, labels };
        });
    };

    const downloadLabelsPDF = () => {
        if (!labelEditor) return;
        const esc = (s: string) =>
            s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        const labelHtml = labelEditor.labels
            .map(
                (lbl) => `
            <div class="label">
                <div class="transport">${esc(lbl.transport || '—')}</div>
                <div class="destination">${esc(lbl.destination || '—')}</div>
                <div class="party">${esc(lbl.party || '—')}</div>
                <div class="mid-row">
                    <span class="box-num">${lbl.boxNum}</span>
                    <span class="total-boxes">${lbl.totalBoxes} box</span>
                </div>
                <div class="auto-row2">
                    <span class="inboxpcs">${lbl.inBoxPcs ? `In-box: <b>${esc(lbl.inBoxPcs)} pcs</b>` : '—'}</span>
                    <span class="item-box-count">product box ${lbl.itemBoxNum}/${lbl.itemTotalBoxes}</span>
                </div>
                <div class="product-block">
                    <div class="brand-name">${esc(lbl.brand || '—')}</div>
                </div>
                <div class="order-ref">${esc(lbl.orderRef)}</div>
            </div>`,
            )
            .join('');
        win.document.write(`<html><head><title>Box Labels — ${labelEditor.order.order_number}</title>
            <style>
                @page { size: 100mm 75mm; margin: 3mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                .label { width:100mm; height:75mm; padding:4mm 5mm; border:0.5px solid #000; page-break-after:always; display:flex; flex-direction:column; overflow:hidden; }
                .label:last-child { page-break-after:avoid; }
                .transport { font-size:22pt; font-weight:900; line-height:1.1; margin-bottom:1mm; }
                .destination { font-size:9pt; color:#444; margin-bottom:1mm; }
                .party { font-size:13pt; font-weight:700; margin-bottom:2mm; }
                .mid-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2mm; }
                .box-num { font-size:24pt; font-weight:900; }
                .total-boxes { font-size:20pt; font-weight:900; }
                .auto-row2 { display:flex; justify-content:space-between; align-items:center; font-size:9pt; margin-bottom:1.5mm; }
                .inboxpcs { font-weight:700; color:#222; }
                .item-box-count { color:#666; font-style:italic; font-size:8pt; }
                .product-block { border-top:0.5px solid #ccc; padding-top:1.5mm; margin-top:auto; }
                .brand-name { font-size:12pt; font-weight:900; }
                .order-ref { font-size:7.5pt; color:#888; margin-top:1mm; text-align:right; }
                .toolbar { position:sticky; top:0; z-index:10; background:#1e293b; color:#fff; padding:10px 16px; display:flex; align-items:center; gap:12px; }
                .toolbar button { background:#2563eb; color:#fff; border:0; border-radius:6px; padding:8px 18px; font-size:14px; font-weight:700; cursor:pointer; }
                .toolbar span { color:#cbd5e1; font-size:12px; }
                @media screen { body { background:#f0f0f0; } .label { margin:10px auto; border:1px dashed #888; border-radius:4px; background:#fff; } }
                @media print { .toolbar { display:none; } }
            </style></head>
            <body><div class="toolbar"><button onclick="window.print()">🖨 Save as PDF / Print</button><span>${labelEditor.labels.length} label(s) — ${labelEditor.order.order_number}</span></div>
            ${labelHtml}</body></html>`);
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
                                            onClick={(e) => openLabelEditor(order, e)}
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
                                                    const photo = getItemPhoto(item, order.party_id, photoMap);

                                                    return (
                                                        <tr key={item.id}>
                                                            {/* Product */}
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                                    {photo ? (
                                                                        <img
                                                                            src={photo}
                                                                            alt=""
                                                                            onClick={(e) => { e.stopPropagation(); setPhotoLightbox(photo); }}
                                                                            style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '2px', flexShrink: 0, cursor: 'zoom-in' }}
                                                                        />
                                                                    ) : (
                                                                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'var(--tx-muted)', flexShrink: 0 }}>
                                                                            📷
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                        {item.party_brand && <div className="prod-detail">{item.party_brand}</div>}
                                                                        <span className={`badge ${STAGE_CLASS[item.status] ?? 'gray'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                                                                            {STAGE_LABELS[item.status] ?? item.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Details */}
                                                            <td>
                                                                <div style={{ fontSize: '13px' }}>
                                                                    {item.packing_size ? `${item.packing_size} · ` : ''}Qty: {item.quantity}
                                                                </div>
                                                                {/* Per-box pcs — inline editable */}
                                                                <div className="prod-detail" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                                    <span>📦</span>
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        value={boxSizeDraft[item.id] ?? (item.box_size != null ? String(item.box_size) : '')}
                                                                        onChange={(e) => setBoxSizeDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                                        onBlur={() => saveBoxSize(item.id)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && saveBoxSize(item.id)}
                                                                        placeholder="pcs/box"
                                                                        disabled={savingBoxSize === item.id}
                                                                        style={{
                                                                            width: '64px', padding: '2px 5px', fontSize: '12px',
                                                                            border: '1px solid var(--border)', borderRadius: '4px',
                                                                            background: 'var(--bg-input, #fff)',
                                                                        }}
                                                                    />
                                                                    <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>
                                                                        pcs/box
                                                                        {boxes != null && item.box_size
                                                                            ? ` · ${boxes} box${boxes !== 1 ? 'es' : ''}`
                                                                            : ''}
                                                                    </span>
                                                                </div>
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

            {/* ── Box Label Editor Modal ── */}
            {labelEditor && (
                <div
                    className="modal-overlay open"
                    onClick={() => setLabelEditor(null)}
                    style={{ zIndex: 9000, alignItems: 'flex-start', overflowY: 'auto', padding: '24px 16px' }}
                >
                    <div
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '900px', width: '100%', margin: 'auto' }}
                    >
                        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h2 style={{ flex: 1 }}>🏷 Box Labels — {labelEditor.order.order_number}</h2>
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '8px 18px', fontSize: '14px' }}
                                onClick={downloadLabelsPDF}
                            >
                                ⬇ Download PDF
                            </button>
                            <button className="modal-close" onClick={() => setLabelEditor(null)}>✕</button>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--tx-sub)', padding: '0 20px 12px', margin: 0 }}>
                            Click any field on a label to edit it. Box numbers are assigned automatically.
                        </p>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                gap: '16px',
                                padding: '0 20px 20px',
                            }}
                        >
                            {labelEditor.labels.map((lbl, idx) => (
                                <div
                                    key={lbl.key}
                                    style={{
                                        border: '1.5px solid #999',
                                        borderRadius: '6px',
                                        padding: '10px 12px',
                                        background: '#fff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '3px',
                                        fontFamily: 'Arial, sans-serif',
                                    }}
                                >
                                    {/* Label badge */}
                                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px', fontWeight: 600, letterSpacing: '0.04em' }}>
                                        LABEL {lbl.boxNum} OF {lbl.totalBoxes}
                                    </div>
                                    {/* Transport */}
                                    <input
                                        value={lbl.transport}
                                        onChange={(e) => updateLabelField(idx, 'transport', e.target.value)}
                                        placeholder="Transport name"
                                        style={{
                                            border: 'none', borderBottom: '1px dashed #ccc', outline: 'none',
                                            fontSize: '20px', fontWeight: 900, lineHeight: 1.1, padding: '2px 0',
                                            width: '100%', background: 'transparent',
                                        }}
                                    />
                                    {/* Destination */}
                                    <input
                                        value={lbl.destination}
                                        onChange={(e) => updateLabelField(idx, 'destination', e.target.value)}
                                        placeholder="Destination"
                                        style={{
                                            border: 'none', borderBottom: '1px dashed #ccc', outline: 'none',
                                            fontSize: '11px', color: '#444', padding: '2px 0',
                                            width: '100%', background: 'transparent',
                                        }}
                                    />
                                    {/* Party */}
                                    <input
                                        value={lbl.party}
                                        onChange={(e) => updateLabelField(idx, 'party', e.target.value)}
                                        placeholder="Party name"
                                        style={{
                                            border: 'none', borderBottom: '1px dashed #ccc', outline: 'none',
                                            fontSize: '14px', fontWeight: 700, padding: '2px 0',
                                            width: '100%', background: 'transparent',
                                        }}
                                    />
                                    {/* Auto row: box number | total boxes */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 2px' }}>
                                        <span style={{ fontSize: '26px', fontWeight: 900, color: '#111' }}>{lbl.boxNum}</span>
                                        <span style={{ fontSize: '22px', fontWeight: 900, color: '#111' }}>{lbl.totalBoxes} box</span>
                                    </div>
                                    {/* In-box pcs (editable) | product box N/M (auto) */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', color: '#555' }}>In-box:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={lbl.inBoxPcs}
                                                onChange={(e) => updateLabelField(idx, 'inBoxPcs', e.target.value)}
                                                placeholder="pcs"
                                                style={{
                                                    border: 'none', borderBottom: '1px dashed #ccc', outline: 'none',
                                                    fontSize: '13px', fontWeight: 700, color: '#111',
                                                    width: '60px', background: 'transparent', padding: '0 2px',
                                                }}
                                            />
                                            <span style={{ fontSize: '11px', color: '#555' }}>pcs</span>
                                        </div>
                                        <span style={{ fontSize: '10px', color: '#777', fontStyle: 'italic' }}>
                                            product box {lbl.itemBoxNum}/{lbl.itemTotalBoxes}
                                        </span>
                                    </div>
                                    {/* Product block */}
                                    <div style={{ borderTop: '1px solid #ddd', paddingTop: '6px', marginTop: '2px' }}>
                                        {/* Brand */}
                                        <input
                                            value={lbl.brand}
                                            onChange={(e) => updateLabelField(idx, 'brand', e.target.value)}
                                            placeholder="Brand · packing"
                                            style={{
                                                border: 'none', borderBottom: '1px dashed #ccc', outline: 'none',
                                                fontSize: '13px', fontWeight: 900, padding: '2px 0',
                                                width: '100%', background: 'transparent',
                                            }}
                                        />
                                    </div>
                                    {/* Order ref */}
                                    <input
                                        value={lbl.orderRef}
                                        onChange={(e) => updateLabelField(idx, 'orderRef', e.target.value)}
                                        placeholder="Order ref"
                                        style={{
                                            border: 'none', outline: 'none',
                                            fontSize: '10px', color: '#999', padding: '2px 0',
                                            width: '100%', background: 'transparent', textAlign: 'right',
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Photo lightbox */}
            {photoLightbox && (
                <div
                    className="modal-overlay open"
                    onClick={() => setPhotoLightbox(null)}
                    style={{ zIndex: 9999, background: 'rgba(0,0,0,0.75)' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                    >
                        <img
                            src={photoLightbox}
                            alt=""
                            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
                        />
                        <button
                            type="button"
                            onClick={() => setPhotoLightbox(null)}
                            style={{ position: 'absolute', top: '-14px', right: '-14px', width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontWeight: 700 }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
