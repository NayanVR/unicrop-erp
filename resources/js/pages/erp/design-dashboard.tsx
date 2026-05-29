import { index as designIndex } from '@/routes/design';
import { index as ordersIndex } from '@/routes/orders';
import { Head, Link } from '@inertiajs/react';

type ActiveOrder = {
    id: number;
    order_number: string | null;
    company_name: string | null;
    priority: 'normal' | 'high' | 'urgent';
    party_brand: string | null;
    product_name: string | null;
    packing_size: string | null;
    status: string;
    assignee: string | null;
    updated_at: string;
};

type CompletedOrder = {
    id: number;
    order_number: string | null;
    company_name: string | null;
    party_brand: string | null;
    product_name: string | null;
    packing_size: string | null;
    status: string;
    completed_at: string;
};

type Props = {
    statusCounts: Record<string, number>;
    activeOrders: ActiveOrder[];
    recentlyCompleted: CompletedOrder[];
    completedThisWeek: number;
};

const STAGES = [
    { key: 'pending',          label: 'Pending Acceptance',  color: '#dc2626', bg: '#fef2f2' },
    { key: 'accepted',         label: 'Accepted',            color: '#d97706', bg: '#fffbeb' },
    { key: 'design-ready',     label: 'Design Ready',        color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'approved-party',   label: 'Party Approved',      color: '#0891b2', bg: '#ecfeff' },
    { key: 'sent-print',       label: 'Sent to Print',       color: '#2563eb', bg: '#eff6ff' },
    { key: 'completed',        label: 'Completed',           color: '#16a34a', bg: '#f0fdf4' },
    { key: 'received-factory', label: 'At Factory',          color: '#059669', bg: '#ecfdf5' },
];

const STATUS_ORDER: Record<string, number> = {
    'pending': 0, 'accepted': 1, 'design-ready': 2,
    'approved-party': 3, 'sent-print': 4, 'completed': 5, 'received-factory': 6,
};

const stageFor = (key: string) => STAGES.find((s) => s.key === key);

const priorityBadge = (p: string) => {
    if (p === 'urgent') return <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', textTransform: 'uppercase' }}>URGENT</span>;
    if (p === 'high')   return <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fffbeb', color: '#d97706', textTransform: 'uppercase' }}>HIGH</span>;
    return null;
};

