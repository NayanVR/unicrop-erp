import LowStockProductionCard, { type LowStockProduction } from '@/components/low-stock-production-card';
import { index as bomIndex } from '@/routes/bom';
import { index as factoryIndex } from '@/routes/factory';
import { index as inventoryIndex } from '@/routes/inventory';
import { index as unitTransferIndex } from '@/routes/unit-transfer';
import { Head, Link } from '@inertiajs/react';

type OrderItem = {
    id: number;
    our_brand: string | null;
    party_brand: string | null;
    packing_size: string | null;
    quantity: number;
    status: string;
};

type ActiveOrder = {
    id: number;
    order_number: string;
    company_name: string;
    priority: 'normal' | 'high' | 'urgent';
    order_date: string | null;
    items: OrderItem[];
};

type LowStockMaterial = {
    id: number;
    name: string;
    unit: string;
    stock_qty: number;
    min_stock: number;
    category: string | null;
};

type RecentDispatched = {
    id: number;
    order_number: string | null;
    company_name: string | null;
    our_brand: string | null;
    packing_size: string | null;
    quantity: number;
    dispatched_at: string;
};

type Props = {
    stageCounts: Record<string, number>;
    activeOrders: ActiveOrder[];
    urgentPending: number;
    lowStock: LowStockMaterial[];
    pendingTransfers: number;
    finishedThisWeek: number;
    recentDispatched: RecentDispatched[];
    lowStockProduction: LowStockProduction | null;
};

