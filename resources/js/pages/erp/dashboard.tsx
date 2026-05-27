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

export default function Dashboard({ salesData, currentUserId }: Props) {
    const [period, setPeriod] = useState<Period>('today');
    const data = salesData[period];
    const maxValue = Math.max(...data.leaderboard.map((e) => e.value), 1);

    return (
        <>
            <Head title="Dashboard" />
            <div id="view-dashboard" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Dashboard</h1>
                        <p>Sales performance &amp; confirmed order overview</p>
                    </div>
                    <Link className="btn primary" href={ordersCreate().url}>
                        ＋ New Order
                    </Link>
                </div>

                <div className="card">
                    {/* Header + period pills */}
                    <div style={{ marginBottom: '16px' }}>
                        <div className="card-title" style={{ marginBottom: '12px' }}>
                            💰 My Sales — Confirmed Order Value
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {PERIODS.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    className={`pill${period === p.key ? ' active' : ''}`}
                                    onClick={() => setPeriod(p.key)}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* My stat cards */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
                        <div style={{
                            border: '2px solid var(--accent)',
                            borderRadius: '12px',
                            padding: '20px 28px',
                            flex: '1 1 160px',
                            maxWidth: '220px',
                            background: 'var(--accent-lt)',
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '10px' }}>
                                MY ORDERS
                            </div>
                            <div style={{ fontSize: '40px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                                {data.myOrders}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--tx-sub)', marginTop: '6px' }}>
                                confirmed orders
                            </div>
                        </div>

                        <div style={{
                            border: '2px solid #d97706',
                            borderRadius: '12px',
                            padding: '20px 28px',
                            flex: '1 1 160px',
                            maxWidth: '260px',
                            background: '#fffbeb',
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '10px' }}>
                                MY VALUE
                            </div>
                            <div style={{ fontSize: '40px', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>
                                {fmt(data.myValue)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#92400e', marginTop: '6px' }}>
                                confirmed order value
                            </div>
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--tx-head)', marginBottom: '14px' }}>
                        🏆 Sales Leaderboard
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.leaderboard.map((entry, idx) => {
                            const isMe = entry.userId === currentUserId;
                            const barPct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;

                            return (
                                <div
                                    key={entry.userId}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        border: isMe ? '2px solid var(--accent)' : '1px solid var(--border)',
                                        background: isMe ? 'var(--accent-lt)' : 'var(--bg-paper)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '22px', minWidth: '32px', textAlign: 'center' }}>
                                            {MEDALS[idx] ?? `#${idx + 1}`}
                                        </span>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: '15px',
                                            flex: 1,
                                            color: isMe ? 'var(--accent)' : 'var(--tx-head)',
                                        }}>
                                            {entry.name}{isMe ? ' (Me)' : ''}
                                        </span>
                                        <span style={{ fontWeight: 700, color: '#d97706', fontSize: '15px' }}>
                                            {fmt(entry.value)}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--tx-muted)', minWidth: '56px', textAlign: 'right' }}>
                                            {entry.orders} order{entry.orders !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--border-lt)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${barPct}%`,
                                            background: isMe ? 'var(--accent)' : '#94a3b8',
                                            borderRadius: '4px',
                                            transition: 'width 0.35s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}

                        {data.leaderboard.length === 0 && (
                            <div className="empty-state" style={{ padding: '28px 0' }}>
                                <div className="icon">📊</div>
                                <p>No confirmed orders for this period.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
