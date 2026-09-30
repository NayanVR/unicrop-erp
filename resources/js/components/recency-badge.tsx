import { recencyOf } from '@/lib/recency';

/**
 * Small pill shown next to a BOM / recipe / product name.
 * Renders nothing once the record is older than the recency window.
 */
export default function RecencyBadge({
    createdAt,
    updatedAt,
    style,
}: {
    createdAt?: string | null;
    updatedAt?: string | null;
    style?: React.CSSProperties;
}) {
    const r = recencyOf(createdAt, updatedAt);
    if (!r) return null;

    const isNew = r.kind === 'new';

    return (
        <span
            title={`${r.label} on ${r.date}`}
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
                ...style,
            }}
        >
            {isNew ? '🆕' : '✏️'} {r.label.toUpperCase()}
            <span style={{ fontWeight: 500, opacity: 0.85 }}>· {r.date}</span>
        </span>
    );
}
