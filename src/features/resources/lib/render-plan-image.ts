import { getImageProps } from "next/image";

import { assetPath } from "@/shared/lib/asset-cdn";

import { MODIFIER_ICON_SIZE } from "../data/seasonal-modifiers";

import {
  CanvasBlockedError,
  drawPlanImage,
  isPlanImageBackground,
  layoutPlanImage,
  pickScale,
  planImageFontSpecs,
  type PlanImageFonts,
  type PlanImageIcon,
  type PlanImageInput,
} from "./modifier-plan-image";

/**
 * Draws a plan with the Canvas API and returns it as a PNG, in the browser
 * only (no library: see Tech Stack). Not unit tested, since jsdom has no
 * canvas; the layout and drawing it calls are, and the result is checked
 * in a real browser.
 */

/** Bender and Inter, the Inventory theme's fonts, as `next/font` names them on `<html>`. */
function readFonts(): PlanImageFonts {
  const style = getComputedStyle(document.documentElement);
  const family = (variable: string, fallback: string) =>
    style.getPropertyValue(variable).trim() || fallback;
  return {
    display: family("--font-bender", "sans-serif"),
    body: family("--font-inter", "sans-serif"),
  };
}

/**
 * The icon's URL through Next's image optimizer, the same one the page's
 * cards use. It's same origin, so drawing it never taints the canvas (no
 * CORS on the asset CDN needed). This is the 2x size, right for a canvas
 * drawn at 2x: on a 2x screen the page already loaded it, and a 1x screen
 * fetches it once.
 */
function iconUrl(icon: string): string {
  return getImageProps({
    src: assetPath(icon),
    alt: "",
    width: MODIFIER_ICON_SIZE,
    height: MODIFIER_ICON_SIZE,
  }).props.src;
}

async function loadIcon(icon: string): Promise<[string, PlanImageIcon] | null> {
  const image = new Image();
  image.src = iconUrl(icon);
  try {
    await image.decode();
  } catch {
    // A missing icon leaves a gap rather than failing the whole image.
    return null;
  }
  return [icon, { source: image, width: image.naturalWidth, height: image.naturalHeight }];
}

/**
 * The plan as a PNG, drawn once its fonts and icons have loaded. Rejects
 * with {@link CanvasBlockedError} when the browser blocks reading the
 * canvas, and with a plain error when it can't draw or save one.
 */
export async function renderPlanImage(input: PlanImageInput): Promise<Blob> {
  const fonts = readFonts();
  const icons = [...new Set([...input.positive, ...input.negative].map((pick) => pick.icon))];
  const [loaded] = await Promise.all([
    Promise.all(icons.map(loadIcon)),
    ...planImageFontSpecs(fonts).map((font) => document.fonts.load(font)),
  ]);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  const layout = layoutPlanImage(
    input,
    (text, font) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    },
    fonts,
  );
  // Resizing resets the context, so this comes after measuring.
  const scale = pickScale(layout.width, layout.height);
  canvas.width = Math.ceil(layout.width * scale);
  canvas.height = Math.ceil(layout.height * scale);
  ctx.scale(scale, scale);
  drawPlanImage(ctx, layout, new Map(loaded.filter((entry) => entry !== null)));

  // The corners are always plain background. If they don't read back as
  // it, the browser is handing out made-up pixels, and the PNG would be too.
  const { width, height } = canvas;
  const corners = [
    [1, 1],
    [width - 2, 1],
    [1, height - 2],
    [width - 2, height - 2],
  ] as const;
  if (corners.some(([x, y]) => !isPlanImageBackground(ctx.getImageData(x, y, 1, 1).data))) {
    throw new CanvasBlockedError();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The canvas couldn't be saved as a PNG"));
    }, "image/png");
  });
}
