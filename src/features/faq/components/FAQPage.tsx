import { ExternalLink } from "lucide-react";

import { Button } from "@/shared/ui/button/Button";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { FAQItem } from "./FAQItem";

import type { ReactNode } from "react";

interface FAQEntry {
  question: string;
  answer: ReactNode;
}

/**
 * Ordered per the user-approved requirements: "Is this site safe" first,
 * "Why was this site designed" second, "How can I support" last. The
 * remaining entries are additions judged useful for this specific site
 * (no-account/local-storage model, live data freshness, bug reports) rather
 * than generic filler.
 */
const FAQ_ENTRIES: FAQEntry[] = [
  {
    question: "Is this site safe to use?",
    answer: (
      <div className="space-y-2">
        <p className="text-foreground font-medium">Yes.</p>
        <p>
          Every feature on this site (local progress tracking, live game data, and interactive maps)
          is the same kind of feature you&apos;ll find on other commonly-used Tarkov companion sites
          (tarkov.dev, the EFT wiki, and similar community tools). None of it is novel or unusual by
          that standard.
        </p>
        <p>
          Specifically: there&apos;s no account or login system, so nothing is ever collected beyond
          what your browser already handles. Your Progress Tracker data (quests, stash items,
          hideout, Kappa) is saved locally in your browser&apos;s storage, not on a server we
          control, unless you explicitly export a backup yourself. Live quest/item/price data is
          fetched from the community-run tarkov.dev API through our own server, the same public data
          source most other Tarkov tools also read from. Additionally, feel free to contact me if
          you&apos;re interested in seeing any of the code for the website.
        </p>
      </div>
    ),
  },
  {
    question: "Why was this site designed?",
    answer: (
      <p>
        Fair question, since most of what&apos;s here already exists somewhere else across other
        Tarkov sites. I wanted my own specific design, layout, and quality-of-life features rather
        than juggling several different tools with different conventions. The one I&apos;d call out
        specifically is live drawing directly on the map - it&apos;s a genuinely convenient tool for
        plenty of Sherpas, since being able to sketch routes, callouts, and mistakes live on the map
        makes post-raid communication and analysis a lot easier than describing it in words alone.
      </p>
    ),
  },
  {
    question: "Do I need to create an account?",
    answer: (
      <p>
        No. There&apos;s no login system anywhere on this site. Progress Tracker data lives in your
        browser&apos;s local storage by default - if you want to move it between devices or keep a
        backup, you can manually export/import a JSON file or sync it to a local folder, entirely
        under your control.
      </p>
    ),
  },
  {
    question: "How current is the quest, item, and price data?",
    answer: (
      <div className="space-y-2">
        <p>
          It comes from the community-run tarkov.dev API rather than a static dataset baked into the
          site, layered behind a couple of caches so pages stay fast without going stale.
        </p>
        <p>
          Our server caches tarkov.dev&apos;s response for up to an hour and shares that single
          cached copy across every visitor, so load on tarkov.dev stays constant no matter how many
          people are using the site at once. Your browser then keeps its own copy on top of that, so
          reloads are instant, and quietly checks for anything newer in the background once that
          hour is up.
        </p>
        <p>
          Underneath both of those caches, tarkov.dev says it best themselves: &quot;Data is cached
          until new data is available.&quot; So the numbers feeding both caches only actually change
          when the underlying game data does, not on some arbitrary timer. In practice, that means
          quest requirements, trader info, and prices reflect the current wipe and patch within
          about an hour of an update, not a stale snapshot.
        </p>
      </div>
    ),
  },
  {
    question: "Found a bug or have a feature idea?",
    answer: (
      <p>
        Let me know on Discord - see the &quot;About&quot; link in the footer of any page for
        contact details.
      </p>
    ),
  },
  {
    question: "How can I support this site?",
    answer: (
      <div className="space-y-3">
        <p>
          We don&apos;t believe helper sites like this one should be monetized or paywalled, and
          we&apos;ll never lock a feature behind a paywall - everything here stays free.
        </p>
        <p>If you&apos;d still like to chip in, any donations go toward hosting costs:</p>
        <Button asChild variant="outline" size="sm">
          <a href="https://ko-fi.com/tarkovguides" target="_blank" rel="noopener noreferrer">
            Open Tip Jar
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    ),
  },
];

/**
 * Site FAQ - each question is its own independently-expandable `FAQItem`
 * card; answers push later questions down via normal block flow rather than
 * overlaying content. Linked from the header nav (placed just before
 * External Resources), not yet part of the numbered migration-phase plan -
 * new content, same as `external-resources`.
 */
export function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">FAQ</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mt-3 text-lg">Click a question to expand its answer.</p>
      </div>

      <div className="flex flex-col gap-4">
        {FAQ_ENTRIES.map((entry) => (
          <FAQItem key={entry.question} question={entry.question} answer={entry.answer} />
        ))}
      </div>
    </div>
  );
}
