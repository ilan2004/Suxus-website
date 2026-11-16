import "server-only";

/**
 * Merge engine for re-importing Excel sheets.
 * Each row gets a key: the file's Entry ID when present, otherwise e.g. Date + Paid To + Amount
 * (trimmed, case-insensitive). Identical keys are told apart by their order ("#1", "#2"), so two
 * genuine identical rows (same day, same person, same amount) stay two rows.
 * Matching row → fields updated only if something changed; no match → inserted.
 */
export type MergeStats = { added: number; updated: number; unchanged: number };

export const keyText = (s: unknown) => (s == null ? "" : String(s)).trim().replace(/\s+/g, " ").toLowerCase();
export const keyAmount = (n: unknown) => Number(n ?? 0).toFixed(2);

/** Normalise a value for "did it change?" checks (keeps case — a corrected spelling counts as a change). */
function same(a: unknown, b: unknown) {
  const norm = (v: unknown) => {
    if (v == null || v === "") return "";
    if (typeof v === "number") return v.toFixed(2);
    if (typeof v === "boolean") return v ? "1" : "0";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim().replace(/\s+/g, " ");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s).toFixed(2) : s;
  };
  return norm(a) === norm(b);
}

function withOccurrence(keys: string[]) {
  const seen = new Map<string, number>();
  return keys.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return `${k}#${n}`;
  });
}

export async function mergeRows<V extends Record<string, unknown>>(opts: {
  /** loose: a weaker key (e.g. Date + Paid To) used only when an Entry ID is new and the row was also edited. */
  incoming: { key: string; loose?: string; entryId: string | null; values: V }[];
  existing: { id: number; entryId: string | null; key: string; loose?: string; values: Record<string, unknown> }[];
  /** Fields compared to decide "updated" vs "unchanged". */
  compare: (keyof V & string)[];
  insert: (values: V, entryId: string) => Promise<void>;
  update: (id: number, values: V, entryId: string) => Promise<void>;
  /** Optional last-chance match (e.g. rows imported earlier without a date). */
  fallback?: (row: { key: string; values: V }, free: { id: number; values: Record<string, unknown> }[]) => number | null;
}): Promise<MergeStats> {
  const stats: MergeStats = { added: 0, updated: 0, unchanged: 0 };
  const existing = [...opts.existing].sort((a, b) => a.id - b.id);
  const exFull = withOccurrence(existing.map((e) => e.key));
  const byEntry = new Map<string, (typeof existing)[number]>();
  const byFull = new Map<string, (typeof existing)[number]>();
  existing.forEach((e, i) => {
    if (e.entryId) byEntry.set(e.entryId, e);
    if (!byFull.has(exFull[i])) byFull.set(exFull[i], e);
  });
  const used = new Set<number>();
  const take = (e: (typeof existing)[number] | undefined) => (e && !used.has(e.id) ? e : undefined);
  const inFull = withOccurrence(opts.incoming.map((r) => r.key));

  for (const [i, row] of opts.incoming.entries()) {
    const fullKey = inFull[i];
    const storeKey = row.entryId ? `id:${keyText(row.entryId)}` : fullKey;
    let match = (row.entryId ? take(byEntry.get(storeKey)) : undefined) ?? take(byEntry.get(fullKey)) ?? take(byFull.get(fullKey));
    // An Entry ID seen for the first time, on a row that was also edited: accept a single same-day / same-party
    // row that has no Entry ID yet. If more than one fits, it is not guessed — the row is added instead.
    if (!match && row.entryId && row.loose) {
      const cands = existing.filter((e) => !used.has(e.id) && e.loose === row.loose && !(e.entryId ?? "").startsWith("id:"));
      if (cands.length === 1) match = cands[0];
    }
    if (!match && opts.fallback) {
      const free = existing.filter((e) => !used.has(e.id));
      const id = opts.fallback({ key: row.key, values: row.values }, free);
      match = id != null ? existing.find((e) => e.id === id) : undefined;
    }
    if (!match) {
      await opts.insert(row.values, storeKey);
      stats.added++;
      continue;
    }
    used.add(match.id);
    const changed = opts.compare.some((f) => f in row.values && !same(row.values[f], match!.values[f]));
    if (changed || match.entryId !== storeKey) await opts.update(match.id, row.values, storeKey);
    if (changed) stats.updated++;
    else stats.unchanged++;
  }
  return stats;
}

export const statLine = (s: MergeStats) => `${s.added} added, ${s.updated} updated, ${s.unchanged} unchanged`;
