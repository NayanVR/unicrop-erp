import { useEffect, useRef, useState } from 'react';

type Option = { value: string | number; label: string };

type Props = {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
};

export default function SearchableSelect({ options, value, onChange, placeholder = '— Select —', disabled = false }: Props) {
    const [open, setOpen]     = useState(false);
    const [query, setQuery]   = useState('');
    const containerRef        = useRef<HTMLDivElement>(null);
    const inputRef            = useRef<HTMLInputElement>(null);

    const selected = options.find((o) => String(o.value) === String(value));

    const filtered = query.trim()
        ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
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
                <span
                    style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        pointerEvents: 'none', color: 'var(--tx-muted)', fontSize: 11,
                    }}
                >▾</span>
            </div>

            {open && (
                <div style={{
                    position: 'absolute', zIndex: 9999, top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
                    marginTop: 2,
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tx-muted)' }}>No results</div>
                    ) : filtered.map((opt) => (
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
