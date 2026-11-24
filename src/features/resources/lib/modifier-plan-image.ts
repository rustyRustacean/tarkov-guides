import {
  formatGained,
  formatModifierPoints,
  formatSpent,
  type PlanStatus,
  type PlanStatusTone,
  type PointSummary,
} from "./modifier-plan";

/**
 * The shareable PNG of a modifier plan, in two steps so the layout can be
 * tested without a canvas (jsdom has none): {@link layoutPlanImage} turns a
 * plan into positioned draw steps using only a text-measuring function,
 * and {@link drawPlanImage} plays those steps onto any 2D context.
 *
 * The image has a fixed width and a fixed dark palette (the Inventory
 * theme's), so it looks the same whatever theme or screen made it. Picks
 * are cards like BSG's announcement: positive on the left, negative on the
 * right, then the balance, any clashes, and the plan's share link.
 */

export interface PlanImageModifier {
  name: string;
  points: number;
  effects: readonly string[];
  /** Icon path under `public/`; also the key into the loaded icons. */
  icon: string;
}

export interface PlanImageInput {
  title: string;
  subtitle: string;
  positive: readonly PlanImageModifier[];
  negative: readonly PlanImageModifier[];
  points: PointSummary;
  status: PlanStatus;
  /** One line per clash, already worded. */
  clashes: readonly string[];
  /** Shown at the bottom: the plan's share link. */
  footer: string;
  /** Small print under the link, such as where the values come from. */
  note: string;
}

/** CSS font families for the card names and the body text. */
export interface PlanImageFonts {
  display: string;
  body: string;
}

/** Every font the image uses, as canvas font strings. */
function imageFonts({ display, body }: PlanImageFonts) {
  return {
    title: `700 40px ${display}`,
    name: `700 19px ${display}`,
    heading: `700 18px ${display}`,
    label: `600 15px ${body}`,
    status: `600 16px ${body}`,
    body: `400 15px ${body}`,
    small: `400 13px ${body}`,
  } as const;
}

/** The font strings to load before drawing, so the canvas never falls back mid-draw. */
export function planImageFontSpecs(fonts: PlanImageFonts): readonly string[] {
  return Object.values(imageFonts(fonts));
}

export type DrawOp =
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      radius: number;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      font: string;
      color: string;
      align: "left" | "right";
    }
  | { kind: "image"; x: number; y: number; size: number; src: string };

export interface PlanImageLayout {
  width: number;
  height: number;
  ops: readonly DrawOp[];
}

