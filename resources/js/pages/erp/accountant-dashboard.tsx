import { index as inventoryIndex } from '@/routes/inventory';
import { index as ordersIndex } from '@/routes/orders';
import { Head, Link } from '@inertiajs/react';

type OrderRow = {
    id: number;
    order_number: string;
    company_name: string;
    total_amount: number;
    order_date: string | null;
    status: string;
    priority: string;
    has_tax_invoice: boolean;
    has_eway: boolean;
    eway_ok: boolean;
    billing_done: boolean;
    sales_user: string | null;
};

type MissingProduct = {
    id: number;
    name: string;
    category: string | null;
    hsn: string | null;
    gst: string | number | null;
};

type Stats = {
    pendingInvoiceCount: number;
    pendingEwayCount: number;
    thisMonthValue: number;
    thisMonthCount: number;
    missingHsnGstCount: number;
    totalStockValue: number;
};

type Props = {
    pendingInvoice: OrderRow[];
    pendingEway: OrderRow[];
    billingDone: OrderRow[];
    missingHsnGst: MissingProduct[];
    stats: Stats;
};

const fmtAmt = (v: number) =>
    '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const priorityBadge = (p: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        urgent: { bg: '#fee2e2', color: '#b91c1c', label: 'Urgent' },
        high:   { bg: '#fef3c7', color: '#b45309', label: 'High' },
        normal: { bg: '#f3f4f6', color: '#6b7280', label: 'Normal' },
    };
    const s = map[p] ?? map.normal;
    return (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color }}>
            {s.label}
        </span>
    );
};

const OrderCard = ({ order, badge }: { order: OrderRow; badge?: React.ReactNode }) => (
    <Link
        href={ordersIndex().url}
        style={{
            display: 'block', textDecoration: 'none',
            padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--border-color, #e5e7eb)',
            background: 'var(--bg-paper, #fff)',
            transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)')}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary, #111)' }}>#{order.order_number}</span>
                    {priorityBadge(order.priority)}
                    {badge}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary, #374151)', marginTop: 2, fontWeight: 500 }}>{order.company_name}</div>
                {order.sales_user && <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', marginTop: 1 }}>Sales: {order.sales_user}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>{fmtAmt(order.total_amount)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', marginTop: 1 }}>{order.order_date ?? '—'}</div>
            </div>
        </div>
    </Link>
);

const SectionHeader = ({ icon, title, count, color }: { icon: string; title: string; count: number; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 700, background: color + '22', color, borderRadius: 12, padding: '1px 8px' }}>{count}</span>
    </div>
);

export default function AccountantDashboard({ pendingInvoice, pendingEway, billingDone, missingHsnGst, stats }: Props) {
    return (
        <>
            <Head title="Dashboard" />

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div className="stat-icon" style={{ background: '#fee2e2' }}>📄</div>
                    <div>
                        <div className="stat-val" style={{ color: stats.pendingInvoiceCount > 0 ? '#b91c1c' : undefined }}>
                            {stats.pendingInvoiceCount}
                        </div>
                        <div className="stat-label">Invoice Pending</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div className="stat-icon" style={{ background: '#fef3c7' }}>🚚</div>
                    <div>
                        <div className="stat-val" style={{ color: stats.pendingEwayCount > 0 ? '#b45309' : undefined }}>
                            {stats.pendingEwayCount}
                        </div>
                        <div className="stat-label">E-way Pending</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
                    <div className="stat-icon" style={{ background: '#d1fae5' }}>📊</div>
                    <div>
                        <div className="stat-val" style={{ fontSize: 18 }}>{fmtAmt(stats.thisMonthValue)}</div>
                        <div className="stat-label">This Month ({stats.thisMonthCount} orders)</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
                    <div className="stat-icon" style={{ background: '#ede9fe' }}>🌿</div>
                    <div>
                        <div className="stat-val" style={{ color: stats.missingHsnGstCount > 0 ? '#4f46e5' : undefined }}>
                            {stats.missingHsnGstCount}
                        </div>
                        <div className="stat-label">Missing HSN / GST</div>
                    </div>
                </div>
            </div>

            {/* Main two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

                {/* Invoice Pending */}
                <div className="card">
                    <SectionHeader icon="📄" title="Invoice Pending" count={pendingInvoice.length} color="#b91c1c" />
                    {pendingInvoice.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                            ✅ All invoices uploaded
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                            {pendingInvoice.map((o) => <OrderCard key={o.id} order={o} />)}
                        </div>
                    )}
                    {pendingInvoice.length > 0 && (
                        <div style={{ marginTop: 10, textAlign: 'right' }}>
                            <Link href={ordersIndex().url} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                                View all orders →
                            </Link>
                        </div>
                    )}
                </div>

                {/* E-way Pending */}
                <div className="card">
                    <SectionHeader icon="🚚" title="E-way Pending" count={pendingEway.length} color="#b45309" />
                    {pendingEway.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                            ✅ All e-way bills uploaded
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                            {pendingEway.map((o) => (
                                <OrderCard
                                    key={o.id}
                                    order={o}
                                    badge={
                                        <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                            🧾 Invoice ✓
                                        </span>
                                    }
                                />
                            ))}
                        </div>
                    )}
                    {pendingEway.length > 0 && (
                        <div style={{ marginTop: 10, textAlign: 'right' }}>
                            <Link href={ordersIndex().url} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                                View all orders →
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Recently Billed */}
                <div className="card">
                    <SectionHeader icon="✅" title="Recently Billed" count={billingDone.length} color="#16a34a" />
                    {billingDone.length === 0 ? (
                        <div className="empty-state">No completed billing yet.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {billingDone.map((o) => <OrderCard key={o.id} order={o} />)}
                        </div>
                    )}
                </div>

                {/* Missing HSN / GST */}
                <div className="card">
                    <SectionHeader icon="🌿" title="Missing HSN / GST" count={missingHsnGst.length} color="#4f46e5" />
                    {missingHsnGst.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                            ✅ All products have HSN & GST
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                                {missingHsnGst.map((p) => (
                                    <div key={p.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '7px 10px', borderRadius: 6,
                                        background: 'var(--bg-paper, #f9fafb)',
                                        border: '1px solid var(--border-color, #e5e7eb)',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #111)' }}>{p.name}</div>
                                            {p.category && <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>{p.category}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {!p.hsn && (
                                                <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>No HSN</span>
                                            )}
                                            {(p.gst == null || p.gst === '') && (
                                                <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>No GST</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 10, textAlign: 'right' }}>
                                <Link href={inventoryIndex().url} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                                    Edit in Inventory →
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
