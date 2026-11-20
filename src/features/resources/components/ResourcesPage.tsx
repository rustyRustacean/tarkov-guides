import { ArrowRight, ExternalLink } from "lucide-react";
import Image from "next/image";

import { assetPath } from "@/shared/lib/asset-cdn";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card/Card";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import {
  COMMUNITY_RESOURCES,
  FEATURED_COMMUNITY_RESOURCE,
  HOSTED_RESOURCE_KIND_DETAILS,
  HOSTED_RESOURCES,
  type CommunityResource,
  type HostedResource,
} from "../data/resources";

const SOG_LOGO_SRC = assetPath("/images/sog-logo.png");

/**
 * Section ids, also the jump-link targets. `community` is where the old
 * `/external-resources` URL redirects to. No `scroll-mt` on the sections:
 * `globals.css` already sets `scroll-padding-top` for the sticky header.
 */
export const RESOURCES_SECTION_IDS = { hosted: "on-tarkovguides", community: "community" } as const;

function HostedResourceCard({ resource }: { resource: HostedResource }) {
  const Icon = resource.icon;
  const kind = HOSTED_RESOURCE_KIND_DETAILS[resource.kind];
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Icon className="text-primary size-8" aria-hidden="true" />
          <Badge variant="outline">{kind.label}</Badge>
        </div>
        <CardTitle>{resource.title}</CardTitle>
        <CardDescription>{resource.summary}</CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <Button asChild>
          <TransitionLink href={`/resources/${resource.slug}`}>
            {kind.cta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </TransitionLink>
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * One outbound link as a full-width row. Deliberately lighter than a hosted
 * card (no button, hostname shown, external-link icon) so community sites
 * never read as TarkovGuides' own content.
 */
function CommunityResourceRow({ resource }: { resource: CommunityResource }) {
  const Icon = resource.icon;
  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:bg-accent focus-visible:ring-ring flex gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:items-center"
      >
        <Icon className="text-primary mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{resource.title}</span>
            <Badge variant="outline" className="text-[11px]">
              {resource.category}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{resource.description}</p>
        </div>
        <span className="text-muted-foreground hidden shrink-0 items-center gap-1.5 text-xs sm:flex">
          {resource.hostname}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </span>
        <span className="sr-only">(opens {resource.hostname} in a new tab)</span>
      </a>
    </li>
  );
}

/** Props exist so tests can render the hub with other lists; the route passes none. */
export interface ResourcesPageProps {
  hosted?: readonly HostedResource[];
  community?: readonly CommunityResource[];
}

/**
 * The Resources hub: what TarkovGuides hosts first, then community sites
 * we link out to. Each hosted item lives on its own page under
 * `/resources/{slug}`, so this page is only an index and never embeds a
 * tool. Both lists come from `data/resources.ts`.
 *
 * The hosted section is left out entirely while it's empty rather than
 * showing a "coming soon" placeholder. Filtering by kind is deliberately
 * not built yet: with a handful of items a filter hides almost nothing, so
 * the two sections get plain jump links instead.
 */
export function ResourcesPage({
  hosted = HOSTED_RESOURCES,
  community = COMMUNITY_RESOURCES,
}: ResourcesPageProps) {
  const hasHosted = hosted.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-6 text-sm">
        <ol className="flex items-center gap-2">
          <li>
            <TransitionLink href="/" className="hover:text-foreground transition-colors">
              Home
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Resources
          </li>
        </ol>
      </nav>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Resources</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Calculators, charts and tips we built, plus community sites and Discords worth knowing
          about.
        </p>
        {hasHosted && (
          <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 text-sm">
            <a
              href={`#${RESOURCES_SECTION_IDS.hosted}`}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border px-3 py-1 transition-colors"
            >
              On TarkovGuides
            </a>
            <a
              href={`#${RESOURCES_SECTION_IDS.community}`}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border px-3 py-1 transition-colors"
            >
              Around the community
            </a>
          </nav>
        )}
      </div>

      <div className="flex flex-col gap-12">
        {hasHosted && (
          <section
            id={RESOURCES_SECTION_IDS.hosted}
            aria-labelledby={`${RESOURCES_SECTION_IDS.hosted}-heading`}
          >
            <h2
              id={`${RESOURCES_SECTION_IDS.hosted}-heading`}
              className="font-display mb-4 text-2xl font-bold"
            >
              On TarkovGuides
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {hosted.map((resource) => (
                <HostedResourceCard key={resource.slug} resource={resource} />
              ))}
            </div>
          </section>
        )}

        <section
          id={RESOURCES_SECTION_IDS.community}
          aria-labelledby={`${RESOURCES_SECTION_IDS.community}-heading`}
        >
          <h2
            id={`${RESOURCES_SECTION_IDS.community}-heading`}
            className="font-display text-2xl font-bold"
          >
            Around the community
          </h2>
          <p className="text-muted-foreground mt-2 mb-4 text-sm">
            Sites and Discords run by other people. Each link opens in a new tab.
          </p>

          <Card className="mb-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex-1">
                <CardHeader>
                  <Badge variant="outline" className="mb-3 w-fit">
                    {FEATURED_COMMUNITY_RESOURCE.category}
                  </Badge>
                  <CardTitle className="text-2xl">{FEATURED_COMMUNITY_RESOURCE.title}</CardTitle>
                  <CardDescription>{FEATURED_COMMUNITY_RESOURCE.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-muted-foreground text-xs">
                    {FEATURED_COMMUNITY_RESOURCE.hostname}
                  </span>
                </CardContent>
                <CardFooter>
                  <Button asChild>
                    <a
                      href={FEATURED_COMMUNITY_RESOURCE.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Join Discord
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  </Button>
                </CardFooter>
              </div>
              <Image
                src={SOG_LOGO_SRC}
                alt="The SOG logo"
                width={1200}
                height={718}
                className="w-full max-w-2xs shrink-0 px-6 pb-6 sm:max-w-xs sm:px-8 sm:py-6"
              />
            </div>
          </Card>

          <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-lg border">
            {community.map((resource) => (
              <CommunityResourceRow key={resource.url} resource={resource} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
