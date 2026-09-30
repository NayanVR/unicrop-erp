import { useState } from 'react';
import { recencyOf } from '@/lib/recency';

/** What the server records on the row when someone edits it. */
export type ChangeLog = {
    at?: string;
    by?: string | null;
    fields?: { label: string; from: string; to: string }[];
    items?: { id: number; name: string; kind: 'added' | 'changed' | 'removed'; from?: string; to?: string }[];
} | null;

/** Material ids touched by the last edit, for highlighting ingredient rows. */
export function changedItemIds(log: ChangeLog): Set<number> {
    return new Set((log?.items ?? []).filter((i) => i.kind !== 'removed').map((i) => i.id));
}

const KIND_STYLE = {
    added:   { bg: '#d1fae5', fg: '#065f46', word: 'added' },
    changed: { bg: '#dbeafe', fg: '#1e40af', word: 'changed' },
    removed: { bg: '#fee2e2', fg: '#991b1b', word: 'removed' },
} as const;

/**
 * "New" / "Updated" pill next to a BOM / recipe / product name. When the row
 * carries a change log, clicking it opens the list of what that edit touched.
 */
export default function RecencyBadge({
    createdAt,
    updatedAt,
    changes,
    style,
}: {
    createdAt?: string | null;
    updatedAt?: string | null;
    changes?: ChangeLog;
    style?: React.CSSProperties;
}) {
    const [open, setOpen] = useState(false);

    const r = recencyOf(createdAt, updatedAt);
    if (!r) return null;

    const isNew = r.kind === 'new';
    const fields = changes?.fields ?? [];
    const items = changes?.items ?? [];
    const hasDetail = !isNew && (fields.length > 0 || items.length > 0);
    const count = fields.length + items.length;

    return (
        <span style={{ position: 'relative', display: 'inline-flex', ...style }}>
            <span
                onClick={hasDetail ? (e) => { e.stopPropagation(); setOpen((o) => !o); } : undefined}
                title={hasDetail ? `${count} change${count === 1 ? '' : 's'} — click to see` : `${r.label} on ${r.date}`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                    background: isNew ? '#d1fae5' : '#dbeafe',
                    color: isNew ? '#065f46' : '#1e40af',
                    border: `1px solid ${isNew ? '#6ee7b7' : '#93c5fd'}`,
                    borderRadius: 20,
                    padding: '1px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.3px',
                    whiteSpace: 'nowrap',
                    cursor: hasDetail ? 'pointer' : 'default',
                }}
            >
                {isNew ? '🆕' : '✏️'} {r.label.toUpperCase()}
                <span style={{ fontWeight: 500, opacity: 0.85 }}>· {r.date}</span>
                {hasDetail && <span style={{ fontWeight: 500 }}>{open ? '▴' : '▾'}</span>}
            </span>

            {open && hasDetail && (
                <>
                    {/* click-away catcher */}
                    <span
                        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    />
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            zIndex: 41,
                            minWidth: 260,
                            maxWidth: 380,
                            background: 'var(--bg-card, #fff)',
                            border: '1px solid var(--border, #e5e7eb)',
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,.14)',
                            padding: '10px 12px',
                            fontSize: 12,
                            fontWeight: 400,
                            letterSpacing: 0,
                            color: 'var(--tx-body)',
                            textAlign: 'left',
                            whiteSpace: 'normal',
                        }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--tx-head)' }}>
                            What changed
                            {changes?.by && (
                                <span style={{ fontWeight: 400, color: 'var(--tx-muted)' }}> · by {changes.by}</span>
                            )}
                        </div>

                        {fields.map((f, i) => (
                            <div key={`f${i}`} style={{ padding: '3px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
                                <span style={{ fontWeight: 600 }}>{f.label}</span>{' '}
                                <span style={{ color: 'var(--tx-muted)', textDecoration: 'line-through' }}>{f.from}</span>
                                {' → '}
                                <span style={{ fontWeight: 600 }}>{f.to}</span>
                            </div>
                        ))}

                        {items.map((it, i) => {
                            const k = KIND_STYLE[it.kind];
                            return (
                                <div
                                    key={`i${i}`}
                                    style={{ padding: '3px 0', borderTop: (fields.length || i) ? '1px solid var(--border)' : undefined }}
                                >
                                    <span style={{
                                        background: k.bg, color: k.fg, borderRadius: 4,
                                        padding: '0 5px', fontSize: 10, fontWeight: 700, marginRight: 6,
                                    }}>
                                        {k.word.toUpperCase()}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{it.name}</span>
                                    {it.kind === 'changed' && (
                                        <>
                                            {' '}
                                            <span style={{ color: 'var(--tx-muted)', textDecoration: 'line-through' }}>{it.from}</span>
                                            {' → '}
                                            <span style={{ fontWeight: 600 }}>{it.to}</span>
                                        </>
                                    )}
                                    {it.kind === 'added' && <span style={{ color: 'var(--tx-muted)' }}> · {it.to}</span>}
                                    {it.kind === 'removed' && <span style={{ color: 'var(--tx-muted)' }}> · was {it.from}</span>}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </span>
    );
}
