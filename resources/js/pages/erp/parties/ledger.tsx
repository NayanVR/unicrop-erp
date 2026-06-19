import { ledger as partyLedger } from '@/routes/parties';
import { Head, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type PartyOption = { id: number; name: string; customer_name: string | null };

type Entry = {
    date: string;
    type: 'invoice' | 'payment';
    description: string;
    debit: number;
    credit: number;
    balance: number;
};

type Summary = { total_invoiced: number; total_received: number; balance_due: number };

type PartyDetail = { id: number; name: string; customer_name: string | null; gst_no: string | null; phone: string | null };

type PageProps = {
    pageTitle?: string;
    parties: PartyOption[];
    party: PartyDetail | null;
    entries: Entry[];
    summary: Summary | null;
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PartyLedger() {
    const { parties, party, entries, summary } = usePage<PageProps>().props;
    const [search, setSearch] = useState('');

    const filteredParties = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return parties;
        return parties.filter(
            (p) => p.name.toLowerCase().includes(q) || (p.customer_name ?? '').toLowerCase().includes(q),
        );
    }, [parties, search]);

    const selectParty = (id: number) => {
        router.get(partyLedger(id).url);
    };

    return (
        <>
            <Head title="Party Ledger" />

            <div className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Party Ledger</h1>
                        <p>Chronological order &amp; payment history with running balance.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 260 }}>
                        <input
                            type="text"
                            placeholder="Search party…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '100%', marginBottom: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                        />
                        <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                            {filteredParties.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => selectParty(p.id)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        border: 'none',
                                        borderBottom: '1px solid #f1f5f9',
                                        background: party?.id === p.id ? '#eff6ff' : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {p.name}
                                    {p.customer_name && <div style={{ fontSize: 12, color: '#6b7280' }}>{p.customer_name}</div>}
                                </button>
                            ))}
                            {filteredParties.length === 0 && (
                                <div style={{ padding: 12, color: '#6b7280', fontSize: 13 }}>No parties found.</div>
                            )}
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 320 }}>
                        {!party ? (
                            <div style={{ color: '#6b7280' }}>Select a party to view their ledger.</div>
                        ) : (
                            <>
                                <h2 style={{ marginBottom: 4 }}>{party.name}</h2>
                                {party.customer_name && <div style={{ color: '#6b7280', marginBottom: 4 }}>{party.customer_name}</div>}
                                <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
                                    {party.gst_no && <span>GST: {party.gst_no} &nbsp;·&nbsp; </span>}
                                    {party.phone && <span>{party.phone}</span>}
                                </div>

                                {summary && (
                                    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                                        <div style={{ padding: '10px 16px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Total Invoiced</div>
                                            <div style={{ fontSize: 18, fontWeight: 600 }}>{inr(summary.total_invoiced)}</div>
                                        </div>
                                        <div style={{ padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Total Received</div>
                                            <div style={{ fontSize: 18, fontWeight: 600, color: '#15803d' }}>{inr(summary.total_received)}</div>
                                        </div>
                                        <div style={{ padding: '10px 16px', borderRadius: 8, background: summary.balance_due > 0 ? '#fef3c7' : '#f0fdf4', border: `1px solid ${summary.balance_due > 0 ? '#fcd34d' : '#bbf7d0'}` }}>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Balance Due</div>
                                            <div style={{ fontSize: 18, fontWeight: 600 }}>{inr(summary.balance_due)}</div>
                                        </div>
                                    </div>
                                )}

                                <table className="prod-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Description</th>
                                            <th style={{ textAlign: 'right' }}>Debit</th>
                                            <th style={{ textAlign: 'right' }}>Credit</th>
                                            <th style={{ textAlign: 'right' }}>Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry, i) => (
                                            <tr key={i}>
                                                <td>{entry.date}</td>
                                                <td>{entry.description}</td>
                                                <td style={{ textAlign: 'right' }}>{entry.debit ? inr(entry.debit) : ''}</td>
                                                <td style={{ textAlign: 'right' }}>{entry.credit ? inr(entry.credit) : ''}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(entry.balance)}</td>
                                            </tr>
                                        ))}
                                        {entries.length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: 16 }}>
                                                    No ledger entries yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
