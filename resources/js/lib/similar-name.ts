// Fuzzy name-similarity helpers shared by Inventory, BOM, Filling etc.
// Catches typos ("atonik" vs "atonic") and variants with extra detail
// ("Atonic(Sodium O-Nitro Phenolate)" vs "Atonic").

export function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
    }
    return dp[m][n];
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Base name = part before any bracket / dash detail, e.g.
// "Atonic(Sodium O-Nitro Phenolate)" -> "atonic"
const baseName = (s: string) =>
    normalize(s.toLowerCase().split(/[({\[\-–—,/]/)[0]);

function fuzzyEq(na: string, nb: string): boolean {
    if (!na || !nb) return false;
    if (na === nb) return true;
    // containment (one is prefix/substring of the other, min length 4)
    if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
    const dist = levenshtein(na, nb);
    const threshold = Math.max(2, Math.round(Math.max(na.length, nb.length) * 0.2));
    return dist <= threshold;
}

export function isSimilarName(a: string, b: string): boolean {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return true;
    // full-string fuzzy
    if (fuzzyEq(na, nb)) return true;
    // base-name fuzzy: "atonik" vs "Atonic(Sodium O-Nitro Phenolate)"
    return fuzzyEq(baseName(a), baseName(b));
}

// Find similar existing names from a list (excluding an exact self-match)
export function findSimilar(name: string, existing: string[], excludeExact = true): string[] {
    const trimmed = name.trim();
    if (trimmed.length < 3) return [];
    return existing.filter((e) => {
        if (excludeExact && normalize(e) === normalize(trimmed)) return false;
        return isSimilarName(e, trimmed);
    });
}
