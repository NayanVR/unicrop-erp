import LowStockProductionCard, { type LowStockProduction } from '@/components/low-stock-production-card';
import { create as ordersCreate } from '@/routes/orders';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

type LeaderboardEntry = {
    userId: number;
    name: string;
    orders: number;
    value: number;
};

type PeriodData = {
    myOrders: number;
    myValue: number;
    leaderboard: LeaderboardEntry[];
};

type Period = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

type Props = {
    salesData: Record<Period, PeriodData>;
    currentUserId: number | null;
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

const fmt = (v: number) =>
    '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function Dashboard({ salesData, currentUserId, lowStockProduction }: Props) {
    const [period, setPeriod] = useState<Period>('thisMonth');
    const data = salesData[period];
    const maxValue = Math.max(...data.leaderboard.map((e) => e.value), 1);
    const myRank = data.leaderboard.findIndex((e) => e.userId === currentUserId) + 1;

    return (
        <>
            <Head title="Dashboard" />

            {/* Page header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Your sales performance &amp; team leaderboard</p>
                </div>
                <Link className="btn primary" href={ordersCreate().url}>＋ New Order</Link>
            </div>

            <LowStockProductionCard data={lowStockProduction} />

            {/* Period selector */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {PERIODS.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        className={`pill${period === p.key ? ' active' : ''}`}
                        onClick={() => setPeriod(p.key)}
                        style={{ fontWeight: period === p.key ? 700 : 400 }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* My performance stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                    <div className="stat-icon" style={{ background: 'var(--accent-lt, #eff6ff)' }}>🌱</div>
                    <div>
                        <div className="stat-val">{data.myOrders}</div>
                        <div className="stat-label">My Orders</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
                    <div className="stat-icon" style={{ background: '#fffbeb' }}>💰</div>
                    <div>
                        <div className="stat-val" style={{ fontSize: 18 }}>{fmt(data.myValue)}</div>
                        <div className="stat-label">My Value</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                    <div className="stat-icon" style={{ background: '#f5f3ff' }}>🏆</div>
                    <div>
                        <div className="stat-val">
                            {myRank > 0 ? (MEDALS[myRank - 1] ?? `#${myRank}`) : '—'}
                        </div>
                        <div className="stat-label">My Rank</div>
                    </div>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="card">
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--tx-head)', marginBottom: 16 }}>
                    🏆 Sales Leaderboard
                </div>

                {data.leaderboard.length === 0 ? (
                    <div className="empty-state" style={{ padding: '28px 0' }}>
                        <div className="icon">📊</div>
                        <p>No confirmed orders for this period.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {data.leaderboard.map((entry, idx) => {
                            const isMe = entry.userId === currentUserId;
                            const barPct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;
                            const medal = MEDALS[idx];

                            return (
                                <div
                                    key={entry.userId}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: 10,
                                        border: isMe ? '2px solid var(--accent)' : '1px solid var(--border)',
                                        background: isMe ? 'var(--accent-lt, #eff6ff)' : 'var(--bg-paper)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                        {/* Rank */}
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: medal ? 'transparent' : (isMe ? 'var(--accent)' : '#e5e7eb'),
                                            fontSize: medal ? 22 : 13,
                                            fontWeight: 800,
                                            color: medal ? undefined : (isMe ? '#fff' : '#6b7280'),
                                        }}>
                                            {medal ?? `#${idx + 1}`}
                                        </div>

                                        {/* Name */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontWeight: 700, fontSize: 15,
                                                color: isMe ? 'var(--accent)' : 'var(--tx-head)',
                                            }}>
                                                {entry.name}{isMe ? ' (Me)' : ''}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 1 }}>
                                                {entry.orders} order{entry.orders !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        {/* Value */}
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: 16, color: '#d97706' }}>
                                                {fmt(entry.value)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{ height: 7, background: 'var(--border-lt, #e5e7eb)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${barPct}%`,
                                            borderRadius: 4,
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
        </>
    );
}
