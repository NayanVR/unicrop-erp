import { useEffect, useRef, useState } from 'react';

type Option = { value: string | number; label: string };

type Props = {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
};

function editDistance(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

// Returns a score > 0 if the option matches the query, -1 if not.
// Higher score = better match. Results are sorted by score descending.
function fuzzyScore(label: string, query: string): number {
    const h = label.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return 1;

    // Exact substring → best
    if (h.includes(q)) return 100;

    const qWords = q.split(/\s+/).filter(Boolean);
    const lWords = h.split(/[\s,()[\]/]+/).filter(Boolean);

    // All query words found as substrings anywhere in label
    if (qWords.every((qw) => h.includes(qw))) return 80;

    // Per-word fuzzy: each query word must match some label word
    let totalScore = 0;
    for (const qw of qWords) {
        let best = -1;
        for (const lw of lWords) {
            if (lw.includes(qw) || qw.includes(lw)) { best = 60; break; }
            if (qw.length >= 3) {
                // Compare against label word prefix of similar length to avoid penalising long label words
                const slice = lw.substring(0, qw.length + 1);
                const dist  = editDistance(qw, slice);
                if (dist === 1) best = Math.max(best, 45);
                else if (dist === 2 && qw.length >= 5) best = Math.max(best, 25);
            }
        }
        if (best === -1) return -1;
        totalScore += best;
    }
    return totalScore / qWords.length;
}

export default function SearchableSelect({ options, value, onChange, placeholder = '— Select —', disabled = false }: Props) {
    const [open, setOpen]   = useState(false);
    const [query, setQuery] = useState('');
    const containerRef      = useRef<HTMLDivElement>(null);
    const inputRef          = useRef<HTMLInputElement>(null);

    const selected = options.find((o) => String(o.value) === String(value));

    const scored = query.trim()
        ? options
            .map((o) => ({ o, score: fuzzyScore(o.label, query) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => x.o)
        : options;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const select = (opt: Option) => {
        onChange(String(opt.value));
        setOpen(false);
        setQuery('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        if (!open) setOpen(true);
    };

    const handleFocus = () => {
        setOpen(true);
        setQuery('');
    };

    const displayValue = open ? query : (selected?.label ?? '');

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    placeholder={selected ? '' : placeholder}
                    disabled={disabled}
                    style={{ width: '100%', paddingRight: 28, cursor: disabled ? 'not-allowed' : 'text' }}
                    autoComplete="off"
                />
                <span style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', color: 'var(--tx-muted)', fontSize: 11,
                }}>▾</span>
            </div>

            {open && (
                <div style={{
                    position: 'absolute', zIndex: 9999, top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
                    marginTop: 2,
                }}>
                    {scored.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tx-muted)' }}>No results</div>
                    ) : scored.map((opt) => (
                        <div
                            key={opt.value}
                            onMouseDown={() => select(opt)}
                            style={{
                                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                                background: String(opt.value) === String(value) ? '#eff6ff' : undefined,
                                fontWeight: String(opt.value) === String(value) ? 600 : undefined,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = String(opt.value) === String(value) ? '#eff6ff' : '')}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