/** A loaded icon with its natural size, so it can be fitted without stretching. */
export interface PlanImageIcon {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** The parts of a 2D context the drawing uses, so tests can pass a fake. */
export type PlanImageContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "fillRect"
  | "beginPath"
  | "roundRect"
  | "fill"
  | "fillText"
  | "drawImage"
>;

/** The Inventory theme's colors (`globals.css`). */
const COLORS = {
  background: "#1a1a1c",
  card: "#232325",
  rule: "#3a3a3f",
  text: "#e8e6e0",
  text2: "#a09e97",
  text3: "#6c6a64",
  green: "#6cb04a",
  greenTint: "rgba(108, 176, 74, 0.08)",
  red: "#d04545",
  redTint: "rgba(208, 69, 69, 0.09)",
  amber: "#d4a548",
} as const;

const TONES: Readonly<Record<PlanStatusTone, string>> = {
  red: "#e26c5e",
  amber: COLORS.amber,
  green: "#8fd06a",
  muted: COLORS.text2,
};

/** `COLORS.background` as RGB. */
const BACKGROUND_RGB = [0x1a, 0x1a, 0x1c] as const;

/**
 * How far a read-back background pixel may drift and still count. Brave's
 * default mode nudges canvas reads by a step or two, and that image is
 * still fine.
 */
const BACKGROUND_TOLERANCE = 6;

/**
 * Whether a pixel read back from the canvas (RGBA) is the image's own
 * background. Browsers that block canvas reads against fingerprinting
 * (Firefox's resist-fingerprinting mode, LibreWolf, Tor and Mullvad,
 * Brave's Strict mode, extensions like CanvasBlocker) hand back made-up
 * pixels instead, so checking a corner tells a real image from a fake one.
 */
export function isPlanImageBackground(pixel: ArrayLike<number>): boolean {
  if (pixel[3] !== 255) return false;
  return BACKGROUND_RGB.every(
    (channel, index) => Math.abs((pixel[index] ?? -255) - channel) <= BACKGROUND_TOLERANCE,
  );
}

/** Thrown when the browser hands back made-up pixels instead of the drawn image. */
export class CanvasBlockedError extends Error {
  constructor() {
    super("The browser blocked reading the canvas");
    this.name = "CanvasBlockedError";
  }
}

/** iOS Safari's largest canvas (4096 x 4096 pixels); a bigger one draws nothing. */
export const MAX_CANVAS_PIXELS = 16_777_216;

/**
 * Pixels per layout unit: 2x so the image stays sharp when zoomed, less
 * only when a very tall plan would pass {@link MAX_CANVAS_PIXELS}.
 */
export function pickScale(width: number, height: number): number {
  const largest = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  // Rounded down, so the rounded-up canvas size still fits.
  return Math.min(2, Math.floor(largest * 100) / 100);
}

const WIDTH = 1200;
const PAD = 40;
const COLUMN_GAP = 24;
const COLUMN = (WIDTH - 2 * PAD - COLUMN_GAP) / 2;
const CARD_PAD = 14;
const CARD_GAP = 10;
const ICON = 48;
const TEXT_X = CARD_PAD + ICON + 14;
const TEXT_WIDTH = COLUMN - TEXT_X - CARD_PAD;
const BULLET_INDENT = 14;
const NAME_LINE = 24;
const BODY_LINE = 20;

/**
 * Splits `text` into lines no wider than `maxWidth`, breaking at spaces,
 * and inside a word only when the word alone is too wide (a long link).
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    let rest = word;
    while (rest.length > 1 && measure(rest) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

/** Positions everything in the image. `measure` returns a string's width in `font`. */
export function layoutPlanImage(
  input: PlanImageInput,
  measure: (text: string, font: string) => number,
  fonts: PlanImageFonts,
): PlanImageLayout {
  const ops: DrawOp[] = [];
  const font = imageFonts(fonts);
  const nameFont = font.name;
  const headingFont = font.heading;
  const bodyFont = font.body;
  const wrap = (text: string, width: number, textFont: string) =>
    wrapText(text, width, (part) => measure(part, textFont));
  const text = (
    x: number,
    y: number,
    value: string,
    textFont: string,
    color: string,
    align: "left" | "right" = "left",
  ) => {
    ops.push({ kind: "text", x, y, text: value, font: textFont, color, align });
  };
  const rect = (x: number, y: number, width: number, height: number, color: string, radius = 0) => {
    ops.push({ kind: "rect", x, y, width, height, color, radius });
  };

  // Header: what this is on the left, the balance on the right.
  const right = WIDTH - PAD;
  text(PAD, PAD, input.subtitle.toUpperCase(), font.label, COLORS.text3);
  text(PAD, PAD + 22, input.title.toUpperCase(), font.title, COLORS.text);
  const { gained, spent, balance } = input.points;
  text(
    right,
    PAD,
    `Gained ${formatGained(gained)}   Spent ${formatSpent(spent)}`,
    bodyFont,
    COLORS.text2,
    "right",
  );
  text(right, PAD + 22, `Balance ${String(balance)}`, font.title, COLORS.text, "right");
  text(right, PAD + 68, input.status.text, font.status, TONES[input.status.tone], "right");

  function column(
    x: number,
    top: number,
    title: string,
    color: string,
    tint: string,
    picks: readonly PlanImageModifier[],
  ): number {
    text(x, top, `${title} (${String(picks.length)})`, headingFont, color);
    rect(x, top + 26, COLUMN, 2, color);
    let y = top + 40;
    if (picks.length === 0) {
      text(x, y, "Nothing picked", bodyFont, COLORS.text3);
      return y + BODY_LINE;
    }
    for (const pick of picks) {
      const nameLines = wrap(
        `${pick.name} ${formatModifierPoints(pick.points)}`.toUpperCase(),
        TEXT_WIDTH,
        nameFont,
      );
      const effectLines = pick.effects.flatMap((effect) =>
        wrap(effect, TEXT_WIDTH - BULLET_INDENT, bodyFont).map((line, index) => ({
          line,
          first: index === 0,
        })),
      );
      const textHeight = nameLines.length * NAME_LINE + 4 + effectLines.length * BODY_LINE;
      const height = 2 * CARD_PAD + Math.max(ICON, textHeight);
      rect(x, y, COLUMN, height, COLORS.card, 6);
      rect(x, y, COLUMN, height, tint, 6);
      rect(x, y + 6, 3, height - 12, color);
      ops.push({ kind: "image", x: x + CARD_PAD, y: y + CARD_PAD, size: ICON, src: pick.icon });
      let lineY = y + CARD_PAD;
      for (const line of nameLines) {
        text(x + TEXT_X, lineY, line, nameFont, COLORS.text);
        lineY += NAME_LINE;
      }
      lineY += 4;
      for (const { line, first } of effectLines) {
        if (first) text(x + TEXT_X, lineY, "•", bodyFont, COLORS.text3);
        text(x + TEXT_X + BULLET_INDENT, lineY, line, bodyFont, COLORS.text2);
        lineY += BODY_LINE;
      }
      y += height + CARD_GAP;
    }
    return y - CARD_GAP;
  }

  const top = PAD + 104;
  let y = Math.max(
    column(PAD, top, "PERSONAL POSITIVE", COLORS.green, COLORS.greenTint, input.positive),
    column(
      PAD + COLUMN + COLUMN_GAP,
      top,
      "PERSONAL NEGATIVE",
      COLORS.red,
      COLORS.redTint,
      input.negative,
    ),
  );

  const fullWidth = WIDTH - 2 * PAD;
  if (input.clashes.length > 0) {
    y += 28;
    text(PAD, y, "CLASHES", headingFont, COLORS.amber);
    y += 28;
    for (const clash of input.clashes) {
      for (const line of wrap(clash, fullWidth, bodyFont)) {
        text(PAD, y, line, bodyFont, COLORS.text2);
        y += BODY_LINE;
      }
    }
  }

  y += 24;
  rect(PAD, y, fullWidth, 1, COLORS.rule);
  y += 14;
  for (const line of wrap(input.footer, fullWidth, bodyFont)) {
    text(PAD, y, line, bodyFont, COLORS.text2);
    y += BODY_LINE;
  }
  text(PAD, y + 2, input.note, font.small, COLORS.text3);
  y += 2 + BODY_LINE;

  return { width: WIDTH, height: Math.ceil(y + PAD), ops };
}

/** Plays a layout onto `ctx`. Icons missing from `icons` (failed to load) are left out. */
export function drawPlanImage(
  ctx: PlanImageContext,
  layout: PlanImageLayout,
  icons: ReadonlyMap<string, PlanImageIcon>,
): void {
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  for (const op of layout.ops) {
    if (op.kind === "rect") {
      ctx.fillStyle = op.color;
      if (op.radius > 0) {
        ctx.beginPath();
        ctx.roundRect(op.x, op.y, op.width, op.height, op.radius);
        ctx.fill();
      } else {
        ctx.fillRect(op.x, op.y, op.width, op.height);
      }
    } else if (op.kind === "text") {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else {
      const icon = icons.get(op.src);
      if (!icon) continue;
      // Fitted inside the square like the page's object-contain, never stretched.
      const scale = op.size / Math.max(icon.width, icon.height, 1);
      const width = icon.width * scale;
      const height = icon.height * scale;
      ctx.drawImage(
        icon.source,
        op.x + (op.size - width) / 2,
        op.y + (op.size - height) / 2,
        width,
        height,
      );
    }
  }
}
