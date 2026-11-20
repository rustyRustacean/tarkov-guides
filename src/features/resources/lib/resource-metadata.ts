import { getHostedResource, type HostedResource } from "../data/resources";

import type { Metadata } from "next";

/**
 * The hosted resource for a route's slug. Throws rather than returning
 * `undefined`, so a route folder whose slug doesn't match `data/resources.ts`
 * fails the build instead of rendering an empty page.
 */
export function requireHostedResource(slug: string): HostedResource {
  const resource = getHostedResource(slug);
  if (!resource) throw new Error(`No hosted resource with slug "${slug}" in data/resources.ts`);
  return resource;
}

/** Page title and description for a hosted resource's route, from its registry entry. */
export function hostedResourceMetadata(slug: string): Metadata {
  const resource = requireHostedResource(slug);
  return { title: `${resource.title} | TarkovGuides`, description: resource.summary };
}
