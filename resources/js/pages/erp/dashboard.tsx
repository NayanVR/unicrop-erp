import LowStockProductionCard, { type LowStockProduction } from '@/components/low-stock-production-card';
import { create as ordersCreate, edit as ordersEdit, index as ordersIndex } from '@/routes/orders';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

type LeaderboardEntry = { userId: number; name: string; orders: number; value: number };
type TopParty        = { company_name: string; orders: number; value: number };
type OrderRow        = { id: number; order_number: string; company_name: string; total_amount: number; status: string; order_date: string | null; priority: string };
type PendingRow      = { id: number; order_number: string; company_name: string; total_amount: number; order_date: string | null; priority: string };

type PeriodData = {
    myOrders: number;
    myValue: number;
    leaderboard: LeaderboardEntry[];
    topParties: TopParty[];
};

type Period = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

type Props = {
    salesData: Record<Period, PeriodData>;
    currentUserId: number | null;
    recentOrders: OrderRow[];
    pendingOrders: PendingRow[];
    lowStockProduction: LowStockProduction | null;
};

const PERIODS: { key: Period; label: string }[] = [
    { key: 'today',     label: 'Today' },
    { key: 'thisWeek',  label: 'This Week' },
    { key: 'lastWeek',  label: 'Last Week' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'thisYear',  label: 'This Year' },
    { key: 'lastYear',  label: 'Last Year' },
];

const MEDALS = ['🥇', '🥈', '🥉'];
const fmt    = (v: number) => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtFull = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const priorityColor: Record<string, { bg: string; color: string }> = {
    urgent: { bg: '#fee2e2', color: '#b91c1c' },
    high:   { bg: '#fef3c7', color: '#b45309' },
    normal: { bg: '#f3f4f6', color: '#6b7280' },
};

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    confirmed:  { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
    dispatched: { bg: '#d1fae5', color: '#065f46', label: 'Dispatched' },
    submitted:  { bg: '#fef3c7', color: '#b45309', label: 'Pending' },
};

