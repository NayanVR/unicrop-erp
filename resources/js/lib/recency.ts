// "New" / "Updated" recency, worked out purely from a row's timestamps.
//
// A record counts as New for a month after it is created, and Updated for a
// month after someone changes it — whichever happened last is what shows.

/** How long a record keeps its badge. */
export const RECENCY_WINDOW_DAYS = 30;

// Creation writes created_at and updated_at in the same statement, so a real
// edit is anything more than a minute apart.
const EDIT_THRESHOLD_MS = 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export type Recency =
    | { kind: 'new' | 'updated'; label: string; date: string; days: number }
    | null;

/** Which badge (if any) a record has earned right now. */
export function recencyOf(createdAt?: string | null, updatedAt?: string | null): Recency {
    if (!createdAt) return null;

    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return null;

    const updated = updatedAt ? new Date(updatedAt) : null;
    const edited = !!updated
        && !Number.isNaN(updated.getTime())
        && updated.getTime() - created.getTime() > EDIT_THRESHOLD_MS;

    const stamp = edited ? (updated as Date) : created;
    const days = Math.floor((Date.now() - stamp.getTime()) / DAY_MS);

    if (days >= RECENCY_WINDOW_DAYS || days < 0) return null;

    return {
        kind: edited ? 'updated' : 'new',
        label: edited ? 'Updated' : 'New',
        date: fmtDate(stamp),
        days,
    };
}
