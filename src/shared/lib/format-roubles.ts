/**
 * Exact roubles, comma-grouped and rounded to the nearest whole rouble (e.g.
 * "15,000₽"). Pre-production audit (`CODE_AUDIT.md` finding 11) found this
 * exact line duplicated byte-for-byte in `ItemDetailDialog`, `ItemRow`, and
 * `MapValuablesPanel` - each site still owns its own null/zero-guard
 * wrapper (their "N/A"/"no data"/"-" conventions differ and aren't
 * consolidated here), only the actual formatting is shared.
 */
export function formatRoubles(value: number): string {
  return `${Math.round(value).toLocaleString()}₽`;
}

/** Compact roubles for at-a-glance UI (e.g. "1.18M₽", "37k₽", "412₽"). */
export function formatRoublesCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M₽`;
  if (value >= 1_000) return `${Math.round(value / 1000).toLocaleString()}k₽`;
  return `${String(Math.round(value))}₽`;
}
