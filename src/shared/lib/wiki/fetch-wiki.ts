// Pulls a task's Guide-section text + screenshots from the EFT fandom wiki,
// ported from `old/TarkovTrackerWB-main/src/lib/wiki.js`. The MediaWiki
// `action=parse` API serves anonymous CORS (`origin=*`), so this runs
// client-side. Only text content and image URLs are extracted (never raw
// HTML injected), so there's no XSS surface. Degrades to empty on any
// failure.

const WIKI_API = "https://escapefromtarkov.fandom.com/api.php";

export interface WikiImage {
  src: string;
  caption: string;
  /**
   * The Guide section's own `<h3>`/`<h4>` subsection this image came from
   * (e.g. Shooting Cans' "Utyos"/"AGS", one gallery per named objective) -
   * `undefined` for images that appear before any such heading (a lone
   * overview map covering the whole quest).
   */
  section?: string;
}

export interface WikiGuideData {
  /** The Guide/Walkthrough/Strategy section's own prose - each subsection heading is included as its own line, ahead of that subsection's paragraphs. */
  text: string;
  images: readonly WikiImage[];
}

/** Wiki page slug from a task's `wikiLink` (last path segment, decoded), else the task name underscored. */
export function wikiSlugFromLink(wikiLink: string | null, fallbackName: string): string {
  if (wikiLink) {
    const last = wikiLink.split("/").pop() ?? "";
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return fallbackName.replace(/\s+/g, "_");
}

async function fetchWikiDoc(slug: string): Promise<Document | null> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(slug)}&format=json&origin=*&prop=text`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const json: unknown = await response.json();
  const html =
    typeof json === "object" && json !== null
      ? ((json as { parse?: { text?: { "*"?: unknown } } }).parse?.text?.["*"] ?? "")
      : "";
  if (typeof html !== "string" || html.length === 0) return null;
  return new DOMParser().parseFromString(html, "text/html");
}

/** Best real URL for a lazy-loaded fandom `<img>` - fandom often serves a 1x1 placeholder in `src`, with the real URL in `data-src`/`srcset`/the parent anchor. */
function realImageSrc(img: Element, box: Element): string {
  const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset") ?? "";
  const fromSrcset = srcset
    ? ((
        srcset
          .split(",")
          .map((entry) => entry.trim())
          .pop() ?? ""
      ).split(/\s+/)[0] ?? "")
    : "";
  const anchorHref = box.querySelector("a")?.getAttribute("href") ?? "";
  const candidates = [
    img.getAttribute("data-src"),
    img.getAttribute("data-image-src"),
    fromSrcset,
    img.getAttribute("src"),
    anchorHref,
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith("data:") || !/^https?:/i.test(candidate)) continue;
    // Full original resolution, not the deliberately-small thumbnail these
    // attributes otherwise point at - the same Fandom URL convention
    // `quest-guide-images.ts` (this project's earlier, since-retired
    // curated-data approach) documented and confirmed live.
    return candidate
      .replace(/\/scale-to-width-down\/\d+/, "")
      .replace(/\/scale-to-height-down\/\d+/, "")
      .replace(/\/smart\/width\/\d+\/height\/\d+/, "")
      .replace(/\/thumb\//, "/");
  }
  return "";
}

function headingText(heading: Element): string {
  return (heading.querySelector(".mw-headline") ?? heading).textContent
    .replace(/\[edit\]/gi, "")
    .trim();
}

/**
 * Walks a wiki page's Guide/Walkthrough/Strategy section (a top-level
 * `<h2>`, ending at the next `<h2>` or the end of the article), collecting
 * prose paragraphs and every gallery image in one pass - a single shared
 * walk for both, rather than two separate functions each fetching and
 * parsing the same page independently (the previous shape here, before
 * this file's 2026-08-02 rewrite - confirmed live it was making 2 wiki API
 * requests per quest dialog open instead of 1).
 *
 * Handles two real bugs in that previous shape, both confirmed against
 * this wiki's actual current markup:
 * - `<h3>`/`<h4>` subsections *within* Guide (e.g. Shooting Cans'
 *   "Utyos"/"AGS", one gallery per objective) used to end text collection
 *   immediately (any non-Guide heading, any level, was treated as "Guide is
 *   over") - only another `<h2>` genuinely ends the section; a `<h3>`/`<h4>`
 *   is a subsection of it. Each subsection's own heading text is appended
 *   to the guide prose as its own line, and every image within it is
 *   tagged with that heading as `section`.
 * - Fandom's current gallery markup is `<li class="gallerybox">` wrapping
 *   a `<div class="thumb">` (the image) plus a *sibling* `.gallerytext`
 *   (the caption) - the previous selector queried from `.thumb`/`figure`
 *   elements directly, which can never find a sibling, so every extracted
 *   image's caption came back empty. Querying from `.gallerybox` itself
 *   fixes this - validated against ~40 real quest pages this same session
 *   (see git history around `quest-guide-images.ts`, now retired in favor
 *   of this always-live, always-current approach covering every quest
 *   with a wiki page instead of a hand-curated subset).
 */
function walkGuideSection(root: Element): WikiGuideData {
  const guideHeading = Array.from(root.querySelectorAll("h2")).find((h2) =>
    /^(guide|walkthrough|strategy)/i.test(headingText(h2)),
  );
  if (!guideHeading) return { text: "", images: [] };

  const paragraphs: string[] = [];
  const images: WikiImage[] = [];
  const seenSrcs = new Set<string>();
  let currentSection: string | undefined;

  let node = guideHeading.nextElementSibling;
  while (node && node.tagName !== "H2") {
    const tag = node.tagName;
    if (tag === "H3" || tag === "H4") {
      currentSection = headingText(node) || undefined;
      if (currentSection) paragraphs.push(currentSection);
    } else if (tag === "P" || tag === "UL" || tag === "OL" || tag === "DL") {
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (text) paragraphs.push(text);
    }

    for (const box of node.querySelectorAll(".gallerybox")) {
      const img = box.querySelector("img");
      if (!img) continue;
      const src = realImageSrc(img, box);
      if (!src || seenSrcs.has(src)) continue;
      seenSrcs.add(src);
      const caption = (box.querySelector(".gallerytext")?.textContent ?? "").trim();
      images.push({ src, caption, ...(currentSection ? { section: currentSection } : {}) });
    }

    node = node.nextElementSibling;
  }

  return { text: paragraphs.join("\n\n"), images };
}

/** Live-fetched Guide-section text + screenshot gallery for a wiki slug - see `walkGuideSection` for the extraction rules. Empty/degraded on any fetch failure. */
export async function fetchWikiGuideData(slug: string): Promise<WikiGuideData> {
  if (!slug) return { text: "", images: [] };
  const doc = await fetchWikiDoc(slug).catch(() => null);
  if (!doc) return { text: "", images: [] };
  const root = doc.querySelector(".mw-parser-output") ?? doc.body;
  return walkGuideSection(root);
}
