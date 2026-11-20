// Captures the screenshots the Resources hub shows for each community site.
//
//   node scripts/capture-community-previews.mjs               # every site
//   node scripts/capture-community-previews.mjs eft-boss      # only some, by id
//
// Writes public/images/community/<id>.jpg and updates
// src/features/resources/data/community-previews.json (size, capture date,
// and whether the page is long enough for the scroll-on-hover preview).
// Re-run it after a site redesigns, or each wipe. Needs network access and
// Playwright's Chromium (already installed for the e2e tests).
//
// A page counts as long enough to scroll when it's at least two screens
// tall; shorter pages get a single-screen still. Tall pages are cut at four
// screens, which is all the hover preview has time to show.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_DIR = join(root, "public", "images", "community");
const MANIFEST = join(root, "src", "features", "resources", "data", "community-previews.json");

const VIEWPORT = { width: 1280, height: 800 };
const SCROLL_MIN_HEIGHT = VIEWPORT.height * 2;
const MAX_CAPTURE_HEIGHT = VIEWPORT.height * 4;

/** Waits until every <img> on the page has finished loading (or failed), up to `timeout` ms. */
async function waitForImages(page, timeout = 15000) {
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout })
    .catch(() => undefined);
}

/** Clicks the first visible element matching `selector`, if there is one. */
async function clickIfVisible(page, selector) {
  const target = page.locator(selector).filter({ visible: true }).first();
  if ((await target.count()) > 0) await target.click();
}

/**
 * One entry per community site. `id` matches `CommunityResource.id` in
 * `data/resources.ts`; `url` must equal that entry's `url` (a test checks).
 * `prepare` runs after load, for site-specific setup.
 */
const TARGETS = [
  { id: "tarkov-dev", url: "https://tarkov.dev" },
  {
    id: "arena-maps",
    url: "https://arena-esports.com/en/maps/blastgang/fort",
    // The map is one large image that arrives after the page settles.
    prepare: async (page) => {
      await waitForImages(page);
      await page.waitForTimeout(1500);
    },
  },
  { id: "reemr-3d-maps", url: "https://reemr.se" },
  {
    id: "mrsouer-guides",
    url: "https://mrsouer.com/guides/eft",
    // Their dark theme matches ours; the Twitch popup would cover the list.
    prepare: async (page) => {
      await clickIfVisible(page, 'button[aria-label="Switch to dark theme"]');
      await clickIfVisible(page, 'button[aria-label="Close"]');
      await page.waitForTimeout(800);
    },
  },
  { id: "eft-boss", url: "https://eftboss.com" },
  { id: "tarkov-btr", url: "https://tarkovbtr.com" },
  { id: "db4tarkov", url: "https://db4tarkov.com" },
  { id: "tarkov-perks", url: "https://tarkovperks.com" },
  { id: "tarkov-changes", url: "https://changes.tarkov-changes.com/latest" },
];

/** Hides fixed-position cookie notices instead of accepting them. */
async function hideCookieBanners(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      const text = el.textContent ?? "";
      if (/cookie/i.test(text) && text.length < 600)
        el.style.setProperty("display", "none", "important");
    }
  });
}

/**
 * A full-page capture paints pinned elements once, at their spot in the
 * first screen, so a bottom bar or floating widget ends up stranded over
 * the middle of the image. Top headers are kept; everything else pinned
 * (fixed below the top edge, or sticky to the bottom) is hidden.
 */
async function hidePinnedOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      const strandedFixed = style.position === "fixed" && el.getBoundingClientRect().top > 5;
      const bottomSticky = style.position === "sticky" && style.bottom !== "auto";
      if (strandedFixed || bottomSticky) el.style.setProperty("display", "none", "important");
    }
  });
}

/** Scrolls to the bottom and back so lazy-loaded sections render before the capture. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.scrollingElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

async function capture(browser, target) {
  const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: "dark" });
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
    if (target.prepare) await target.prepare(page);
    await hideCookieBanners(page);
    await scrollThrough(page);
    await waitForImages(page);

    const pageHeight = await page.evaluate(() => document.scrollingElement.scrollHeight);
    const scroll = pageHeight >= SCROLL_MIN_HEIGHT;
    const height = scroll ? Math.min(pageHeight, MAX_CAPTURE_HEIGHT) : VIEWPORT.height;
    if (scroll) await hidePinnedOverlays(page);

    await page.screenshot({
      path: join(IMAGE_DIR, `${target.id}.jpg`),
      type: "jpeg",
      quality: 80,
      fullPage: scroll,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height },
    });
    console.log(
      `${target.id}: ${String(pageHeight)}px page, ${scroll ? "scroll" : "still"} ${String(height)}px`,
    );
    return {
      url: target.url,
      src: `/images/community/${target.id}.jpg`,
      width: VIEWPORT.width,
      height,
      scroll,
      capturedAt: new Date().toISOString().slice(0, 10),
    };
  } finally {
    await page.close();
  }
}

const only = new Set(process.argv.slice(2));
const unknown = [...only].filter((id) => !TARGETS.some((target) => target.id === id));
if (unknown.length > 0) {
  console.error(`Unknown id(s): ${unknown.join(", ")}`);
  process.exit(1);
}

mkdirSync(IMAGE_DIR, { recursive: true });
let manifest = {};
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch {
  // First run: no manifest yet.
}

const browser = await chromium.launch();
let failed = false;
for (const target of TARGETS) {
  if (only.size > 0 && !only.has(target.id)) continue;
  try {
    manifest[target.id] = await capture(browser, target);
  } catch (error) {
    failed = true;
    console.error(`${target.id}: failed, kept the previous capture. ${String(error)}`);
  }
}
await browser.close();

const ordered = Object.fromEntries(
  TARGETS.filter((target) => manifest[target.id]).map((target) => [target.id, manifest[target.id]]),
);
writeFileSync(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`);
if (failed) process.exit(1);