const STAGES = [
    { key: 'pending',    label: 'Pending',    color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
    { key: 'processing', label: 'Processing', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
    { key: 'filling',    label: 'Filling',    color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
    { key: 'labeling',   label: 'Labeling',   color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    { key: 'ready',      label: 'Ready',      color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
    { key: 'dispatched', label: 'Dispatched', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
];

const stageFor = (key: string) => STAGES.find((s) => s.key === key) ?? STAGES[0];

const priorityBadge = (p: string) => {
    if (p === 'urgent') return <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>URGENT</span>;
    if (p === 'high')   return <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fffbeb', color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>HIGH</span>;
    return null;
};

export default function FactoryDashboard({
    stageCounts, activeOrders, urgentPending, lowStock, pendingTransfers, finishedThisWeek, recentDispatched, lowStockProduction,
}: Props) {
    const totalActive = STAGES.filter((s) => s.key !== 'dispatched').reduce((sum, s) => sum + (stageCounts[s.key] ?? 0), 0);
    const inProduction = (stageCounts['processing'] ?? 0) + (stageCounts['filling'] ?? 0) + (stageCounts['labeling'] ?? 0);
    const readyCount = stageCounts['ready'] ?? 0;

    return (
        <>
            <Head title="Factory Dashboard" />
            <div id="view-factory-dashboard" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Factory Dashboard</h1>
                        <p>Production overview &amp; inventory status</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Link className="btn secondary" href={inventoryIndex().url}>Inventory</Link>
                        <Link className="btn primary"   href={factoryIndex().url}>Production Orders</Link>
                    </div>
                </div>

                {/* ── Urgent approval alert ── */}
                {urgentPending > 0 && (
                    <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>🚨</span>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>{urgentPending} urgent order{urgentPending !== 1 ? 's' : ''} waiting for your approval</span>
                            <span style={{ fontSize: '13px', color: '#b91c1c', marginLeft: '8px' }}>— approve or reject from Production Orders</span>
                        </div>
                        <Link href={factoryIndex().url} className="btn sm" style={{ borderColor: '#dc2626', color: '#dc2626', whiteSpace: 'nowrap' }}>
                            Review Now →
                        </Link>
                    </div>
                )}

                <LowStockProductionCard data={lowStockProduction} />

                {/* ── Top stat cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                    <StatCard label="Pending Items"    value={stageCounts['pending'] ?? 0} color="#64748b" bg="#f8fafc" border="#cbd5e1" note="Awaiting production start" />
                    <StatCard label="In Production"    value={inProduction}                color="#d97706" bg="#fffbeb" border="#fcd34d" note="Processing / Filling / Labeling" />
                    <StatCard label="Ready to Dispatch" value={readyCount}               color="#16a34a" bg="#f0fdf4" border="#86efac" note="Completed, not dispatched" />
                    <StatCard label="Low Stock"        value={lowStock.length}            color="#dc2626" bg="#fef2f2" border="#fca5a5" note={lowStock.length > 0 ? 'Materials need restocking' : 'All materials OK'} />
                    <StatCard label="Pending Transfers" value={pendingTransfers}          color="#7c3aed" bg="#f5f3ff" border="#c4b5fd" note="Unit transfers awaiting" />
                    <StatCard label="Finished This Week" value={finishedThisWeek}        color="#059669" bg="#ecfdf5" border="#6ee7b7" note="Goods logged this week" />
                </div>

                {/* ── Production pipeline ── */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-title" style={{ marginBottom: '14px' }}>⚙️ Production Pipeline</div>
                    <div style={{ display: 'flex', gap: '0', flexWrap: 'wrap' }}>
                        {STAGES.map((stage, idx) => {
                            const count = stageCounts[stage.key] ?? 0;
                            const isLast = idx === STAGES.length - 1;
                            return (
                                <div key={stage.key} style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 100px', minWidth: '100px' }}>
                                    <div style={{
                                        flex: 1, padding: '16px 14px', background: stage.bg,
                                        borderTop: `3px solid ${stage.color}`,
                                        borderBottom: `1px solid ${stage.border}`,
                                        borderLeft: `1px solid ${stage.border}`,
                                        borderRight: isLast ? `1px solid ${stage.border}` : 'none',
                                        borderRadius: idx === 0 ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : '0',
                                        opacity: count === 0 ? 0.5 : 1,
                                    }}>
                                        <div style={{ fontSize: '28px', fontWeight: 800, color: stage.color, lineHeight: 1, marginBottom: '4px' }}>{count}</div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.label}</div>
                                    </div>
                                    {!isLast && (
                                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '16px', color: '#94a3b8', padding: '0 2px', zIndex: 1, background: 'transparent' }}>→</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--tx-muted)', textAlign: 'right' }}>
                        {totalActive} item{totalActive !== 1 ? 's' : ''} in active production
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', alignItems: 'start' }}>
                    {/* ── Low stock alerts ── */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: '12px' }}>
                            🔴 Low Stock Alerts
                            {lowStock.length > 0 && (
                                <Link href={inventoryIndex().url} style={{ fontSize: '12px', fontWeight: 400, color: 'var(--accent)', marginLeft: '8px', textDecoration: 'none' }}>
                                    View Inventory →
                                </Link>
                            )}
                        </div>
                        {lowStock.length === 0 ? (
                            <div className="empty-state" style={{ padding: '20px 0' }}>
                                <div className="icon">✅</div>
                                <p>All materials are sufficiently stocked.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {lowStock.map((m) => {
                                    const pct = m.min_stock > 0 ? Math.min((m.stock_qty / m.min_stock) * 100, 100) : 0;
                                    const isEmpty = m.stock_qty <= 0;
                                    return (
                                        <div key={m.id} style={{ padding: '10px 12px', borderRadius: '8px', background: isEmpty ? '#fef2f2' : '#fffbeb', border: `1px solid ${isEmpty ? '#fca5a5' : '#fcd34d'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--tx-head)' }}>{m.name}</span>
                                                    {m.category && <span style={{ fontSize: '11px', color: 'var(--tx-muted)', marginLeft: '6px' }}>{m.category}</span>}
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: isEmpty ? '#dc2626' : '#d97706', whiteSpace: 'nowrap' }}>
                                                    {m.stock_qty} / {m.min_stock} {m.unit}
                                                </span>
                                            </div>
                                            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: isEmpty ? '#dc2626' : '#f59e0b', borderRadius: '3px', transition: 'width 0.3s' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Pending transfers + quick links ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Pending unit transfers */}
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: '10px' }}>🔄 Unit Transfers</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <span style={{ fontSize: '40px', fontWeight: 800, color: pendingTransfers > 0 ? '#7c3aed' : '#94a3b8' }}>{pendingTransfers}</span>
                                <div>
                                    <div style={{ fontSize: '13px', color: 'var(--tx-head)', fontWeight: 600 }}>pending transfer{pendingTransfers !== 1 ? 's' : ''}</div>
                                    <Link href={unitTransferIndex().url} style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>Manage transfers →</Link>
                                </div>
                            </div>
                        </div>

                        {/* Quick links */}
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: '10px' }}>🔗 Quick Access</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { href: factoryIndex().url,     icon: '🏭', label: 'Production Orders' },
                                    { href: inventoryIndex().url,   icon: '🗄️', label: 'Inventory' },
                                    { href: bomIndex().url,         icon: '⚗️', label: 'Bill of Materials' },
                                    { href: unitTransferIndex().url, icon: '🔄', label: 'Unit Transfer' },
                                ].map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-paper)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--tx-head)', fontSize: '13px', fontWeight: 500, transition: 'background 0.15s' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-lt)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-paper)')}
                                    >
                                        <span style={{ fontSize: '16px' }}>{link.icon}</span>
                                        {link.label}
                                        <span style={{ marginLeft: 'auto', color: 'var(--tx-muted)' }}>→</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Active production orders ── */}
                {activeOrders.length > 0 && (
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="card-title" style={{ marginBottom: '14px' }}>
                            📋 Active Production Orders
                            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tx-muted)', marginLeft: '8px' }}>
                                {activeOrders.length} order{activeOrders.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activeOrders.map((order) => (
                                <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-paper)' }}>
                                    {/* Order header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border-lt)', background: 'var(--bg-card)' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '13px' }}>{order.order_number}</span>
                                        {priorityBadge(order.priority)}
                                        <span style={{ fontSize: '13px', color: 'var(--tx-head)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.company_name}</span>
                                        {order.order_date && <span style={{ fontSize: '11px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>{order.order_date}</span>}
                                    </div>
                                    {/* Items */}
                                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {order.items.map((item) => {
                                            const stage = stageFor(item.status);
                                            return (
                                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--tx-head)' }}>{item.our_brand ?? '—'}</span>
                                                        {item.party_brand && <span style={{ color: 'var(--tx-muted)', marginLeft: '6px', fontSize: '12px' }}>({item.party_brand})</span>}
                                                        {item.packing_size && <span style={{ color: 'var(--tx-muted)', marginLeft: '6px', fontSize: '12px' }}>{item.packing_size}</span>}
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>{item.quantity} units</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: stage.bg, color: stage.color, border: `1px solid ${stage.border}`, whiteSpace: 'nowrap' }}>
                                                        {stage.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Recently dispatched ── */}
                {recentDispatched.length > 0 && (
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: '12px' }}>✅ Recently Dispatched</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {recentDispatched.map((item) => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-paper)', border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '16px' }}>🚚</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--tx-head)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.our_brand ?? '—'}
                                            {item.packing_size && <span style={{ fontWeight: 400, color: 'var(--tx-muted)', marginLeft: '6px', fontSize: '12px' }}>{item.packing_size}</span>}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>
                                            {item.order_number} · {item.company_name} · {item.quantity} units
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>{item.dispatched_at}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>Dispatched</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function StatCard({ label, value, color, bg, border, note }: {
    label: string; value: number; color: string; bg: string; border: string; note: string;
}) {
    return (
        <div style={{ borderRadius: '12px', padding: '18px', background: bg, border: `2px solid ${border}` }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '40px', fontWeight: 800, color, lineHeight: 1, marginBottom: '6px' }}>{value}</div>
            <div style={{ fontSize: '11px', color, opacity: 0.75 }}>{note}</div>
        </div>
    );
}
