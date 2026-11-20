import { Badge } from "@/shared/ui/badge/Badge";
import { cn } from "@/shared/ui/lib/cn";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { HOSTED_RESOURCE_KIND_DETAILS, type HostedResource } from "../data/resources";
import { formatCheckedMonth, formatResourceModes } from "../lib/resource-labels";

import { ResourceModeNotice } from "./ResourceModeNotice";

import type { ReactNode } from "react";

/**
 * The shared shell for every hosted resource's own page: breadcrumb back to
 * the hub, the title, badges for kind, modes and when it was last checked
 * against the game, then the resource itself as `children`. Every item
 * page uses this so they all read the same way, whatever the content is.
 */
export function ResourceItemPage({
  resource,
  wide = false,
  children,
}: {
  resource: HostedResource;
  /** Widens the page past the site's usual column, for tools laid out in several columns. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto px-4 py-12", wide ? "max-w-[96rem]" : "max-w-6xl")}>
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
          <li aria-current="page" className="text-foreground">
            {resource.title}
          </li>
        </ol>
      </nav>

      <header className="mb-8 flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold">{resource.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{HOSTED_RESOURCE_KIND_DETAILS[resource.kind].label}</Badge>
          <Badge variant="outline">{formatResourceModes(resource.modes)}</Badge>
          <Badge variant="secondary">Checked {formatCheckedMonth(resource.checked)}</Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl text-lg">{resource.summary}</p>
        {resource.modes !== "all" && <ResourceModeNotice modes={resource.modes} />}
      </header>

      {children}
    </div>
  );
}
