import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import type { ReactNode } from "react";

/**
 * Page frame for the events pages below the landing page (new event, an
 * event's scoreboard): the same breadcrumb trail as every hosted resource,
 * extended with the Event Scoreboard level, and the wide column.
 */
export function EventsShell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[96rem] px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <TransitionLink href="/" className="hover:text-foreground transition-colors">
              Home
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <TransitionLink href="/resources" className="hover:text-foreground transition-colors">
              Resources
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <TransitionLink
              href="/resources/events"
              className="hover:text-foreground transition-colors"
            >
              Event Scoreboard
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {current}
          </li>
        </ol>
      </nav>
      {children}
    </div>
  );
}
