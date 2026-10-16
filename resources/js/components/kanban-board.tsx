import type { ReactNode } from 'react';

export type KanbanColumn = {
    /** Matches whatever columnOf() returns for an item. */
    key: string;
    label: string;
    /** Accent colour for the column header and its cards' left edge. */
    accent: string;
};

/**
 * A read-only pipeline board: one vertical lane per stage, cards stacked
 * inside it. Each page supplies its own stages and card contents.
 */
export default function KanbanBoard<T>({
    columns,
    items,
    columnOf,
    keyOf,
    renderCard,
    onCardClick,
    emptyText = 'Nothing here',
}: {
    columns: KanbanColumn[];
    items: T[];
    columnOf: (item: T) => string;
    keyOf: (item: T) => string | number;
    renderCard: (item: T) => ReactNode;
    onCardClick?: (item: T) => void;
    emptyText?: string;
}) {
    const grouped = new Map<string, T[]>(columns.map((c) => [c.key, []]));

    for (const item of items) {
        grouped.get(columnOf(item))?.push(item);
    }

    return (
        <div className="kanban">
            {columns.map((col) => {
                const cards = grouped.get(col.key) ?? [];

                return (
                    <section key={col.key} className="kanban-col">
                        <header className="kanban-col-head">
                            <span className="kanban-col-title">{col.label}</span>
                            <span className="kanban-col-count" style={{ background: `${col.accent}1f`, color: col.accent }}>
                                {cards.length}
                            </span>
                        </header>

                        <div className="kanban-col-body">
                            {cards.length === 0 ? (
                                <p className="kanban-empty">{emptyText}</p>
                            ) : cards.map((item) => (
                                <article
                                    key={keyOf(item)}
                                    className={`kanban-card${onCardClick ? ' is-clickable' : ''}`}
                                    style={{ borderLeftColor: col.accent }}
                                    onClick={onCardClick ? () => onCardClick(item) : undefined}
                                >
                                    {renderCard(item)}
                                </article>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

/** List / board switch shown above a page's records. */
export function ViewToggle({
    view,
    onChange,
}: {
    view: 'list' | 'board';
    onChange: (v: 'list' | 'board') => void;
}) {
    return (
        <div className="view-toggle">
            {(['list', 'board'] as const).map((v) => (
                <button
                    key={v}
                    type="button"
                    className={view === v ? 'active' : undefined}
                    onClick={() => onChange(v)}
                    title={v === 'list' ? 'List view' : 'Board view'}
                >
                    {v === 'list' ? '☰' : '▦'} {v === 'list' ? 'List' : 'Board'}
                </button>
            ))}
        </div>
    );
}