export default function DesignDashboard({ statusCounts, activeOrders, recentlyCompleted, completedThisWeek }: Props) {
    const pending    = statusCounts['pending']    ?? 0;
    const inProgress = (statusCounts['accepted'] ?? 0) + (statusCounts['design-ready'] ?? 0) + (statusCounts['approved-party'] ?? 0);
    const sentPrint  = statusCounts['sent-print'] ?? 0;

    const sortedActive = [...activeOrders].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    );

    return (
        <>
            <Head title="Dashboard" />
            <div id="view-design-dashboard" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Design Dashboard</h1>
                        <p>Your design work overview</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Link className="btn secondary" href={designIndex().url}>Design Work</Link>
                        <Link className="btn primary"   href={ordersIndex().url}>My Orders</Link>
                    </div>
                </div>

                {/* ── Summary stat cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                    <StatCard
                        label="Needs Acceptance"
                        value={pending}
                        color="#dc2626"
                        bg="#fef2f2"
                        border="#fca5a5"
                        note={pending > 0 ? 'Waiting for you' : 'All clear'}
                    />
                    <StatCard
                        label="In Progress"
                        value={inProgress}
                        color="#d97706"
                        bg="#fffbeb"
                        border="#fcd34d"
                        note="Accepted → Party approved"
                    />
                    <StatCard
                        label="Sent to Print"
                        value={sentPrint}
                        color="#2563eb"
                        bg="#eff6ff"
                        border="#93c5fd"
                        note="Waiting at printer"
                    />
                    <StatCard
                        label="Done This Week"
                        value={completedThisWeek}
                        color="#16a34a"
                        bg="#f0fdf4"
                        border="#86efac"
                        note="Completed or received"
                    />
                </div>

                {/* ── Full status breakdown ── */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-title" style={{ marginBottom: '14px' }}>📊 Status Breakdown</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {STAGES.map((s) => {
                            const count = statusCounts[s.key] ?? 0;
                            return (
                                <div key={s.key} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 14px', borderRadius: '8px',
                                    background: s.bg, border: `1px solid ${s.color}30`,
                                    opacity: count === 0 ? 0.45 : 1,
                                }}>
                                    <span style={{ fontWeight: 800, fontSize: '18px', color: s.color, minWidth: '24px', textAlign: 'center', lineHeight: 1 }}>{count}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: s.color }}>{s.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Active work queue ── */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-title" style={{ marginBottom: '14px' }}>
                        🎨 Active Work Queue
                        <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tx-muted)', marginLeft: '8px' }}>
                            {sortedActive.length} item{sortedActive.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {sortedActive.length === 0 ? (
                        <div className="empty-state" style={{ padding: '28px 0' }}>
                            <div className="icon">✅</div>
                            <p>No active design work. All caught up!</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        {['Order', 'Party / Company', 'Product', 'Size', 'Status', 'Assigned', 'Updated'].map((h) => (
                                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedActive.map((item) => {
                                        const stage = stageFor(item.status);
                                        return (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-lt)' }}>
                                                <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '12px' }}>{item.order_number ?? '—'}</span>
                                                    {item.priority !== 'normal' && <span style={{ marginLeft: '6px' }}>{priorityBadge(item.priority)}</span>}
                                                </td>
                                                <td style={{ padding: '9px 10px', color: 'var(--tx-head)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.party_brand ? (
                                                        <>
                                                            <div style={{ fontWeight: 600 }}>{item.party_brand}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{item.company_name}</div>
                                                        </>
                                                    ) : (
                                                        <span>{item.company_name ?? '—'}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '9px 10px', color: 'var(--tx-sub)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.product_name ?? '—'}
                                                </td>
                                                <td style={{ padding: '9px 10px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>
                                                    {item.packing_size ?? '—'}
                                                </td>
                                                <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                                    {stage ? (
                                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: stage.bg, color: stage.color }}>
                                                            {stage.label}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{item.status}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '9px 10px', color: 'var(--tx-muted)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                                    {item.assignee ?? '—'}
                                                </td>
                                                <td style={{ padding: '9px 10px', color: 'var(--tx-muted)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                                    {item.updated_at}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Recently completed ── */}
                {recentlyCompleted.length > 0 && (
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: '14px' }}>✅ Recently Completed</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {recentlyCompleted.map((item) => (
                                <div key={item.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '10px 14px', borderRadius: '8px',
                                    background: 'var(--bg-paper)', border: '1px solid var(--border)',
                                }}>
                                    <span style={{ fontSize: '16px' }}>{item.status === 'received-factory' ? '🏭' : '✅'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--tx-head)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.party_brand ?? item.product_name ?? '—'}
                                            {item.packing_size && <span style={{ fontWeight: 400, color: 'var(--tx-muted)', marginLeft: '6px', fontSize: '12px' }}>{item.packing_size}</span>}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>
                                            {item.order_number} · {item.company_name}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--tx-muted)', whiteSpace: 'nowrap' }}>{item.completed_at}</span>
                                    <span style={{
                                        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                                        background: item.status === 'received-factory' ? '#ecfdf5' : '#f0fdf4',
                                        color: item.status === 'received-factory' ? '#059669' : '#16a34a',
                                    }}>
                                        {item.status === 'received-factory' ? 'At Factory' : 'Completed'}
                                    </span>
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
        <div style={{
            borderRadius: '12px', padding: '20px', background: bg,
            border: `2px solid ${border}`,
        }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '8px' }}>
                {label}
            </div>
            <div style={{ fontSize: '42px', fontWeight: 800, color, lineHeight: 1, marginBottom: '6px' }}>
                {value}
            </div>
            <div style={{ fontSize: '11px', color, opacity: 0.75 }}>{note}</div>
        </div>
    );
}
