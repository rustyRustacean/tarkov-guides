import {
  BookOpen,
  Box,
  Calculator,
  Crosshair,
  Database,
  GitCompare,
  MessagesSquare,
  Skull,
  SlidersHorizontal,
  Truck,
  Wrench,
} from "lucide-react";

import type { ProfileMode } from "@/features/progress-tracker/types";
import type { LucideIcon } from "lucide-react";

/** What a hosted resource is, which sets its card badge and call to action. */
export type HostedResourceKind = "calculator" | "planner" | "chart" | "tip";

/** Badge text and the card's link label for each {@link HostedResourceKind}. */
export const HOSTED_RESOURCE_KIND_DETAILS: Readonly<
  Record<HostedResourceKind, { label: string; cta: string }>
> = {
  calculator: { label: "Calculator", cta: "Open calculator" },
  planner: { label: "Planner", cta: "Open planner" },
  chart: { label: "Chart", cta: "View chart" },
  tip: { label: "Tip", cta: "Read tip" },
};

/**
 * Something built and hosted on TarkovGuides itself, served at
 * `/resources/{slug}`. Every entry needs a matching route folder under
 * `src/app/resources/`; `resources.test.ts` fails when one is missing.
 */
export interface HostedResource {
  /** URL segment under `/resources/`. Kebab-case, never changed once shipped (it's a shared link). */
  slug: string;
  title: string;
  /** One or two sentences for the hub card and the page's meta description. */
  summary: string;
  kind: HostedResourceKind;
  /**
   * Game modes the content is about. `"all"` means it follows the header's
   * mode switch; a list means it only applies to those modes, and the item
   * page says so when the site is in another one.
   */
  modes: "all" | readonly ProfileMode[];
  /** Year and month the content was last checked against the live game, `YYYY-MM`. */
  checked: string;
  icon: LucideIcon;
}

/** Everything TarkovGuides hosts, in the order the hub lists it. */
export const HOSTED_RESOURCES: readonly HostedResource[] = [
  {
    slug: "flea-fee-calculator",
    title: "Flea Fee Calculator",
    summary:
      "Pick an item and a price to see the flea market listing fee and what you actually keep, using the active mode's prices.",
    kind: "calculator",
    modes: "all",
    checked: "2026-11",
    icon: Calculator,
  },
];

/** The hosted resource for a slug, or `undefined` when none exists. */
export function getHostedResource(slug: string): HostedResource | undefined {
  return HOSTED_RESOURCES.find((resource) => resource.slug === slug);
}

/** A community site or Discord that TarkovGuides links out to. */
export interface CommunityResource {
  title: string;
  description: string;
  url: string;
  /** Shown instead of the full URL so the destination is clear before clicking. */
  hostname: string;
  category: string;
  icon: LucideIcon;
}

/** Featured in its own banner above the community list. */
export const FEATURED_COMMUNITY_RESOURCE = {
  title: "The SOG",
  description:
    "Feel free to join the discord if you're looking for a community to find teammates or need a Sherpa Session, ran alongside Official BSG Sherpas",
  url: "https://discord.gg/the-sog",
  hostname: "discord.gg/the-sog",
  category: "Community",
} as const;

/** Community sites and Discords, in the order the hub lists them. */
export const COMMUNITY_RESOURCES: readonly CommunityResource[] = [
  {
    title: "Tarkov.dev Tools",
    description:
      "Player account lookup, barter profit calculators, and other general-purpose tools.",
    url: "https://tarkov.dev",
    hostname: "tarkov.dev",
    category: "Tools",
    icon: Wrench,
  },
  {
    title: "Arena Maps",
    description: "Interactive maps for every Arena mode map, including callouts.",
    url: "https://arena-esports.com/en/maps",
    hostname: "arena-esports.com",
    category: "Arena",
    icon: Crosshair,
  },
  {
    title: "3D Tarkov Maps",
    description: "Fully explorable 3D renders of every raid map.",
    url: "https://reemr.se",
    hostname: "reemr.se",
    category: "Maps",
    icon: Box,
  },
  {
    title: "Story Guides",
    description:
      "Escape from Tarkov lore and story guides, note: translated from Russian. Usually updated faster than the official wiki, but sometimes lacks complete information such as missing task item spawn locations.",
    url: "https://mrsouer.com/guides/escape_from_tarkov",
    hostname: "mrsouer.com",
    category: "Guides",
    icon: BookOpen,
  },
  {
    title: "Boss Spawn Tracker",
    description: "Easiest way to check the current boss spawn chances & locations for every map.",
    url: "https://eftboss.com",
    hostname: "eftboss.com",
    category: "Tracker",
    icon: Skull,
  },
  {
    title: "BTR Tracker",
    description: "Convenient map for tracking the BTR's live location.",
    url: "https://tarkovbtr.com",
    hostname: "tarkovbtr.com",
    category: "Tracker",
    icon: Truck,
  },
  {
    title: "Database for Tarkov",
    description:
      "Gun builder, tier maker, and preset builder alongside a flea market, quest tracker, item-to-keep list, interactive map, and craft/barter lookups.",
    url: "https://db4tarkov.com",
    hostname: "db4tarkov.com",
    category: "Database",
    icon: Database,
  },
  {
    title: "Seasonal Modifier Planner",
    description:
      "Plan your seasonal modifier picks (global and personal perks) before they lock in for the season. Tracks your point balance and flags incompatible combinations.",
    url: "https://tarkov-seasonal.vercel.app",
    hostname: "tarkov-seasonal.vercel.app",
    category: "Planner",
    icon: SlidersHorizontal,
  },
  {
    title: "Tarkov Changes",
    description:
      "Displays the latest code and variable changes bundled with each Tarkov update. Handy for catching under-the-hood tweaks patch notes don't always spell out.",
    url: "https://changes.tarkov-changes.com/latest",
    hostname: "changes.tarkov-changes.com",
    category: "Changelog",
    icon: GitCompare,
  },
  {
    title: "EFT Wiki Discord",
    description:
      "The wiki's own Discord. Its #new-info-forum is the best place to catch the newest task and event info, especially during events or the start of a wipe.",
    url: "https://discord.com/invite/7ZeEyfU",
    hostname: "discord.com/invite/7ZeEyfU",
    category: "Discord",
    icon: MessagesSquare,
  },
  {
    title: "Sherpa Hub",
    description:
      "Another spot for Sherpa sessions, where official green names help beginners learn the game.",
    url: "https://discord.com/invite/sherpahub",
    hostname: "discord.com/invite/sherpahub",
    category: "Discord",
    icon: MessagesSquare,
  },
];
