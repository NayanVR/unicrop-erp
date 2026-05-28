import { advance as designAdvance, tracking as designTracking } from '@/routes/design';
import { confirm as ordersConfirm, create as ordersCreate, sendToDesign as ordersSendToDesign } from '@/routes/orders';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

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

type OrderItem = {
    id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    quantity: string | number;
    rate: string | number;
    amount: string | number;
    gst_percent: string | number;
    gst_amount: string | number;
    status?: string | null;
    stage_log?: Array<{ stage?: string; name?: string | null; at?: string; revert?: boolean }> | null;
};

const lastStageActor = (item: OrderItem): string | null => {
    const log = item.stage_log;
    if (!log || log.length === 0) return null;
    return log[log.length - 1]?.name ?? null;
};

type Order = {
    id: number;
    party_id?: number | null;
    order_number: string;
    company_name: string;
    customer_name: string;
    sales_user_id?: number | null;
    sales_user?: { id: number; name: string } | null;
    created_by?: number | null;
    order_date?: string | null;
    destination?: string | null;
    transport_name?: string | null;
    priority?: string | null;
    status?: string | null;
    urgent_approved?: boolean | null;
    subtotal?: string | number;
    gst_total?: string | number;
    total_amount?: string | number;
    confirmed_at?: string | null;
    confirmed_by_name?: string | null;
    created_by_name?: string | null;
    design_handlers?: string[];
    design_items?: DesignItem[];
    items: OrderItem[];
};

type DesignItem = {
    id: number;
    order_item_id: number | null;
    status: string;
    order_qty: number | null;
    pcs_to_print: number | null;
    labels_received: number | null;
    skip_party_approval: boolean;
    assignee: string | null;
    stage_log: Array<{ stage: string; at: string; by?: string | null }> | null;
};

const DESIGN_STAGES = [
    { key: 'pending',          label: 'Pending Acceptance',  advanceLabel: '✓ Mark Accepted' },
    { key: 'accepted',         label: 'Accepted',            advanceLabel: '✓ Mark Design Ready' },
    { key: 'design-ready',     label: 'Design Ready',        advanceLabel: '✓ Party Approved' },
    { key: 'approved-party',   label: 'Party Approved',      advanceLabel: '✓ Sent to Print' },
    { key: 'sent-print',       label: 'Sent to Print',       advanceLabel: '✓ Mark Completed' },
    { key: 'completed',        label: 'Completed',           advanceLabel: '✓ Received at Factory' },
    { key: 'received-factory', label: 'Received at Factory', advanceLabel: '' },
];

const designStagesFor = (skip: boolean) =>
    skip ? DESIGN_STAGES.filter((s) => s.key !== 'approved-party') : DESIGN_STAGES;

type ProductPhoto = {
    id: number;
    party_id: number | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    photo_url: string;
};

type ConfirmTarget = { id: number; number: string; companyName: string };

type Props = {
    pageTitle: string;
    orders: Order[];
    currentUserId?: number | null;
    userRole?: string | null;
    productPhotos?: ProductPhoto[];
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
};

const formatAmount = (value?: string | number | null) =>
    Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusClassName = (status?: string | null) => {
    switch (status) {
        case 'submitted':  return 'badge sky';
        case 'confirmed':  return 'badge teal';
        case 'design':     return 'badge purple';
        case 'draft':      return 'badge amber';
        default:           return 'badge gray';
    }
};

const statusLabel = (status?: string | null) => {
    switch (status) {
        case 'design': return '🎨 DESIGN';
        default: return (status ?? 'draft').toUpperCase();
    }
};

const priorityClassName = (priority?: string | null) =>
    `badge priority-${priority ?? 'normal'}`;

