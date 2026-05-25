import { Head, Link } from '@inertiajs/react';
import { create as ordersCreate, index as ordersIndex } from '@/routes/orders';

type PipelineItem = {
    id: number;
    order_id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    quantity: string | number;
    status: string;
    order?: {
        id: number;
        order_number: string;
        company_name: string;
        customer_name: string;
        priority?: string | null;
    } | null;
};

type RecentOrder = {
    id: number;
    order_number: string;
    company_name: string;
    customer_name: string;
    order_date?: string | null;
    total_amount?: string | number | null;
    status?: string | null;
    priority?: string | null;
    sales_user?: { id: number; name: string } | null;
    items: { id: number; status: string }[];
};

type Stats = {
    totalActiveOrders: number;
    itemsInProduction: number;
    readyToDispatch: number;
    dispatchedThisMonth: number;
};

type Props = {
    stats: Stats;
    pipeline: Record<string, PipelineItem[]>;
    recentOrders: RecentOrder[];
};

const STAGE_ORDER = ['pending', 'processing', 'filling', 'labeling', 'ready'];

const STAGE_LABELS: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    filling: 'Filling',
    labeling: 'Labeling',
    ready: 'Ready',
};

const STAGE_ICONS: Record<string, string> = {
    pending: '⏳',
    processing: '⚗️',
    filling: '🫙',
    labeling: '🏷️',
    ready: '✅',
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatAmount = (value?: string | number | null) => {
    const n = Number(value ?? 0);
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const orderStatusClass = (status?: string | null) => {
    switch (status) {
        case 'submitted': return 'badge sky';
        case 'confirmed': return 'badge teal';
        case 'dispatched': return 'badge gray';
        default: return 'badge amber';
    }
};

export default function Dashboard({ stats, pipeline, recentOrders }: Props) {
    const totalPipelineItems = STAGE_ORDER.reduce(
        (sum, stage) => sum + (pipeline[stage]?.length ?? 0),
        0,
    );

    return (
        <>
            <Head title="Dashboard" />
            <div id="view-dashboard" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Dashboard</h1>
                        <p>Live overview of agrochemical order production &amp; dispatch</p>
                    </div>
                    <Link className="btn primary" href={ordersCreate()}>
                        ＋ New Order
                    </Link>
                </div>

                <div className="stats-grid">
                    <div className="stat-card c-green">
                        <div className="stat-icon si-green">📋</div>
                        <div className="stat-val">{stats.totalActiveOrders}</div>
                        <div className="stat-label">Active Orders</div>
                        <div className="stat-sub up">In progress</div>
                    </div>
                    <div className="stat-card c-sky">
                        <div className="stat-icon si-sky">⚗️</div>
                        <div className="stat-val">{stats.itemsInProduction}</div>
                        <div className="stat-label">In Production</div>
                        <div className="stat-sub neu">Items being made</div>
                    </div>
                    <div className="stat-card c-amber">
                        <div className="stat-icon si-amber">✅</div>
                        <div className="stat-val">{stats.readyToDispatch}</div>
                        <div className="stat-label">Ready to Dispatch</div>
                        <div className="stat-sub up">Awaiting shipment</div>
                    </div>
                    <div className="stat-card c-slate">
                        <div className="stat-icon si-slate">🚚</div>
                        <div className="stat-val">{stats.dispatchedThisMonth}</div>
                        <div className="stat-label">Dispatched</div>
                        <div className="stat-sub neu">This month</div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-title">
                        🌾 Production Pipeline{' '}
                        <span className="ct-badge">{totalPipelineItems} items</span>
                    </div>

                    {totalPipelineItems === 0 ? (
                        <div className="empty-state">
                            <div className="icon">📋</div>
                            <p>No active production. Create and confirm an order to get started.</p>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '12px',
                                marginTop: '4px',
                            }}
                        >
                            {STAGE_ORDER.map((stage) => {
                                const items = pipeline[stage] ?? [];
                                return (
                                    <div
                                        key={stage}
                                        style={{
                                            background: 'var(--bg-paper)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius)',
                                            padding: '12px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                marginBottom: '10px',
                                            }}
                                        >
                                            <span>{STAGE_ICONS[stage]}</span>
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '.5px',
                                                    color: 'var(--tx-muted)',
                                                }}
                                            >
                                                {STAGE_LABELS[stage]}
                                            </span>
                                            <span
                                                style={{
                                                    marginLeft: 'auto',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    background: 'var(--accent)',
                                                    color: '#fff',
                                                    borderRadius: '20px',
                                                    padding: '1px 8px',
                                                    minWidth: '20px',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {items.length}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px',
                                            }}
                                        >
                                            {items.length === 0 ? (
                                                <div
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--tx-faint)',
                                                        textAlign: 'center',
                                                        padding: '8px 0',
                                                    }}
                                                >
                                                    Empty
                                                </div>
                                            ) : (
                                                items.slice(0, 5).map((item) => (
                                                    <div
                                                        key={item.id}
                                                        style={{
                                                            fontSize: '12px',
                                                            padding: '6px 8px',
                                                            background: 'var(--bg)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontWeight: 600,
                                                                marginBottom: '2px',
                                                            }}
                                                        >
                                                            {item.our_brand ?? item.party_brand ?? '—'}
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: 'var(--tx-muted)',
                                                                fontSize: '11px',
                                                            }}
                                                        >
                                                            {item.order?.order_number} · {item.packing_size ?? '—'}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            {items.length > 5 && (
                                                <div
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--tx-faint)',
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    +{items.length - 5} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-title">
                        📋 Recent Orders
                        <Link
                            href={ordersIndex()}
                            style={{
                                marginLeft: 'auto',
                                fontSize: '12px',
                                color: 'var(--accent)',
                                fontWeight: 600,
                            }}
                        >
                            View All →
                        </Link>
                    </div>

                    {recentOrders.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">📋</div>
                            <p>No orders yet.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Order #</th>
                                        <th>Company</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Items</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.map((order) => {
                                        const totalItems = order.items.length;
                                        const doneItems = order.items.filter(
                                            (i) => i.status === 'dispatched',
                                        ).length;
                                        return (
                                            <tr key={order.id}>
                                                <td>
                                                    <span
                                                        style={{
                                                            fontWeight: 700,
                                                            color: 'var(--accent)',
                                                        }}
                                                    >
                                                        {order.order_number}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="prod-name">
                                                        {order.company_name}
                                                    </div>
                                                    <div className="prod-detail">
                                                        {order.customer_name}
                                                    </div>
                                                </td>
                                                <td>{formatDate(order.order_date)}</td>
                                                <td>{formatAmount(order.total_amount)}</td>
                                                <td>
                                                    {doneItems}/{totalItems} done
                                                </td>
                                                <td>
                                                    <span className={orderStatusClass(order.status)}>
                                                        {(order.status ?? 'draft').toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
