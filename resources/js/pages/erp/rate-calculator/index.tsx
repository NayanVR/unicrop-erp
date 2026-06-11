import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type PackagingMaterial = {
    id: number;
    name: string;
    category: string | null;
    unit: string;
    selling_rate: string | number;
};

type Props = {
    packagingMaterials: PackagingMaterial[];
};

const formatAmt = (v: number) =>
    '₹' + (Number.isFinite(v) ? v : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Match by keyword (case-insensitive substring) so renamed categories
// like "Box/Carton" -> "Box" or "Bottles" still get picked up.
const isBottleJar = (cat: string | null | undefined) => /bottle|botal|jar|dabba/i.test(cat ?? '');
const isOuterBox = (cat: string | null | undefined) => /box|carton|cartoon/i.test(cat ?? '');
const isOtherPackaging = (cat: string | null | undefined) =>
    /label|pouch|drum|cap|closure|print|pack|seal|tape|sticker/i.test(cat ?? '');

function groupByCategory(items: PackagingMaterial[]): [string, PackagingMaterial[]][] {
    const map = new Map<string, PackagingMaterial[]>();
    for (const m of items) {
        const key = m.category || 'Uncategorized';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
    }
    return [...map.entries()];
}

export default function RateCalculator({ packagingMaterials }: Props) {
    const [materialAmount, setMaterialAmount] = useState('');
    const [bottleId, setBottleId] = useState<string>('');
    const [outerBoxId, setOuterBoxId] = useState<string>('');
    const [unitsPerBox, setUnitsPerBox] = useState('1');
    const [extraIds, setExtraIds] = useState<number[]>([]);

    const bottleOptions = useMemo(
        () => packagingMaterials.filter((m) => isBottleJar(m.category)),
        [packagingMaterials],
    );

    const outerBoxOptions = useMemo(
        () => packagingMaterials.filter((m) => isOuterBox(m.category) && !isBottleJar(m.category)),
        [packagingMaterials],
    );

    const extraOptions = useMemo(
        () => packagingMaterials.filter(
            (m) => isOtherPackaging(m.category) && !isBottleJar(m.category) && !isOuterBox(m.category),
        ),
        [packagingMaterials],
    );

    // Fallback pools so a material is always findable even when its
    // category name doesn't match any keyword.
    const bottleFallback = useMemo(
        () => packagingMaterials.filter((m) => !isBottleJar(m.category)),
        [packagingMaterials],
    );

    const outerBoxFallback = useMemo(
        () => packagingMaterials.filter((m) => !(isOuterBox(m.category) && !isBottleJar(m.category))),
        [packagingMaterials],
    );

    const findMaterial = (id: string) => packagingMaterials.find((m) => String(m.id) === id);

    const bottleCost = useMemo(() => {
        const m = findMaterial(bottleId);
        return m ? Number(m.selling_rate) || 0 : 0;
    }, [bottleId, packagingMaterials]);

    const outerBoxCost = useMemo(() => {
        const m = findMaterial(outerBoxId);
        if (!m) return 0;
        const units = parseFloat(unitsPerBox) || 1;
        return (Number(m.selling_rate) || 0) / units;
    }, [outerBoxId, unitsPerBox, packagingMaterials]);

    const extraTotal = useMemo(() => {
        return extraIds.reduce((sum, id) => {
            const m = findMaterial(String(id));
            return sum + (m ? Number(m.selling_rate) || 0 : 0);
        }, 0);
    }, [extraIds, packagingMaterials]);

    const toggleExtra = (id: number) => {
        setExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const matAmt = parseFloat(materialAmount) || 0;
    const packagingCost = bottleCost + outerBoxCost + extraTotal;
    const finalRate = matAmt + packagingCost;

    return (
        <>
            <Head title="Product Rate Calculator" />
            <div id="view-rate-calc" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Product Rate Calculator</h1>
                        <p>Enter the material cost — packaging rates are pulled automatically from inventory</p>
                    </div>
                </div>

                <div className="rc-two-col">
                    {/* Left: Inputs */}
                    <div>
                        <div className="form-card">
                            <div className="form-card-title">💰 Material Cost</div>
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label>Material Amount (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="Enter material amount"
                                        value={materialAmount}
                                        onChange={(e) => setMaterialAmount(e.target.value)}
                                        step="0.01" min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-card" style={{ marginTop: '12px' }}>
                            <div className="form-card-title">🫙 Bottle / Jar (from Inventory)</div>
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label>Select Bottle / Jar</label>
                                    <select value={bottleId} onChange={(e) => setBottleId(e.target.value)}>
                                        <option value="">— None —</option>
                                        {groupByCategory(bottleOptions).map(([cat, items]) => (
                                            <optgroup key={cat} label={cat}>
                                                {items.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({formatAmt(Number(m.selling_rate) || 0)} / {m.unit})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                        {bottleFallback.length > 0 && (
                                            <optgroup label="— Other Materials —">
                                                {bottleFallback.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({formatAmt(Number(m.selling_rate) || 0)} / {m.unit})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-card" style={{ marginTop: '12px' }}>
                            <div className="form-card-title">📦 Outer Box (from Inventory)</div>
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label>Select Outer Box</label>
                                    <select value={outerBoxId} onChange={(e) => setOuterBoxId(e.target.value)}>
                                        <option value="">— None —</option>
                                        {groupByCategory(outerBoxOptions).map(([cat, items]) => (
                                            <optgroup key={cat} label={cat}>
                                                {items.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({formatAmt(Number(m.selling_rate) || 0)} / {m.unit})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                        {outerBoxFallback.length > 0 && (
                                            <optgroup label="— Other Materials —">
                                                {outerBoxFallback.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({formatAmt(Number(m.selling_rate) || 0)} / {m.unit})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Units per Box</label>
                                    <input
                                        type="number"
                                        value={unitsPerBox}
                                        onChange={(e) => setUnitsPerBox(e.target.value)}
                                        step="1" min="1"
                                        style={{ maxWidth: '120px' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {extraOptions.length > 0 && (
                            <div className="form-card" style={{ marginTop: '12px' }}>
                                <div className="form-card-title">🏷️ Other Packaging (from Inventory)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {extraOptions.map((m) => (
                                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={extraIds.includes(m.id)}
                                                onChange={() => toggleExtra(m.id)}
                                            />
                                            <span>{m.name}</span>
                                            <span style={{ marginLeft: 'auto', color: 'var(--tx-muted)' }}>
                                                {formatAmt(Number(m.selling_rate) || 0)} / {m.unit}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Output */}
                    <div>
                        <div className="form-card">
                            <div className="form-card-title">🧮 Final Rate</div>

                            <div className="rc-summary-bar">
                                <span>Material Amount:</span>
                                <strong>{formatAmt(matAmt)}</strong>
                            </div>
                            <div className="rc-summary-bar">
                                <span>Bottle / Jar Rate:</span>
                                <strong>{formatAmt(bottleCost)}</strong>
                            </div>
                            <div className="rc-summary-bar">
                                <span>Outer Box Rate (per unit):</span>
                                <strong>{formatAmt(outerBoxCost)}</strong>
                            </div>
                            <div className="rc-summary-bar">
                                <span>Other Packaging Rate:</span>
                                <strong>{formatAmt(extraTotal)}</strong>
                            </div>
                            <div className="rc-cost-bar">
                                <span>Final Rate:</span>
                                <strong style={{ fontSize: '16px' }}>{formatAmt(finalRate)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
