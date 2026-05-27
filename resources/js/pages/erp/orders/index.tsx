import { confirm as ordersConfirm, create as ordersCreate } from '@/routes/orders';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

function buildPhotoMap(photos: ProductPhoto[]) {
    const ob = new Map<string, string>(); // "our_brand|packing_size" → url
    const pb = new Map<string, string>(); // "party_id|party_brand|packing_size" → url
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
    items: OrderItem[];
};

type ProductPhoto = {
    id: number;
    party_id: number | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    photo_url: string;
};

type Props = {
    pageTitle: string;
    orders: Order[];
    currentUserId?: number | null;
    canViewAll?: boolean;
    productPhotos?: ProductPhoto[];
};

const formatDate = (value?: string | null) => {
    if (!value) {
        return '—';
    }

    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatAmount = (value?: string | number | null) => {
    const amount = Number(value ?? 0);

    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const statusClassName = (status?: string | null) => {
    if (!status) {
        return 'badge gray';
    }

    switch (status) {
        case 'submitted':
            return 'badge sky';
        case 'confirmed':
            return 'badge teal';
        case 'dispatched':
            return 'badge gray';
        case 'draft':
            return 'badge amber';
        default:
            return 'badge gray';
    }
};

const priorityClassName = (priority?: string | null) => {
    if (!priority) {
        return 'badge priority-normal';
    }

    return `badge priority-${priority}`;
};

export default function OrdersIndex({
    orders,
    currentUserId,
    canViewAll,
    productPhotos = [],
}: Props) {
    const [activeFilter, setActiveFilter] = useState<'all' | 'mine'>(
        canViewAll ? 'all' : 'mine',
    );
    const [openOrders, setOpenOrders] = useState<number[]>([]);
    const [confirming, setConfirming] = useState<number | null>(null);

    const photoMap = useMemo(() => buildPhotoMap(productPhotos), [productPhotos]);

    const confirmOrder = (orderId: number) => {
        setConfirming(orderId);
        router.post(
            ordersConfirm(orderId).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setConfirming(null),
            },
        );
    };

    const visibleOrders = useMemo(() => {
        if (activeFilter === 'all') {
            return orders;
        }

        return orders.filter(
            (order) =>
                order.created_by === currentUserId ||
                order.sales_user_id === currentUserId,
        );
    }, [activeFilter, orders, currentUserId]);

    const toggleOrder = (orderId: number) => {
        setOpenOrders((current) =>
            current.includes(orderId)
                ? current.filter((id) => id !== orderId)
                : [...current, orderId],
        );
    };

    return (
        <>
            <Head title="All Orders" />
            <div id="view-orders" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>All Orders</h1>
                        <p>
                            Track order status, production progress, and
                            dispatch.
                        </p>
                    </div>
                    <Link className="btn primary" href={ordersCreate()}>
                        ＋ New Order
                    </Link>
                </div>

                <div className="filter-bar">
                    <h2>Orders</h2>
                    {canViewAll ? (
                        <button
                            type="button"
                            className={`pill ${
                                activeFilter === 'all' ? 'active' : ''
                            }`}
                            onClick={() => setActiveFilter('all')}
                        >
                            All Orders
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={`pill ${
                            activeFilter === 'mine' ? 'active' : ''
                        }`}
                        onClick={() => setActiveFilter('mine')}
                    >
                        My Orders
                    </button>
                </div>

                {visibleOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>No orders yet.</p>
                    </div>
                ) : (
                    visibleOrders.map((order) => {
                        const isOpen = openOrders.includes(order.id);
                        const totalItems = order.items.length;
                        const dispatchedItems = order.items.filter(
                            (item) => item.status === 'dispatched',
                        ).length;
                        const progress = totalItems
                            ? Math.round((dispatchedItems / totalItems) * 100)
                            : 0;

                        return (
                            <div
                                key={order.id}
                                className={`order-card${isOpen ? 'open' : ''}`}
                            >
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleOrder(order.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            toggleOrder(order.id);
                                        }
                                    }}
                                >
                                    <div className="o-id">
                                        {order.order_number}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">
                                            {order.company_name}
                                        </div>
                                        <div className="o-customer">
                                            {order.customer_name}
                                        </div>
                                    </div>
                                    <div className="o-meta">
                                        <div>
                                            {formatDate(order.order_date)}
                                        </div>
                                        <div>
                                            {order.sales_user?.name ??
                                                'Unassigned'}
                                        </div>
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    <div className="assignee-row">
                                        <label>Priority</label>
                                        <span
                                            className={priorityClassName(
                                                order.priority,
                                            )}
                                        >
                                            {(order.priority ?? 'normal')
                                                .toString()
                                                .toUpperCase()}
                                        </span>
                                        <label>Status</label>
                                        <span
                                            className={statusClassName(
                                                order.status,
                                            )}
                                        >
                                            {(order.status ?? 'draft')
                                                .toString()
                                                .toUpperCase()}
                                        </span>
                                        {order.status === 'submitted' && (
                                            <div className="confirm-btn">
                                                {order.priority === 'urgent' && order.urgent_approved !== true ? (
                                                    <span
                                                        className={`badge ${order.urgent_approved === false ? 'red' : 'orange'}`}
                                                        style={{ fontSize: '11px' }}
                                                        title={order.urgent_approved === false ? 'Rejected by factory — please review' : 'Waiting for factory approval'}
                                                    >
                                                        {order.urgent_approved === false ? '✕ Factory Rejected' : '⏳ Awaiting Factory'}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn sm primary"
                                                        onClick={() => confirmOrder(order.id)}
                                                        disabled={confirming === order.id}
                                                    >
                                                        {confirming === order.id ? '…' : '✓ Confirm'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {order.status === 'confirmed' && (
                                            <div className="confirm-btn">
                                                <span className="badge teal" style={{ fontSize: '11px' }}>
                                                    ✓ Confirmed
                                                </span>
                                            </div>
                                        )}
                                    </div>

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
                                                        <td
                                                            colSpan={8}
                                                            style={{
                                                                textAlign:
                                                                    'center',
                                                                padding: '16px',
                                                            }}
                                                        >
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
                                                                    <img
                                                                        src={photo}
                                                                        alt=""
                                                                        style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '2px', display: 'block' }}
                                                                    />
                                                                ) : (
                                                                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--tx-muted)' }}>
                                                                        📷
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div className="prod-name">
                                                                    {item.our_brand ??
                                                                        '—'}
                                                                </div>
                                                                <div className="prod-detail">
                                                                    {item.party_brand ??
                                                                        '—'}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {item.packing_size ??
                                                                    '—'}
                                                            </td>
                                                            <td>
                                                                {item.quantity}
                                                            </td>
                                                            <td>
                                                                {formatAmount(
                                                                    item.rate,
                                                                )}
                                                            </td>
                                                            <td>
                                                                {
                                                                    item.gst_percent
                                                                }
                                                            </td>
                                                            <td>
                                                                {formatAmount(
                                                                    item.amount,
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={`badge s-${
                                                                        item.status ??
                                                                        'pending'
                                                                    }`}
                                                                >
                                                                    {(
                                                                        item.status ??
                                                                        'pending'
                                                                    )
                                                                        .toString()
                                                                        .toUpperCase()}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div
                                        className="form-card"
                                        style={{ marginBottom: 0 }}
                                    >
                                        <div className="form-card-title">
                                            Order Summary
                                        </div>
                                        <div className="form-grid three">
                                            <div className="form-group">
                                                <label>Subtotal</label>
                                                <div>
                                                    {formatAmount(
                                                        order.subtotal,
                                                    )}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>GST</label>
                                                <div>
                                                    {formatAmount(
                                                        order.gst_total,
                                                    )}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Total</label>
                                                <div>
                                                    {formatAmount(
                                                        order.total_amount,
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '14px' }}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    marginBottom: '6px',
                                                }}
                                            >
                                                <span>Production Progress</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill"
                                                    style={{
                                                        width: `${progress}%`,
                                                        background:
                                                            'var(--accent)',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}
