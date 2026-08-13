/** Base ("order") tax rate. BSG's `Ti` constant. */
export const BASE_PRICE_TAX_RATE = 0.05;
/** List ("request/registration") tax rate. BSG's `Tr` constant. */
export const LIST_PRICE_TAX_RATE = 0.05;
/** Exponent applied to whichever price-ratio log is positive. */
export const PRICE_RATIO_EXPONENT = 1.08;
/** Base of the exponential amplification term. */
export const PRICE_RATIO_BASE = 4;

/**
 * Escape from Tarkov's flea market listing tax, ported from BSG's in-game
 * formula (leaked C#, verified against tarkov.dev's open source
 * implementation in `old/TarkovTrackerWB-main/src/lib/flea.js`).
 *
 * Deliberately skips the Intel Center 3 (-30%) and Hideout Management
 * skill (-0.3%/level) discounts, since those are personal, per-player
 * modifiers that would mislead anyone without them. Returns the raw tax a
 * fresh account would pay.
 *
 * @param basePrice - The item's base price (tarkov.dev's `basePrice` field).
 * @param listPrice - The price it's being listed at on the flea market.
 * @param count - Stack quantity. Defaults to 1; values below 1 are floored to 1.
 * @returns The tax in roubles, rounded to the nearest whole rouble. `0` if
 *   either price is zero/falsy.
 */
export function calculateFleaTax(basePrice: number, listPrice: number, count = 1): number {
  if (!basePrice || !listPrice) return 0;
  const quantity = Math.max(1, count || 1);

  // Conditional exponentiation only applies to the positive log value:
  // whichever side is above zero gets amplified. The other side stays
  // negative, and 4^negative is just a fraction. This avoids
  // Math.pow(negative, 1.08) producing NaN.
  let priceOffset = Math.log10(basePrice / listPrice);
  let priceRequirement = Math.log10(listPrice / basePrice);
  if (listPrice >= basePrice) {
    priceRequirement = Math.pow(priceRequirement, PRICE_RATIO_EXPONENT);
  } else {
    priceOffset = Math.pow(priceOffset, PRICE_RATIO_EXPONENT);
  }

  const tax =
    basePrice * BASE_PRICE_TAX_RATE * Math.pow(PRICE_RATIO_BASE, priceOffset) * quantity +
    listPrice * LIST_PRICE_TAX_RATE * Math.pow(PRICE_RATIO_BASE, priceRequirement) * quantity;
  return Math.round(tax);
}

/**
 * Net proceeds from a flea market sale: list price minus tax, clamped to
 * non-negative. Ported from `flea.js`'s `fleaNet`, with one correctness fix:
 * legacy floored `count` to 1 inside `fleaTax` but not in its own
 * gross-proceeds multiplication (`listPrice * (count||1)`), so a negative
 * `count` produced an inconsistent result (tax computed as count=1, gross
 * computed as negative and clamped to 0). This port applies the same
 * `Math.max(1, ...)` floor in both places.
 *
 * @param basePrice - The item's base price.
 * @param listPrice - The price it's being listed at on the flea market.
 * @param count - Stack quantity. Defaults to 1; values below 1 are floored to 1.
 * @returns The net roubles received, never negative.
 */
export function calculateFleaNet(basePrice: number, listPrice: number, count = 1): number {
  const quantity = Math.max(1, count || 1);
  const tax = calculateFleaTax(basePrice, listPrice, quantity);
  return Math.max(0, listPrice * quantity - tax);
}
