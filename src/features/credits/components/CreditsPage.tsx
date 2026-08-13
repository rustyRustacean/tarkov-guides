import { ExternalLink } from "lucide-react";

import { Badge } from "@/shared/ui/badge/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

interface CreditEntry {
  name: string;
  url: string;
  usage: string;
  license: string;
  licenseUrl?: string;
}

/**
 * Every third-party source this site pulls live data or bundled assets
 * from, each with the exact license governing that source, since two of
 * them (the SVG overview maps and the Ice Breaker deck plan) are CC
 * BY-NC-SA and therefore require attribution wherever they're used. Order
 * roughly follows how much of the site each source touches (game data
 * first, then map assets, then wiki content).
 *
 * License facts here reflect this page's own research (each source's
 * copyrights page / repo LICENSE file); re-verify against the source before
 * relying on this for anything beyond "the site gives credit."
 */
const CREDITS: CreditEntry[] = [
  {
    name: "tarkov.dev",
    url: "https://tarkov.dev",
    usage:
      "Live item, quest, trader, and price data (via their public API), plus the JPG 2D map images and live satellite map tiles served from assets.tarkov.dev.",
    license: "MIT (tarkov-dev repo)",
    licenseUrl: "https://github.com/the-hideout/tarkov-dev/blob/main/LICENSE",
  },
  {
    name: "the-hideout/tarkov-dev-svg-maps",
    url: "https://github.com/the-hideout/tarkov-dev-svg-maps",
    usage: "The SVG overview map outlines used throughout the Maps feature.",
    license: "CC BY-NC-SA 4.0 (noncommercial use only)",
    licenseUrl: "https://github.com/the-hideout/tarkov-dev-svg-maps/blob/main/LICENSE.md",
  },
  {
    name: "Escape from Tarkov Wiki (Fandom)",
    url: "https://escapefromtarkov.fandom.com",
    usage:
      "Quest Guide/Walkthrough text and screenshots, fetched live from the wiki for each quest's detail view.",
    license: "CC BY-NC-SA 3.0 Unported, unless a specific page says otherwise",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
  },
  {
    name: "re3mr (reemr.se)",
    url: "https://reemr.se",
    usage: "The majority of the maps used in the maps page, almost every non-wiki map.",
    license: "CC BY-NC-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  },
  {
    name: "TarkovBOT.eu",
    url: "https://tarkovbot.eu",
    usage:
      "Imagery for the Ice Breaker satellite tile pyramid, credited via tarkov.dev's own map metadata.",
    license: "Credited per tarkov.dev's map metadata",
  },
];

/**
 * Attribution for every third-party data source and bundled asset this site
 * uses, with the exact license for each. Most of this site's game data,
 * map imagery, and quest guide content comes from community sources rather
 * than being made in-house. Linked from the footer's "Credits" link.
 */
export function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">Credits</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Credits &amp; Licenses</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          This site isn&apos;t affiliated with Battlestate Games. Most of its game data, map
          imagery, and quest guide content comes from the community sources below rather than being
          made in-house. Credit where it&apos;s due.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {CREDITS.map((credit) => (
          <Card key={credit.name}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{credit.name}</CardTitle>
                <Badge variant="outline">{credit.license}</Badge>
              </div>
              <CardDescription>{credit.usage}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                Visit site
                <ExternalLink className="size-3.5" />
              </a>
              {credit.licenseUrl && (
                <a
                  href={credit.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  View license
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
