import { Head, router } from '@inertiajs/react';
import { Fragment, useState } from 'react';

type Item = {
    name: string;
    our_brand: string;
    packing_size: string | null;
    quantity: number;
    kg: number;
    parcels: number | null;
};

type OrderRow = {
    order_id: number;
    order_number: string;
    order_date: string | null;
    customer: string;
    destination: string | null;
    status: string;
    transport_name: string;
    transport_type: string | null;
    total_amount: number;
    kg: number;
    parcels: number;
    items: Item[];
};

type TransportGroup = {
    transport_name: string;
    transport_type: string | null;
    orders: number;
    kg: number;
    parcels: number;
    amount: number;
    rows: OrderRow[];
};

type Props = {
    transports: TransportGroup[];
    totals: { orders: number; kg: number; parcels: number; amount: number };
    filters: { from: string; to: string };
};

const money = (v: number) =>
    '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qty = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 3 });

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export default function TransportReport({ transports, totals, filters }: Props) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [openTransport, setOpenTransport] = useState<string | null>(null);
    const [openOrder, setOpenOrder] = useState<number | null>(null);

    const applyFilter = () => {
        router.get('/transport-report', { from, to }, { preserveState: true, preserveScroll: true });
    };

    return (
        <>
            <Head title="Transport Report" />
            <div className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Transport Report</h1>
                        <p>કયા transport માં કયું material, કયા customer નું ગયું — transport પ્રમાણે</p>
                    </div>
                </div>

                {/* Date filter */}
                <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>From</label>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label>To</label>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <button className="btn primary" onClick={applyFilter}>Apply</button>
                </div>

                {/* Grand totals */}
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                    <div className="stat-card">
                        <div className="stat-value">{totals.orders}</div>
                        <div className="stat-label">Total Orders</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{qty(totals.kg)}</div>
                        <div className="stat-label">Total Kg / Ltr</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{totals.parcels}</div>
                        <div className="stat-label">Total Parcels</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{money(totals.amount)}</div>
                        <div className="stat-label">Total Amount</div>
                    </div>
                </div>

                {/* Per-transport summary */}
                {transports.length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--tx-muted)' }}>
                        આ સમયગાળામાં કોઈ order મળ્યો નથી.
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Transport / Courier</th>
                                        <th style={{ textAlign: 'right' }}>Orders</th>
                                        <th style={{ textAlign: 'right' }}>Kg / Ltr</th>
                                        <th style={{ textAlign: 'right' }}>Parcels</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {transports.map((t) => (
                                        <Fragment key={t.transport_name}>
                                            <tr
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setOpenTransport(openTransport === t.transport_name ? null : t.transport_name);
                                                    setOpenOrder(null);
                                                }}
                                            >
                                                <td>
                                                    <span className="prod-name">
                                                        {t.transport_type === 'courier' ? '📦' : '🚛'} {t.transport_name}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>{t.orders}</td>
                                                <td style={{ textAlign: 'right' }}>{qty(t.kg)}</td>
                                                <td style={{ textAlign: 'right' }}>{t.parcels}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(t.amount)}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--tx-muted)' }}>
                                                    {openTransport === t.transport_name ? '▾' : '▸'}
                                                </td>
                                            </tr>

                                            {openTransport === t.transport_name && (
                                                <tr>
                                                    <td colSpan={6} style={{ background: 'var(--bg-paper)', padding: '10px 14px' }}>
                                                        <table className="prod-table" style={{ fontSize: 13 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Order</th>
                                                                    <th>Date</th>
                                                                    <th>Customer</th>
                                                                    <th>Destination</th>
                                                                    <th style={{ textAlign: 'right' }}>Kg / Ltr</th>
                                                                    <th style={{ textAlign: 'right' }}>Parcels</th>
                                                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                                                    <th />
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {t.rows.map((o) => (
                                                                    <Fragment key={o.order_id}>
                                                                        <tr
                                                                            style={{ cursor: 'pointer' }}
                                                                            onClick={() => setOpenOrder(openOrder === o.order_id ? null : o.order_id)}
                                                                        >
                                                                            <td><strong>{o.order_number}</strong></td>
                                                                            <td>{fmtDate(o.order_date)}</td>
                                                                            <td>{o.customer}</td>
                                                                            <td>{o.destination ?? '—'}</td>
                                                                            <td style={{ textAlign: 'right' }}>{qty(o.kg)}</td>
                                                                            <td style={{ textAlign: 'right' }}>{o.parcels}</td>
                                                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(o.total_amount)}</td>
                                                                            <td style={{ textAlign: 'right', color: 'var(--tx-muted)' }}>
                                                                                {openOrder === o.order_id ? '▾' : '▸'}
                                                                            </td>
                                                                        </tr>
                                                                        {openOrder === o.order_id && (
                                                                            <tr>
                                                                                <td colSpan={8} style={{ background: 'var(--bg-card)', padding: '8px 12px' }}>
                                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 4 }}>
                                                                                        Material
                                                                                    </div>
                                                                                    <table style={{ fontSize: 12, width: '100%', maxWidth: 620 }}>
                                                                                        <tbody>
                                                                                            {o.items.map((it, i) => (
                                                                                                <tr key={i}>
                                                                                                    <td style={{ padding: '2px 0' }}>{it.name}</td>
                                                                                                    <td style={{ padding: '2px 8px', color: 'var(--tx-muted)' }}>
                                                                                                        {it.packing_size ?? '—'} × {qty(it.quantity)}
                                                                                                    </td>
                                                                                                    <td style={{ padding: '2px 8px', textAlign: 'right' }}>
                                                                                                        {qty(it.kg)} kg/ltr
                                                                                                    </td>
                                                                                                    <td style={{ padding: '2px 0', textAlign: 'right', color: 'var(--tx-muted)' }}>
                                                                                                        {it.parcels != null ? `${it.parcels} parcel` : '—'}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </Fragment>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
