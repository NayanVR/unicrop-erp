import { Head } from '@inertiajs/react';

type OrderItem = {
    id: number;
    order_id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    quantity: string | number;
    status: string;
    type?: string | null;
    shape?: string | null;
    cap_color?: string | null;
};

type Order = {
    id: number;
    order_number: string;
    company_name: string;
    customer_name: string;
    destination?: string | null;
    priority?: string | null;
    items: OrderItem[];
};

type Props = {
    orders: Order[];
};

const PRIORITY_COLOR: Record<string, { bg: string; color: string; border: string }> = {
    urgent: { bg: '#fef2f2', color: '#dc2626', border: '#dc2626' },
    high:   { bg: '#fff7ed', color: '#d97706', border: '#d97706' },
    normal: { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' },
};

export default function FillingIndex({ orders }: Props) {
    if (orders.length === 0) {
        return (
            <>
                <Head title="Filling" />
                <div id="view-filling" className="view active">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🧪 Filling</h1>
                            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--tx-sub)' }}>Orders currently in the filling stage</p>
                        </div>
                    </div>
                    <div className="empty-state">
                        <div className="icon">🧪</div>
                        <p>No orders are currently in the filling stage.</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Filling" />
            <div id="view-filling" className="view active">

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🧪 Filling</h1>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--tx-sub)' }}>Orders currently in the filling stage</p>
                    </div>
                    <span style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
                        {orders.length} order{orders.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                    {orders.map((order) => {
                        const pc   = PRIORITY_COLOR[order.priority ?? 'normal'] ?? PRIORITY_COLOR.normal;
                        const fillingItems = order.items.filter((i) => i.status === 'filling');

                        return (
                            <div
                                key={order.id}
                                style={{
                                    background: '#fff',
                                    border: '1px solid var(--border)',
                                    borderLeft: `4px solid ${pc.border}`,
                                    borderRadius: 10,
                                    padding: '16px 18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                }}
                            >
                                {/* Top row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{order.order_number}</div>
                                        <div style={{ fontSize: 13, color: 'var(--tx-sub)', marginTop: 2 }}>{order.company_name}</div>
                                    </div>
                                    {order.priority && order.priority !== 'normal' && (
                                        <span style={{ background: pc.bg, color: pc.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {order.priority.toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {order.destination && (
                                    <div style={{ fontSize: 12, color: 'var(--tx-muted)' }}>📍 {order.destination}</div>
                                )}

                                {/* Items in filling */}
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 2 }}>
                                        Items in Filling ({fillingItems.length})
                                    </div>
                                    {fillingItems.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 8,
                                                background: 'var(--bg-paper)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: '8px 12px',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                    {item.our_brand ?? '—'}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--tx-muted)' }}>
                                                    {[item.packing_size, item.type, item.shape].filter(Boolean).join(' · ')}
                                                </div>
                                                {item.party_brand && (
                                                    <div style={{ fontSize: 11, color: 'var(--tx-faint)', marginTop: 2 }}>
                                                        Party: {item.party_brand}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 15 }}>
                                                    {Number(item.quantity).toLocaleString('en-IN')}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>pcs</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
        </>
    );
}
