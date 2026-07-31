#!/usr/bin/env node
/**
 * One-off, developer-run tool - NOT part of the app build/runtime/CI.
 *
 * Fetches each listed quest's wiki page (the EFT Fandom wiki), pulls the
 * screenshot galleries out of the page's prose "Guide" section (tarkov.dev's
 * own API has zero per-objective image data, and the wiki's own bare
 * "Objectives" bullet list has no images either - only the separate "Guide"
 * section does, as MediaWiki `<ul class="gallery">` blocks with a caption
 * per image), and prints a draft TS object literal to stdout.
 *
 * This output is a DRAFT, not the source of truth - review it by hand
 * (trim irrelevant images, fix captions, drop bad matches) before pasting
 * the result into `src/shared/data/quest-guide-images.ts`. The wiki sits
 * behind Cloudflare bot-protection that intermittently challenges plain
 * requests (confirmed during development - one page in five or so comes
 * back as a "Just a moment..." challenge instead of the real page) - this
 * script does NOT retry aggressively against that (retrying is what
 * escalates bot detection); a challenged quest is just skipped and logged
 * for a manual re-run later.
 *
 * Usage: node scripts/scrape-quest-guide-images.mjs
 *
 * Fetches by shelling out to `curl`, not Node's built-in `fetch` - confirmed
 * during development that Cloudflare 403s Node's `fetch` (undici) outright
 * on this exact site while `curl` with a real-browser User-Agent gets
 * through, almost certainly TLS/HTTP client fingerprinting rather than
 * anything about the request itself. Requires `curl` on `PATH`.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { JSDOM } from "jsdom";

const execFileAsync = promisify(execFile);

const REQUEST_DELAY_MS = 1500;
const MAX_IMAGES_PER_QUEST = 4;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * Starting batch: early Prapor/Therapist/Skier quests (level <= 12) whose
 * objectives are location-based (tarkov.dev's `zones`/`possibleLocations`
 * present) - the ones a map-marker screenshot actually helps with, picked
 * via a live tarkov.dev fetch during planning. Pure kill/handover quests
 * (e.g. "Debut") are deliberately excluded - checked live, their wiki
 * Guide sections have no gallery images at all.
 */
const QUESTS = [
  { taskId: "657315ddab5a49b71f098853", wikiSlug: "First_in_Line" },
  { taskId: "657315df034d76585f032e01", wikiSlug: "Shooting_Cans" },
  { taskId: "657315e1dccd301f1301416a", wikiSlug: "Luxurious_Life" },
  { taskId: "5936da9e86f7742d65037edf", wikiSlug: "Background_Check" },
  { taskId: "5fd9fad9c1ce6b1a3b486d00", wikiSlug: "Search_Mission" },
  { taskId: "59674eb386f774539f14813a", wikiSlug: "Delivery_From_the_Past" },
  { taskId: "59c124d686f774189b3c843f", wikiSlug: "BP_Depot" },
  { taskId: "59689fbd86f7740d137ebfc4", wikiSlug: "Operation_Aquarius_-_Part_1" },
  { taskId: "5967530a86f77462ba22226b", wikiSlug: "Bad_Rep_Evidence" },
  { taskId: "596b43fb86f77457ca186186", wikiSlug: "The_Extortionist" },
  { taskId: "5979eee086f774311955e614", wikiSlug: "Golden_Swag" },
  { taskId: "59675d6c86f7740a842fc482", wikiSlug: "Ice_Cream_Cones" },
  { taskId: "5969f9e986f7741dde183a50", wikiSlug: "Pharmacist" },
  { taskId: "59675ea386f77414b32bded2", wikiSlug: "Postman_Pat_-_Part_1" },
  { taskId: "597a160786f77477531d39d2", wikiSlug: "Out_of_Curiosity" },
  { taskId: "597a171586f77405ba6887d3", wikiSlug: "Big_Customer" },
  { taskId: "639135d89444fb141f4e6eea", wikiSlug: "Population_Census" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCloudflareChallenge(html) {
  return html.includes("<title>Just a moment...</title>");
}

/**
 * Extracts every `.gallery .gallerybox` image+caption pair that appears
 * between the `id="Guide"` heading and the next `<h2>` (or end of the
 * article) - scoped this way so galleries elsewhere on the page (e.g. an
 * unrelated "Related Quest Items" icon table) never get swept in.
 */
function extractGuideImages(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const guideHeading = document.getElementById("Guide");
  if (!guideHeading) return [];

  // The heading id lives on a <span> inside the real <h2> - walk up to it.
  const sectionHeader = guideHeading.closest("h2") ?? guideHeading;

  const images = [];
  let node = sectionHeader.nextElementSibling;
  while (node && node.tagName !== "H2" && images.length < MAX_IMAGES_PER_QUEST) {
    for (const box of node.querySelectorAll(".gallerybox")) {
      if (images.length >= MAX_IMAGES_PER_QUEST) break;
      const img = box.querySelector("img");
      const captionEl = box.querySelector(".gallerytext");
      if (!img) continue;
      const src = img.getAttribute("data-src") ?? img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      const caption = captionEl?.textContent.trim() || img.getAttribute("alt") || "";
      images.push({ src, caption });
    }
    node = node.nextElementSibling;
  }
  return images;
}

async function fetchGuideImages({ taskId, wikiSlug }) {
  const url = `https://escapefromtarkov.fandom.com/wiki/${wikiSlug}`;
  let html;
  try {
    const { stdout } = await execFileAsync("curl", ["-sf", url, "-A", USER_AGENT], {
      maxBuffer: 10 * 1024 * 1024,
    });
    html = stdout;
  } catch (error) {
    console.error(`[skip] ${wikiSlug}: curl failed - ${String(error)}`);
    return null;
  }
  if (isCloudflareChallenge(html)) {
    console.error(`[skip] ${wikiSlug}: Cloudflare challenge - re-run later`);
    return null;
  }
  const images = extractGuideImages(html);
  if (images.length === 0) {
    console.error(`[skip] ${wikiSlug}: no Guide-section gallery images found`);
    return null;
  }
  return { taskId, wikiSlug, images };
}

async function main() {
  const results = [];
  for (const quest of QUESTS) {
    const result = await fetchGuideImages(quest);
    if (result) results.push(result);
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\n// ${String(results.length)}/${String(QUESTS.length)} quests yielded images - review before merging.\n`,
  );
  console.log(
    "export const QUEST_GUIDE_IMAGES: Readonly<Record<string, readonly QuestGuideImage[]>> = {",
  );
  for (const { taskId, wikiSlug, images } of results) {
    console.log(`  // ${wikiSlug}`);
    console.log(`  "${taskId}": [`);
    for (const image of images) {
      const caption = image.caption.replace(/"/g, '\\"');
      console.log(`    { src: "${image.src}", caption: "${caption}" },`);
    }
    console.log("  ],");
  }
  console.log("};");
}

await main();
