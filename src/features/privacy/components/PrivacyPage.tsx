import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

interface PolicySection {
  title: string;
  body: React.ReactNode;
}

/**
 * What this page actually reflects (checked against the live code, not
 * boilerplate): no accounts, no ad trackers, no tracking cookies. The only
 * places any data moves off a single browser are Liveblocks (Maps
 * Collaborate sessions and cross-device Progress Tracker sync, see
 * `maps/session/liveblocks-config.tsx` and `companion/use-device-sync.ts`),
 * Vercel Web Analytics (`@vercel/analytics/next`, wired up in
 * `src/app/layout.tsx`: cookieless pageview counts), and the live
 * game-data proxy (`/api/tarkov-data`). Everything else (Progress Tracker
 * data, theme choice, device-sync pairing code) lives in this browser's own
 * `localStorage`/IndexedDB and is never sent to a server this site
 * controls.
 */
const SECTIONS: PolicySection[] = [
  {
    title: "No accounts, no ad tracking",
    body: (
      <p>
        There&apos;s no login system anywhere on this site, and no advertising or tracking cookies.
        We don&apos;t know who you are, and we&apos;re not trying to find out - the one exception is
        anonymous, cookieless page-view counts, covered below.
      </p>
    ),
  },
  {
    title: "What stays in your browser",
    body: (
      <div className="space-y-2">
        <p>
          Progress Tracker data (quests, stash items, hideout, Kappa progress) is saved to this
          browser&apos;s own local storage. So are your theme choice and device-sync pairing
          settings. None of it is sent to a server we control unless you explicitly export a backup
          file yourself.
        </p>
        <p>Clearing your browser&apos;s site data for this domain deletes all of it.</p>
      </div>
    ),
  },
  {
    title: "Real-time features (Liveblocks)",
    body: (
      <div className="space-y-2">
        <p>
          Two features relay data between your devices in real time through{" "}
          <a
            href="https://liveblocks.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Liveblocks
          </a>
          , a third-party service: Maps &quot;Collaborate&quot; sessions (shared map view, teammate
          position markers, live drawing) and cross-device Progress Tracker sync. This only happens
          while you&apos;ve started a session or turned on device sync. Nothing is sent anywhere
          otherwise.
        </p>
        <p>
          What&apos;s relayed is limited to what those features need: in-raid position, a display
          name and color you choose, shared map annotations, and Progress Tracker data for sync. See{" "}
          <a
            href="https://liveblocks.io/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Liveblocks&apos; own privacy policy
          </a>{" "}
          for how they handle it on their end.
        </p>
      </div>
    ),
  },
  {
    title: "Analytics (Vercel)",
    body: (
      <p>
        We use{" "}
        <a
          href="https://vercel.com/docs/analytics"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Vercel Web Analytics
        </a>{" "}
        to count page views and see which pages are popular. It doesn&apos;t use cookies and
        doesn&apos;t collect anything that identifies you personally. See{" "}
        <a
          href="https://vercel.com/legal/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Vercel&apos;s own privacy policy
        </a>{" "}
        for how they handle it on their end.
      </p>
    ),
  },
  {
    title: "The EFT Companion app",
    body: (
      <p>
        The optional Companion app reads live raid data from your PC and talks only to your own
        browser over <code className="text-foreground">127.0.0.1</code> (your machine, not our
        servers). That data only leaves your PC if you turn on a Collaborate session or device sync,
        in which case it&apos;s relayed the same way described above.
      </p>
    ),
  },
  {
    title: "Live game data",
    body: (
      <p>
        Quest, item, trader, and price data is fetched live from the community-run{" "}
        <a
          href="https://tarkov.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          tarkov.dev
        </a>{" "}
        API through our own server (cached for up to an hour). Quest guide text and screenshots are
        fetched live from the{" "}
        <a
          href="https://escapefromtarkov.fandom.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Escape from Tarkov Wiki
        </a>
        . Both are public reference data, not anything tied to you. See the{" "}
        <TransitionLink href="/credits" className="text-primary hover:underline">
          Credits page
        </TransitionLink>{" "}
        for the full list of sources this site pulls from.
      </p>
    ),
  },
  {
    title: "Contact",
    body: (
      <p>
        Questions about any of this? Use the &quot;Contact us&quot; link in the footer of any page
        for our email and Discord.
      </p>
    ),
  },
];

/**
 * Plain-language privacy policy, written to reflect what this site's code
 * actually does rather than boilerplate: no accounts/ads, local storage for
 * everything by default, and two third parties: Liveblocks (session data,
 * only while a Collaborate/device-sync session is active) and Vercel Web
 * Analytics (cookieless aggregate page views, always on). Linked from the
 * footer as "Privacy", next to "Credits" and "Contact us".
 */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">Privacy</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Short version: no accounts, no ad trackers, and analytics that don&apos;t use cookies or
          identify you. Here&apos;s exactly what happens to data on this site and where it goes, if
          anywhere.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">Last updated August 6, 2026.</p>
      </div>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm leading-relaxed">
              {section.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
