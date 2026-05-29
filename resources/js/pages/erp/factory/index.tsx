import { advance as itemAdvance, revert as itemRevert } from '@/routes/factory/items';
import { approveUrgent as ordersApproveUrgent, rejectUrgent as ordersRejectUrgent } from '@/routes/orders';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

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
    quantity: string | number;
    rate: string | number;
    amount: string | number;
    type?: string | null;
    shape?: string | null;
    cap_color?: string | null;
    status: string;
    stage_log?: StageLogEntry[] | null;
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
    notes?: string | null;
    sales_user?: { id: number; name: string } | null;
    created_by_user?: { id: number; name: string } | null;
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
    stageFlow: Record<string, string>;
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

const STAGE_NEXT_LABEL: Record<string, string> = {
    pending: '▶ Start Processing',
    processing: '▶ Move to Filling',
    filling: '▶ Move to Labeling',
    labeling: '▶ Mark Ready',
    ready: '✓ Dispatch',
};

const STAGE_CLASS: Record<string, string> = {
    pending: 's-pending',
    processing: 's-processing',
    filling: 's-filling',
    labeling: 's-labeling',
    ready: 's-ready',
    dispatched: 's-dispatched',
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const priorityClass = (priority?: string | null) => `badge priority-${priority ?? 'normal'}`;

export default function FactoryIndex({ orders, stageFlow, urgentPending, canAdvance }: Props) {
    const [openOrders, setOpenOrders] = useState<number[]>([]);
    const [advancing, setAdvancing] = useState<number | null>(null);
    const [reverting, setReverting] = useState<number | null>(null);
    const [logItemId, setLogItemId] = useState<number | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    const toggleOrder = (orderId: number) => {
        setOpenOrders((curr) =>
            curr.includes(orderId) ? curr.filter((id) => id !== orderId) : [...curr, orderId],
        );
    };

    const advanceStage = (itemId: number) => {
        setAdvancing(itemId);
        router.post(
            itemAdvance(itemId).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setAdvancing(null),
            },
        );
    };

    const revertStage = (itemId: number) => {
        if (!confirm('Revert this item to the previous stage?')) return;
        setReverting(itemId);
        router.post(
            itemRevert(itemId).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setReverting(null),
            },
        );
    };

    const approveUrgent = (orderId: number) => {
        setApprovingId(orderId);
        router.post(
            ordersApproveUrgent(orderId).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setApprovingId(null),
            },
        );
    };

    const rejectUrgent = (orderId: number) => {
        if (!confirm('Reject this urgent order? The office will need to address it.')) return;
        setRejectingId(orderId);
        router.post(
            ordersRejectUrgent(orderId).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setRejectingId(null),
            },
        );
    };

    const logItem = orders
        .flatMap((o) => o.items)
        .find((i) => i.id === logItemId);

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

                {/* ── Urgent Approval Requests (factory/admin only) ── */}
                {canAdvance && urgentPending.length > 0 && (
                    <div className="card" style={{ marginBottom: '20px', border: '2px solid #ef4444' }}>
                        <div className="card-title" style={{ color: '#ef4444' }}>
                            🚨 Urgent Approval Requests
                            <span className="ct-badge" style={{ background: '#ef4444', color: '#fff' }}>{urgentPending.length} pending</span>
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
                                    {order.order_date && (
                                        <div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>{formatDate(order.order_date)}</div>
                                    )}
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

                {orders.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🏭</div>
                        <p>No confirmed orders in production. Orders must be confirmed by office/admin first.</p>
                    </div>
                ) : (
                    orders.map((order) => {
                        const isOpen = openOrders.includes(order.id);
                        const totalItems = order.items.length;
                        const doneItems = order.items.filter((i) => i.status === 'dispatched').length;
                        const progress = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

                        return (
                            <div
                                key={order.id}
                                className={`order-card${isOpen ? ' open' : ''}`}
                            >
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleOrder(order.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') toggleOrder(order.id);
                                    }}
                                >
                                    <div className="o-id">{order.order_number}</div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{order.company_name}</div>
                                        <div className="o-customer">{order.customer_name}</div>
                                    </div>
                                    <div className="o-meta">
                                        <div>{formatDate(order.order_date)}</div>
                                        <span className={priorityClass(order.priority)}>
                                            {(order.priority ?? 'normal').toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: '12px',
                                            flexWrap: 'wrap',
                                            marginBottom: '12px',
                                            fontSize: '13px',
                                            color: 'var(--tx-muted)',
                                        }}
                                    >
                                        {order.destination && (
                                            <span>📍 {order.destination}</span>
                                        )}
                                        {order.transport_name && (
                                            <span>🚚 {order.transport_name}</span>
                                        )}
                                        {order.sales_user && (
                                            <span>👤 {order.sales_user.name}</span>
                                        )}
                                    </div>

                                    <div style={{ marginBottom: '14px' }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '12px',
                                                marginBottom: '5px',
                                                color: 'var(--tx-muted)',
                                            }}
                                        >
                                            <span>Production Progress</span>
                                            <span>{doneItems}/{totalItems} dispatched ({progress}%)</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${progress}%`,
                                                    background: 'var(--accent)',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: '6px',
                                            flexWrap: 'wrap',
                                            marginBottom: '14px',
                                        }}
                                    >
                                        {STAGE_ORDER.map((stage) => {
                                            const count = order.items.filter((i) => i.status === stage).length;
                                            return (
                                                <span
                                                    key={stage}
                                                    style={{
                                                        fontSize: '11px',
                                                        padding: '3px 9px',
                                                        borderRadius: '20px',
                                                        background: count > 0 ? 'var(--accent)' : 'var(--bg-paper)',
                                                        color: count > 0 ? '#fff' : 'var(--tx-faint)',
                                                        border: '1px solid var(--border)',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {STAGE_LABELS[stage]}: {count}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    <div className="prod-wrap">
                                        <table className="prod-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Packing</th>
                                                    <th>Qty</th>
                                                    <th>Type / Shape</th>
                                                    <th>Stage</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item) => {
                                                    const nextStage = stageFlow[item.status];
                                                    const isDispatched = item.status === 'dispatched';
                                                    const isPending = item.status === 'pending';

                                                    return (
                                                        <tr key={item.id}>
                                                            <td>
                                                                <div className="prod-name">
                                                                    {item.our_brand ?? '—'}
                                                                </div>
                                                                {item.party_brand && (
                                                                    <div className="prod-detail">
                                                                        {item.party_brand}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>{item.packing_size ?? '—'}</td>
                                                            <td>{item.quantity}</td>
                                                            <td>
                                                                <div>{item.type ?? '—'}</div>
                                                                {item.shape && (
                                                                    <div className="prod-detail">
                                                                        {item.shape}
                                                                        {item.cap_color
                                                                            ? ` · ${item.cap_color}`
                                                                            : ''}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={`badge ${STAGE_CLASS[item.status] ?? 'gray'}`}
                                                                >
                                                                    {STAGE_LABELS[item.status] ?? item.status}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: '5px',
                                                                        flexWrap: 'wrap',
                                                                    }}
                                                                >
                                                                    {canAdvance && !isDispatched && nextStage && (
                                                                        <button
                                                                            type="button"
                                                                            className={`btn sm${nextStage === 'dispatched' ? ' primary' : ''}`}
                                                                            onClick={() => advanceStage(item.id)}
                                                                            disabled={advancing === item.id}
                                                                        >
                                                                            {advancing === item.id
                                                                                ? '…'
                                                                                : (STAGE_NEXT_LABEL[item.status] ?? '▶ Next')}
                                                                        </button>
                                                                    )}
                                                                    {canAdvance && !isPending && !isDispatched && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn danger-xs"
                                                                            onClick={() => revertStage(item.id)}
                                                                            disabled={reverting === item.id}
                                                                            title="Revert to previous stage"
                                                                        >
                                                                            {reverting === item.id ? '…' : '↩'}
                                                                        </button>
                                                                    )}
                                                                    {item.stage_log && item.stage_log.length > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn sm"
                                                                            onClick={() =>
                                                                                setLogItemId(
                                                                                    logItemId === item.id
                                                                                        ? null
                                                                                        : item.id,
                                                                                )
                                                                            }
                                                                            title="View history"
                                                                        >
                                                                            📋
                                                                        </button>
                                                                    )}
                                                                    {isDispatched && (
                                                                        <span
                                                                            style={{
                                                                                fontSize: '12px',
                                                                                color: 'var(--tx-faint)',
                                                                            }}
                                                                        >
                                                                            Completed
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {logItemId !== null &&
                                        order.items.some((i) => i.id === logItemId) && (
                                            <div
                                                style={{
                                                    marginTop: '12px',
                                                    padding: '12px 14px',
                                                    background: 'var(--bg-paper)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '12px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        marginBottom: '8px',
                                                        color: 'var(--tx-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '11px',
                                                        letterSpacing: '.5px',
                                                    }}
                                                >
                                                    Stage History
                                                </div>
                                                {(logItem?.stage_log ?? []).map((entry, idx) => (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            display: 'flex',
                                                            gap: '8px',
                                                            alignItems: 'center',
                                                            padding: '4px 0',
                                                            borderBottom: '1px solid var(--border)',
                                                        }}
                                                    >
                                                        <span style={{ color: 'var(--tx-faint)', minWidth: '80px' }}>
                                                            {new Date(entry.at).toLocaleString('en-IN', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                        <span>
                                                            {entry.revert ? '↩' : '→'}{' '}
                                                            <b>{STAGE_LABELS[entry.from] ?? entry.from}</b>{' '}
                                                            → <b>{STAGE_LABELS[entry.to] ?? entry.to}</b>
                                                        </span>
                                                        {entry.name && (
                                                            <span style={{ color: 'var(--tx-muted)', marginLeft: 'auto' }}>
                                                                by {entry.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
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
