interface HslColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Converts a `#rrggbb` hex string (the format every theme's `--accent`/
 * `--accent2` token uses in `globals.css`) to HSL. Used by `RiverHero` to
 * derive the particle gradient's hue/saturation/lightness from the active
 * theme's real tokens instead of a hardcoded, second-source-of-truth color
 * table. Falls back to a neutral grey if given a malformed value (defensive
 * only: every theme token is a well-formed hex literal today).
 */
export function hexToHsl(hex: string): HslColor {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return { h: 0, s: 0, l: 50 };

  // `noUncheckedIndexedAccess` types capture groups as possibly-`undefined`
  // even though the regex above guarantees exactly 3 groups on a match, so
  // the `?? "00"` fallback is unreachable in practice, just satisfying the
  // type checker without an assertion.
  const r = parseInt(match[1] ?? "00", 16) / 255;
  const g = parseInt(match[2] ?? "00", 16) / 255;
  const b = parseInt(match[3] ?? "00", 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;

  return { h, s: s * 100, l: l * 100 };
}