export default function OrdersIndex({ orders, currentUserId, userRole, productPhotos = [] }: Props) {
    const isDesign = userRole === 'design';
    const canConfirm = userRole === 'admin' || userRole === 'office';

    const [activeFilter, setActiveFilter] = useState<'all' | 'mine'>('all');
    const [openOrders, setOpenOrders] = useState<number[]>([]);
    const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
    const [confirmStep, setConfirmStep] = useState<'factory' | 'design'>('factory');
    const [submitting, setSubmitting] = useState(false);
    const [designNote, setDesignNote] = useState('');
    const [skipPartyApproval, setSkipPartyApproval] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

    // Per-item design workflow modals (design role)
    const [printModal, setPrintModal] = useState<{ id: number; orderQty: number; current: number | null } | null>(null);
    const [printValue, setPrintValue] = useState('');
    const [labelsModal, setLabelsModal] = useState<{ id: number; maxQty: number; current: number | null } | null>(null);
    const [labelsValue, setLabelsValue] = useState('');
    const [trackSaving, setTrackSaving] = useState(false);

    const photoMap = useMemo(() => buildPhotoMap(productPhotos), [productPhotos]);

    const visibleOrders = useMemo(() => {
        if (activeFilter === 'all') return orders;
        return orders.filter(
            (o) => o.created_by === currentUserId || o.sales_user_id === currentUserId,
        );
    }, [activeFilter, orders, currentUserId]);

    const toggleOrder = (id: number) =>
        setOpenOrders((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

    const openConfirm = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmStep('factory');
        setConfirmTarget({ id: order.id, number: order.order_number, companyName: order.company_name });
    };

    const closeConfirm = () => {
        if (submitting) return;
        setConfirmTarget(null);
        setConfirmStep('factory');
    };

    const advanceToDesign = () => {
        const order = orders.find((o) => o.id === confirmTarget?.id);
        setSelectedItemIds((order?.items ?? []).map((i) => i.id));
        setDesignNote('');
        setSkipPartyApproval(false);
        setSubmitting(false);
        setConfirmStep('design');
    };

    const doConfirmFactory = () => {
        if (!confirmTarget) return;
        setSubmitting(true);
        router.post(ordersConfirm(confirmTarget.id).url, {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: advanceToDesign,
            onError: () => setSubmitting(false),
        });
    };

    const toggleItem = (id: number) =>
        setSelectedItemIds((cur) =>
            cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        );

    const doSendToDesign = () => {
        if (!confirmTarget) return;
        setSubmitting(true);
        router.post(ordersSendToDesign(confirmTarget.id).url, {
            note: designNote,
            skip_party_approval: skipPartyApproval,
            item_ids: selectedItemIds,
        }, {
            preserveScroll: true,
            onFinish: () => { setSubmitting(false); setConfirmTarget(null); setConfirmStep('factory'); },
        });
    };

    // ── Per-item design workflow ──
    const advanceDesign = (designId: number) =>
        router.post(designAdvance(designId).url, {}, { preserveScroll: true });

    const openPrintModal = (di: DesignItem) => {
        const orderQty = di.order_qty ?? 0;
        const remaining = orderQty - (di.pcs_to_print ?? 0);
        setPrintModal({ id: di.id, orderQty, current: di.pcs_to_print });
        setPrintValue(String(remaining > 0 ? remaining : 0));
    };
    const submitPrint = () => {
        if (!printModal) return;
        const val = parseInt(printValue, 10);
        const remaining = printModal.orderQty - (printModal.current ?? 0);
        if (isNaN(val) || val <= 0 || val > remaining) return;
        setTrackSaving(true);
        router.patch(designTracking(printModal.id).url, {
            pcs_to_print: (printModal.current ?? 0) + val,
        }, {
            preserveScroll: true,
            onFinish: () => { setTrackSaving(false); setPrintModal(null); },
        });
    };

    const openLabelsModal = (di: DesignItem) => {
        const maxQty = di.pcs_to_print ?? (di.order_qty ?? 0);
        setLabelsModal({ id: di.id, maxQty, current: di.labels_received });
        setLabelsValue(String(di.labels_received ?? 0));
    };
    const submitLabels = () => {
        if (!labelsModal) return;
        const val = parseInt(labelsValue, 10);
        if (isNaN(val) || val < 0 || val > labelsModal.maxQty) return;
        setTrackSaving(true);
        router.patch(designTracking(labelsModal.id).url, {
            labels_received: val,
        }, {
            preserveScroll: true,
            onFinish: () => { setTrackSaving(false); setLabelsModal(null); },
        });
    };

    const designItemFor = (order: Order, itemId: number): DesignItem | undefined =>
        order.design_items?.find((d) => d.order_item_id === itemId);

    return (
        <>
            <Head title="All Orders" />

            {/* ── Confirm modal: Step 1 Factory, Step 2 Design ────────── */}
            {confirmTarget && (() => {
                const targetOrder = orders.find((o) => o.id === confirmTarget.id);
                return (
                    <div className="modal-overlay open" onClick={closeConfirm}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: confirmStep === 'design' ? '520px' : '400px' }}>

                            {/* ── Step 1: Factory ── */}
                            {confirmStep === 'factory' && (
                                <>
                                    <div className="modal-header">
                                        <h2>🏭 Send to Factory</h2>
                                        <button className="modal-close" onClick={closeConfirm} disabled={submitting}>✕</button>
                                    </div>
                                    <div className="modal-form">
                                        <p style={{ color: 'var(--tx-muted)', fontSize: '12px', marginBottom: '6px' }}>Step 1 of 2</p>
                                        <p style={{ color: 'var(--tx-muted)', marginBottom: '20px', fontSize: '14px' }}>
                                            Confirm and send order <strong>{confirmTarget.number}</strong> to the
                                            <strong> Factory</strong> to start production?
                                        </p>
                                        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn-secondary" onClick={closeConfirm} disabled={submitting}>
                                                Cancel
                                            </button>
                                            <button type="button" className="btn-primary" onClick={doConfirmFactory} disabled={submitting}>
                                                {submitting ? 'Sending…' : '✓ Send to Factory →'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ── Step 2: Design ── */}
                            {confirmStep === 'design' && (
                                <>
                                    <div className="modal-header">
                                        <h2>🎨 Send to Design Team</h2>
                                        <button className="modal-close" onClick={closeConfirm} disabled={submitting}>✕</button>
                                    </div>
                                    <div className="modal-form">
                                        <p style={{ color: 'var(--tx-muted)', fontSize: '12px', marginBottom: '10px' }}>Step 2 of 2</p>

                                        {/* Order summary chip */}
                                        <div style={{ background: 'var(--accent-soft, #ede9fe)', color: 'var(--accent, #7c3aed)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontWeight: 500, marginBottom: '18px' }}>
                                            {confirmTarget.number} · {confirmTarget.companyName} · {targetOrder?.items.length ?? 0} product(s)
                                        </div>

                                        {/* Note */}
                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>
                                                Note for Design Team
                                            </label>
                                            <textarea
                                                value={designNote}
                                                onChange={(e) => setDesignNote(e.target.value)}
                                                placeholder="Any special design instructions…"
                                                rows={3}
                                                style={{ width: '100%', resize: 'vertical', marginTop: '6px' }}
                                                disabled={submitting}
                                            />
                                        </div>

                                        {/* Products with checkboxes */}
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                                Products
                                            </label>
                                            <table className="prod-table" style={{ fontSize: '13px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '32px' }}></th>
                                                        <th>#</th>
                                                        <th>Our Brand</th>
                                                        <th>Party Brand</th>
                                                        <th>Packing</th>
                                                        <th>Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(targetOrder?.items ?? []).map((item, idx) => (
                                                        <tr key={item.id} style={{ opacity: selectedItemIds.includes(item.id) ? 1 : 0.4 }}>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedItemIds.includes(item.id)}
                                                                    onChange={() => toggleItem(item.id)}
                                                                    disabled={submitting}
                                                                />
                                                            </td>
                                                            <td>{idx + 1}</td>
                                                            <td style={{ fontWeight: 600 }}>{item.our_brand ?? '—'}</td>
                                                            <td>{item.party_brand ?? '—'}</td>
                                                            <td>{item.packing_size ?? '—'}</td>
                                                            <td>{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Skip party approval */}
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--bg-yellow, #fefce8)', border: '1px solid var(--border-yellow, #fde68a)', borderRadius: '8px', padding: '12px', cursor: 'pointer', marginBottom: '20px', fontSize: '13px' }}>
                                            <input
                                                type="checkbox"
                                                checked={skipPartyApproval}
                                                onChange={(e) => setSkipPartyApproval(e.target.checked)}
                                                disabled={submitting}
                                                style={{ marginTop: '2px', flexShrink: 0 }}
                                            />
                                            <span>
                                                <strong>⚡ Skip Party Approval</strong>
                                                {' — '}Moves directly to Sent to Print once Design Ready
                                            </span>
                                        </label>

                                        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn-secondary" onClick={closeConfirm} disabled={submitting}>
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-primary"
                                                onClick={doSendToDesign}
                                                disabled={submitting || selectedItemIds.length === 0}
                                            >
                                                {submitting ? 'Sending…' : '🎨 Send to Design Team'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── Send to Print modal (design role) ──────────────────── */}
            {printModal && (
                <div className="modal-overlay open" onClick={() => !trackSaving && setPrintModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>🖨️ Send to Print</h2>
                            <button className="modal-close" onClick={() => setPrintModal(null)} disabled={trackSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Total Order Qty</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-head)' }}>{printModal.orderQty}</div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Already Sent</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-muted)' }}>{printModal.current ?? 0}</div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Remaining</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: '#059669' }}>{printModal.orderQty - (printModal.current ?? 0)}</div>
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
                                    disabled={trackSaving}
                                />
                                {parseInt(printValue, 10) > printModal.orderQty - (printModal.current ?? 0) && (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>
                                        Cannot exceed remaining quantity ({printModal.orderQty - (printModal.current ?? 0)})
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setPrintModal(null)} disabled={trackSaving}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={submitPrint}
                                    disabled={
                                        trackSaving ||
                                        !printValue ||
                                        parseInt(printValue, 10) <= 0 ||
                                        parseInt(printValue, 10) > printModal.orderQty - (printModal.current ?? 0)
                                    }
                                >
                                    {trackSaving ? 'Saving…' : '🖨️ Send to Print'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Labels Received modal (design role) ────────────────── */}
            {labelsModal && (
                <div className="modal-overlay open" onClick={() => !trackSaving && setLabelsModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
                        <div className="modal-header">
                            <h2>🏷️ Labels Received</h2>
                            <button className="modal-close" onClick={() => setLabelsModal(null)} disabled={trackSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Printed / Expected</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-head)' }}>{labelsModal.maxQty}</div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Pending</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: '#dc2626' }}>{labelsModal.maxQty - (labelsModal.current ?? 0)}</div>
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
                                    disabled={trackSaving}
                                />
                                {parseInt(labelsValue, 10) > labelsModal.maxQty && (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>
                                        Cannot exceed pieces to print ({labelsModal.maxQty})
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setLabelsModal(null)} disabled={trackSaving}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={submitLabels}
                                    disabled={
                                        trackSaving ||
                                        labelsValue === '' ||
                                        parseInt(labelsValue, 10) < 0 ||
                                        parseInt(labelsValue, 10) > labelsModal.maxQty
                                    }
                                >
                                    {trackSaving ? 'Saving…' : '✓ Update Labels'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div id="view-orders" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>{isDesign ? 'Design Orders' : 'All Orders'}</h1>
                        <p>
                            {isDesign
                                ? 'Orders assigned to the design team.'
                                : 'Track order status, production progress, and dispatch.'}
                        </p>
                    </div>
                    {canConfirm && (
                        <Link className="btn primary" href={ordersCreate()}>
                            ＋ New Order
                        </Link>
                    )}
                </div>

                {!isDesign && (
                    <div className="filter-bar">
                        <h2>Orders</h2>
                        <button
                            type="button"
                            className={`pill ${activeFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('all')}
                        >
                            All Orders
                        </button>
                        <button
                            type="button"
                            className={`pill ${activeFilter === 'mine' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('mine')}
                        >
                            My Orders
                        </button>
                    </div>
                )}

                {visibleOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>{isDesign ? 'No design orders yet.' : 'No orders yet.'}</p>
                    </div>
                ) : (
                    visibleOrders.map((order) => {
                        const isOpen = openOrders.includes(order.id);
                        const totalItems = order.items.length;
                        const dispatchedItems = order.items.filter((i) => i.status === 'dispatched').length;
                        const progress = totalItems ? Math.round((dispatchedItems / totalItems) * 100) : 0;

                        return (
                            <div key={order.id} className={`order-card${isOpen ? ' open' : ''}`}>
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleOrder(order.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && toggleOrder(order.id)}
                                >
                                    <div className="o-id">{order.order_number}</div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{order.company_name}</div>
                                        <div className="o-customer">{order.customer_name}</div>
                                    </div>
                                    <div className="o-meta">
                                        <div>{formatDate(order.order_date)}</div>
                                        <div>{order.sales_user?.name ?? 'Unassigned'}</div>
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    <div className="assignee-row">
                                        <label>Priority</label>
                                        <span className={priorityClassName(order.priority)}>
                                            {(order.priority ?? 'normal').toUpperCase()}
                                        </span>
                                        <label>Status</label>
                                        <span className={statusClassName(order.status)}>
                                            {statusLabel(order.status)}
                                        </span>

                                        {/* Confirm button — office/admin only, submitted orders only */}
                                        {canConfirm && order.status === 'submitted' && (
                                            <div className="confirm-btn">
                                                {order.priority === 'urgent' && order.urgent_approved !== true ? (
                                                    <span
                                                        className={`badge ${order.urgent_approved === false ? 'red' : 'orange'}`}
                                                        style={{ fontSize: '11px' }}
                                                        title={order.urgent_approved === false
                                                            ? 'Rejected by factory — please review'
                                                            : 'Waiting for factory approval'}
                                                    >
                                                        {order.urgent_approved === false ? '✕ Factory Rejected' : '⏳ Awaiting Factory'}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn sm primary"
                                                        onClick={(e) => openConfirm(order, e)}
                                                    >
                                                        ✓ Confirm Order
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {order.status === 'confirmed' && (
                                            <div className="confirm-btn">
                                                <span className="badge teal" style={{ fontSize: '11px' }}>
                                                    ✓ Sent to Factory
                                                </span>
                                            </div>
                                        )}
                                        {order.status === 'design' && (
                                            <div className="confirm-btn">
                                                <span className="badge purple" style={{ fontSize: '11px' }}>
                                                    🎨 Design Team
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Activity attribution — who did what */}
                                    {(order.created_by_name || order.confirmed_by_name || (order.design_handlers?.length ?? 0) > 0) && (
                                        <div className="activity-row">
                                            {order.created_by_name && (
                                                <span className="activity-chip">
                                                    📝 Created by <strong>{order.created_by_name}</strong>
                                                </span>
                                            )}
                                            {order.confirmed_by_name && (
                                                <span className="activity-chip">
                                                    ✓ Confirmed by <strong>{order.confirmed_by_name}</strong>
                                                    {order.confirmed_at ? ` · ${formatDate((order.confirmed_at ?? '').slice(0, 10))}` : ''}
                                                </span>
                                            )}
                                            {(order.design_handlers?.length ?? 0) > 0 && (
                                                <span className="activity-chip">
                                                    🎨 Design by <strong>{order.design_handlers!.join(', ')}</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Non-design: financial items table + summary ── */}
                                    {!isDesign && (
                                        <>
                                            <div className="prod-wrap">
                                                <table className="prod-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '52px' }}></th>
                                                            <th>Product</th>
                                                            <th>Packing</th>
                                                            <th>Qty</th>
                                                            <th>Rate</th>
                                                            <th>GST %</th>
                                                            <th>Amount</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {order.items.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={8} style={{ textAlign: 'center', padding: '16px' }}>
                                                                    No items yet.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            order.items.map((item) => {
                                                                const photo = getItemPhoto(item, order.party_id, photoMap);
                                                                return (
                                                                    <tr key={item.id}>
                                                                        <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                                                                            {photo ? (
                                                                                <img src={photo} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '2px', display: 'block' }} />
                                                                            ) : (
                                                                                <div style={{ width: '40px', height: '40px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--tx-muted)' }}>
                                                                                    📷
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                            <div className="prod-detail">{item.party_brand ?? '—'}</div>
                                                                        </td>
                                                                        <td>{item.packing_size ?? '—'}</td>
                                                                        <td>{item.quantity}</td>
                                                                        <td>{formatAmount(item.rate)}</td>
                                                                        <td>{item.gst_percent}</td>
                                                                        <td>{formatAmount(item.amount)}</td>
                                                                        <td>
                                                                            <span className={`badge s-${item.status ?? 'pending'}`}>
                                                                                {(item.status ?? 'pending').toUpperCase()}
                                                                            </span>
                                                                            {lastStageActor(item) && (
                                                                                <div className="prod-detail" style={{ marginTop: '2px' }}>
                                                                                    by {lastStageActor(item)}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="form-card" style={{ marginBottom: 0 }}>
                                                <div className="form-card-title">Order Summary</div>
                                                <div className="form-grid three">
                                                    <div className="form-group">
                                                        <label>Subtotal</label>
                                                        <div>{formatAmount(order.subtotal)}</div>
                                                    </div>
                                                    <div className="form-group">
                                                        <label>GST</label>
                                                        <div>{formatAmount(order.gst_total)}</div>
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Total</label>
                                                        <div>{formatAmount(order.total_amount)}</div>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: '14px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                        <span>Production Progress</span>
                                                        <span>{progress}%</span>
                                                    </div>
                                                    <div className="progress-bar">
                                                        <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* ── Design: per-item workflow (accept gate, print, labels, stages) ── */}
                                    {isDesign && (
                                        <div className="design-items-wrap">
                                            {order.items
                                                .map((item) => ({ item, di: designItemFor(order, item.id) }))
                                                .filter(({ di }) => di)
                                                .map(({ item, di }) => {
                                                    const d = di!;
                                                    const isUnlocked = d.status !== 'pending';
                                                    const orderQty = d.order_qty ?? Number(item.quantity) ?? 0;
                                                    const pcsPending = orderQty - (d.pcs_to_print ?? 0);
                                                    const labelMax = d.pcs_to_print ?? orderQty;
                                                    const labelPending = labelMax - (d.labels_received ?? 0);
                                                    const stages = designStagesFor(d.skip_party_approval);
                                                    const curIdx = stages.findIndex((s) => s.key === d.status);
                                                    const isDone = d.status === 'received-factory';
                                                    const photo = getItemPhoto(item, order.party_id, photoMap);

                                                    return (
                                                        <div key={d.id} className="design-item-block">
                                                            <div className="design-item-top">
                                                                {photo ? (
                                                                    <img src={photo} alt="" className="design-item-photo" />
                                                                ) : (
                                                                    <div className="design-item-photo placeholder">📷</div>
                                                                )}
                                                                <div className="design-item-info">
                                                                    <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                    <div className="prod-detail">{item.party_brand ?? '—'} · {item.packing_size ?? '—'}</div>
                                                                </div>
                                                                <div className="design-track">
                                                                    <div className="track-box">
                                                                        <span className="track-label">Order Qty</span>
                                                                        <span className="track-num">{orderQty || '—'}</span>
                                                                    </div>
                                                                    <div className="track-box">
                                                                        <span className="track-label" style={{ color: isUnlocked ? '#059669' : undefined }}>Pcs to Print</span>
                                                                        {isUnlocked ? (
                                                                            <button className="track-btn" onClick={() => openPrintModal(d)}>
                                                                                <span className="track-num green">{d.pcs_to_print ?? '—'}</span>
                                                                                <span className="track-sub">{pcsPending > 0 ? `${pcsPending} pending` : (d.pcs_to_print !== null ? '✓ done' : 'set')}</span>
                                                                            </button>
                                                                        ) : (
                                                                            <span className="track-locked">🔒 locked</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="track-box">
                                                                        <span className="track-label" style={{ color: isUnlocked ? '#dc2626' : undefined }}>Labels Recv'd</span>
                                                                        {isUnlocked ? (
                                                                            <button className="track-btn" onClick={() => openLabelsModal(d)}>
                                                                                <span className="track-num red">{d.labels_received ?? '—'}</span>
                                                                                <span className="track-sub">{labelPending > 0 ? `${labelPending} pending` : (d.labels_received !== null ? '✓ all' : 'set')}</span>
                                                                            </button>
                                                                        ) : (
                                                                            <span className="track-locked">🔒 locked</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="design-stage-progress">
                                                                <div className="design-stage-title">Design Stage Progress</div>
                                                                {stages.map((s, i) => {
                                                                    const isPast = i < curIdx;
                                                                    const isCurrent = i === curIdx;
                                                                    const isFuture = i > curIdx;
                                                                    return (
                                                                        <div key={s.key} className={`design-stage-row${isCurrent ? ' current' : ''}${isPast ? ' past' : ''}${isFuture ? ' future' : ''}`}>
                                                                            <span className="stage-dot">{isPast ? '✓' : isCurrent ? '●' : '○'}</span>
                                                                            <span className="stage-row-label">{s.label}</span>
                                                                            {isCurrent && !isDone && (
                                                                                <button className={`btn sm${s.key === 'pending' ? ' primary' : ' teal'}`} onClick={() => advanceDesign(d.id)}>
                                                                                    {s.advanceLabel}
                                                                                </button>
                                                                            )}
                                                                            {(isFuture || (isCurrent && isDone)) && <span className="stage-row-dash">—</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            {order.items.every((item) => !designItemFor(order, item.id)) && (
                                                <div className="empty-row" style={{ padding: '16px', textAlign: 'center', color: 'var(--tx-muted)' }}>
                                                    No design items on this order yet.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}