export default function Dashboard({ salesData, currentUserId, recentOrders, pendingOrders, lowStockProduction }: Props) {
    const [period, setPeriod] = useState<Period>('thisMonth');
    const data    = salesData[period];
    const prevData = salesData['lastMonth'];
    const maxValue = Math.max(...data.leaderboard.map((e) => e.value), 1);
    const maxParty = Math.max(...data.topParties.map((p) => p.value), 1);
    const myRank   = data.leaderboard.findIndex((e) => e.userId === currentUserId) + 1;

    // Month-over-month (always compares thisMonth vs lastMonth)
    const momOrders = salesData['thisMonth'].myOrders - salesData['lastMonth'].myOrders;
    const momValue  = salesData['thisMonth'].myValue  - salesData['lastMonth'].myValue;
    const momPct    = prevData.myValue > 0
        ? ((salesData['thisMonth'].myValue - prevData.myValue) / prevData.myValue) * 100
        : null;

    const growthColor  = momValue >= 0 ? '#16a34a' : '#dc2626';
    const growthSymbol = momValue >= 0 ? '▲' : '▼';

    const scrollToLeaderboard = () => {
        document.getElementById('sales-leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <>
            <Head title="Dashboard" />

            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Your sales performance &amp; team leaderboard</p>
                </div>
                <Link className="btn primary" href={ordersCreate().url}>＋ New Order</Link>
            </div>

            <LowStockProductionCard data={lowStockProduction} />

            {/* ── Month-over-month banner ───────────────────────────── */}
            {momPct !== null && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '10px 16px', borderRadius: 10, marginBottom: 18,
                    background: momValue >= 0 ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${momValue >= 0 ? '#86efac' : '#fca5a5'}`,
                }}>
                    <span style={{ fontSize: 20 }}>{momValue >= 0 ? '📈' : '📉'}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: growthColor }}>
                        {growthSymbol} {Math.abs(momPct).toFixed(1)}% vs Last Month
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--tx-muted, #6b7280)' }}>
                        {momValue >= 0 ? '+' : ''}{fmt(momValue)} &nbsp;·&nbsp;
                        {momOrders >= 0 ? '+' : ''}{momOrders} orders
                    </span>
                </div>
            )}

            {/* ── Period selector ───────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {PERIODS.map((p) => (
                    <button key={p.key} type="button"
                        className={`pill${period === p.key ? ' active' : ''}`}
                        onClick={() => setPeriod(p.key)}
                        style={{ fontWeight: period === p.key ? 700 : 400 }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* ── My performance stats ──────────────────────────────── */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <Link href={ordersIndex().url} className="stat-card dash-kpi-card" style={{ borderLeft: '4px solid var(--accent)', textDecoration: 'none', color: 'inherit' }}>
                    <div className="stat-icon" style={{ background: 'var(--accent-lt, #eff6ff)' }}>🌱</div>
                    <div>
                        <div className="stat-val">{data.myOrders}</div>
                        <div className="stat-label">My Orders</div>
                    </div>
                </Link>
                <Link href={ordersIndex().url} className="stat-card dash-kpi-card" style={{ borderLeft: '4px solid #d97706', textDecoration: 'none', color: 'inherit' }}>
                    <div className="stat-icon" style={{ background: '#fffbeb' }}>💰</div>
                    <div>
                        <div className="stat-val" style={{ fontSize: 18 }}>{fmt(data.myValue)}</div>
                        <div className="stat-label">My Value</div>
                    </div>
                </Link>
                <button type="button" onClick={scrollToLeaderboard} className="stat-card dash-kpi-card" style={{ borderLeft: '4px solid #7c3aed', textAlign: 'left', font: 'inherit' }}>
                    <div className="stat-icon" style={{ background: '#f5f3ff' }}>🏆</div>
                    <div>
                        <div className="stat-val">{myRank > 0 ? (MEDALS[myRank - 1] ?? `#${myRank}`) : '—'}</div>
                        <div className="stat-label">My Rank</div>
                    </div>
                </button>
            </div>

            {/* ── Main grid ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

                {/* Leaderboard */}
                <div className="card" id="sales-leaderboard">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏆 Sales Leaderboard</div>
                    {data.leaderboard.length === 0 ? (
                        <div className="empty-state"><p>No confirmed orders for this period.</p></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.leaderboard.map((entry, idx) => {
                                const isMe   = entry.userId === currentUserId;
                                const barPct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;
                                const medal  = MEDALS[idx];
                                return (
                                    <div key={entry.userId} style={{
                                        padding: '12px 14px', borderRadius: 10,
                                        border: isMe ? '2px solid var(--accent)' : '1px solid var(--border)',
                                        background: isMe ? 'var(--accent-lt, #eff6ff)' : 'var(--bg-paper)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                            <div style={{
                                                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: medal ? 'transparent' : (isMe ? 'var(--accent)' : '#e5e7eb'),
                                                fontSize: medal ? 20 : 12, fontWeight: 800,
                                                color: medal ? undefined : (isMe ? '#fff' : '#6b7280'),
                                            }}>
                                                {medal ?? `#${idx + 1}`}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? 'var(--accent)' : 'var(--tx-head)' }}>
                                                    {entry.name}{isMe ? ' (Me)' : ''}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 1 }}>
                                                    {entry.orders} order{entry.orders !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: 15, color: '#d97706', flexShrink: 0 }}>
                                                {fmt(entry.value)}
                                            </div>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--border-lt, #e5e7eb)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', width: `${barPct}%`, borderRadius: 3,
                                                background: isMe ? 'var(--accent)' : (idx === 0 ? '#f59e0b' : '#94a3b8'),
                                                transition: 'width 0.4s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Parties */}
                <div className="card">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏢 Top Parties</div>
                    {data.topParties.length === 0 ? (
                        <div className="empty-state"><p>No orders for this period.</p></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.topParties.map((p, idx) => {
                                const barPct = maxParty > 0 ? (p.value / maxParty) * 100 : 0;
                                return (
                                    <div key={p.company_name}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx-muted)', minWidth: 20 }}>#{idx + 1}</span>
                                            <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.company_name}
                                            </span>
                                            <span style={{ fontWeight: 700, fontSize: 14, color: '#059669', flexShrink: 0 }}>{fmt(p.value)}</span>
                                            <span style={{ fontSize: 11, color: 'var(--tx-muted)', flexShrink: 0 }}>{p.orders} order{p.orders !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style={{ height: 5, background: 'var(--border-lt, #e5e7eb)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', width: `${barPct}%`, borderRadius: 3,
                                                background: idx === 0 ? '#059669' : '#6ee7b7',
                                                transition: 'width 0.4s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom grid ───────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Recent Orders */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>📋 My Recent Orders</div>
                        <Link href={ordersIndex().url} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>View All →</Link>
                    </div>
                    {recentOrders.length === 0 ? (
                        <div className="empty-state"><p>No recent orders.</p></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {recentOrders.map((o) => {
                                const ss = statusStyle[o.status] ?? statusStyle.confirmed;
                                const pc = priorityColor[o.priority] ?? priorityColor.normal;
                                return (
                                    <Link key={o.id} href={ordersEdit(o.id).url} className="dash-order-row" style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '9px 12px', borderRadius: 8,
                                        border: '1px solid var(--border-color, #e5e7eb)',
                                        background: 'var(--bg-paper)',
                                        textDecoration: 'none', color: 'inherit',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>#{o.order_number}</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: ss.bg, color: ss.color }}>{ss.label}</span>
                                                {o.priority !== 'normal' && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: pc.bg, color: pc.color }}>{o.priority}</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 2 }}>{o.company_name}</div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>{fmt(o.total_amount)}</div>
                                            <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>{o.order_date}</div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pending Orders */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>
                            ⏳ Pending Confirmation
                            {pendingOrders.length > 0 && (
                                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#b45309', borderRadius: 10, padding: '2px 8px' }}>
                                    {pendingOrders.length}
                                </span>
                            )}
                        </div>
                        <Link href={ordersIndex().url} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>View All →</Link>
                    </div>
                    {pendingOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                            ✅ No pending orders
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {pendingOrders.map((o) => {
                                const pc = priorityColor[o.priority] ?? priorityColor.normal;
                                return (
                                    <Link key={o.id} href={ordersEdit(o.id).url} className="dash-order-row" style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '9px 12px', borderRadius: 8,
                                        border: '1px solid #fcd34d',
                                        background: '#fffbeb',
                                        textDecoration: 'none', color: 'inherit',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>#{o.order_number}</span>
                                                {o.priority !== 'normal' && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: pc.bg, color: pc.color }}>{o.priority}</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>{o.company_name}</div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>{fmtFull(o.total_amount)}</div>
                                            <div style={{ fontSize: 11, color: '#b45309' }}>{o.order_date}</div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
