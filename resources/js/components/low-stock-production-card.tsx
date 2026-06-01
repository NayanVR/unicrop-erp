import { index as bomIndex } from '@/routes/bom';
import { index as fillingIndex } from '@/routes/filling';
import { Link } from '@inertiajs/react';

type LowStockItem = {
    id: number;
    name: string;
    unit: string;
    stock_qty: number;
    min_stock: number;
    recipes: string[];
};

export type LowStockProduction = {
    bom: LowStockItem[];
    filling: LowStockItem[];
};

const fmtQty = (v: number) => {
    const n = Number(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

function Section({
    title,
    icon,
    items,
    href,
    color,
}: {
    title: string;
    icon: string;
    items: LowStockItem[];
    href: string;
    color: string;
}) {
    if (items.length === 0) return null;

    return (
        <div style={{ flex: '1 1 280px', minWidth: '260px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{icon}</span> {title}
                <span style={{ background: color, color: '#fff', borderRadius: '10px', padding: '1px 8px', fontSize: '11px' }}>
                    {items.length}
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((m) => (
                    <Link
                        key={m.id}
                        href={href}
                        style={{
                            display: 'block',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #fde68a',
                            background: '#fffbeb',
                            textDecoration: 'none',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937' }}>{m.name}</span>
                            <span style={{ fontWeight: 700, fontSize: '12px', color: '#dc2626', whiteSpace: 'nowrap' }}>
                                {fmtQty(m.stock_qty)} / {fmtQty(m.min_stock)} {m.unit}
                            </span>
                        </div>
                        {m.recipes.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                                🏭 Produce: {m.recipes.join(', ')}
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function LowStockProductionCard({ data }: { data: LowStockProduction | null }) {
    if (!data) return null;

    const total = data.bom.length + data.filling.length;
    if (total === 0) return null;

    return (
        <div className="card" style={{ marginBottom: '16px', borderLeft: '4px solid #d97706' }}>
            <div className="card-title" style={{ marginBottom: '14px' }}>
                ⚠️ Production Required — Low Stock
                <span className="ct-badge" style={{ background: '#d97706', color: '#fff' }}>{total}</span>
            </div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <Section title="BOM Products" icon="⚗️" items={data.bom} href={bomIndex().url} color="#7c3aed" />
                <Section title="Filling Products" icon="🧪" items={data.filling} href={fillingIndex().url} color="#0891b2" />
            </div>
        </div>
    );
}
