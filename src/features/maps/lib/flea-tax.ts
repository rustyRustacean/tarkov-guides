// BSG's in-game flea-market tax formula, ported verbatim from
// `old/TarkovTrackerWB-main/src/lib/flea.js`'s `fleaTax` (itself the leaked
// C# formula, cross-checked against tarkov.dev). Personal modifiers (Intel
// Center 3, Hideout Management) are intentionally NOT applied - they'd
// mislead anyone who doesn't have them, so the raw tax is shown.

/** Flea listing tax in roubles for listing one `basePrice` item at `listPrice` (stack `count`). NaN-safe: 0 when inputs are missing/zero. */
export function fleaTax(basePrice: number, listPrice: number, count = 1): number {
  if (!basePrice || !listPrice) return 0;
  const quantity = Math.max(1, count);
  const ti = 0.05;
  const tr = 0.05;
  // The conditional `^1.08` only ever amplifies the POSITIVE log side; the
  // other side stays negative and `4^negative` is just a fraction - avoids
  // `Math.pow(negative, 1.08) = NaN`.
  let po = Math.log10(basePrice / listPrice);
  let pr = Math.log10(listPrice / basePrice);
  if (listPrice >= basePrice) pr = pr ** 1.08;
  else po = po ** 1.08;
  const tax = basePrice * ti * 4 ** po * quantity + listPrice * tr * 4 ** pr * quantity;
  return Math.round(tax);
}

/** What you actually pocket after flea tax - `listPrice * count` minus {@link fleaTax}, floored at 0. */
export function fleaNet(basePrice: number, listPrice: number, count = 1): number {
  const quantity = Math.max(1, count);
  return Math.max(0, listPrice * quantity - fleaTax(basePrice, listPrice, count));
}
