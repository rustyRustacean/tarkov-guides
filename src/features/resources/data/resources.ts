import {
  BookOpen,
  Box,
  Calculator,
  Crosshair,
  Database,
  GitCompare,
  ListChecks,
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
  {
    slug: "seasonal-modifier-planner",
    title: "Seasonal Modifier Planner",
    summary: "Every Season 2 (Untar Control) modifier in one place.",
    kind: "planner",
    modes: ["PVP_SEASONAL"],
    checked: "2026-11",
    icon: ListChecks,
  },
];

/** The hosted resource for a slug, or `undefined` when none exists. */
export function getHostedResource(slug: string): HostedResource | undefined {
  return HOSTED_RESOURCES.find((resource) => resource.slug === slug);
}

/** What a community link is for. The hub shows one section per group, in {@link COMMUNITY_GROUPS} order. */
export type CommunityGroup = "maps" | "trackers" | "tools" | "guides" | "discords";

/** Section headings for each {@link CommunityGroup}, in display order. */
export const COMMUNITY_GROUPS: readonly { id: CommunityGroup; label: string }[] = [
  { id: "maps", label: "Maps" },
  { id: "trackers", label: "Live trackers" },
  { id: "tools", label: "Data and tools" },
  { id: "guides", label: "Guides and updates" },
  { id: "discords", label: "Discords" },
];

/** A community site or Discord that TarkovGuides links out to. */
export interface CommunityResource {
  /** Stable key, also the screenshot's filename (`public/images/community/{id}.jpg`). */
  id: string;
  group: CommunityGroup;
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

/**
 * Community sites and Discords. Within each group the first entry leads
 * (the hub shows it as the wide card), so put a site with a long,
 * scrollable preview first.
 */
export const COMMUNITY_RESOURCES: readonly CommunityResource[] = [
  {
    id: "reemr-3d-maps",
    group: "maps",
    title: "3D Tarkov Maps",
    description: "Fully explorable 3D renders of every raid map.",
    url: "https://reemr.se",
    hostname: "reemr.se",
    category: "Maps",
    icon: Box,
  },
  {
    id: "arena-maps",
    group: "maps",
    title: "Arena Maps",
    description: "Interactive maps for every Arena mode map, including callouts.",
    url: "https://arena-esports.com/en/maps/blastgang/fort",
    hostname: "arena-esports.com",
    category: "Arena",
    icon: Crosshair,
  },
  {
    id: "eft-boss",
    group: "trackers",
    title: "Boss Spawn Tracker",
    description: "Easiest way to check the current boss spawn chances & locations for every map.",
    url: "https://eftboss.com",
    hostname: "eftboss.com",
    category: "Tracker",
    icon: Skull,
  },
  {
    id: "tarkov-btr",
    group: "trackers",
    title: "BTR Tracker",
    description: "Convenient map for tracking the BTR's live location.",
    url: "https://tarkovbtr.com",
    hostname: "tarkovbtr.com",
    category: "Tracker",
    icon: Truck,
  },
  {
    id: "tarkov-dev",
    group: "tools",
    title: "Tarkov.dev Tools",
    description:
      "Player account lookup, barter profit calculators, and other general-purpose tools.",
    url: "https://tarkov.dev",
    hostname: "tarkov.dev",
    category: "Tools",
    icon: Wrench,
  },
  {
    id: "db4tarkov",
    group: "tools",
    title: "Database for Tarkov",
    description:
      "Gun builder, tier maker, and preset builder alongside a flea market, quest tracker, item-to-keep list, interactive map, and craft/barter lookups.",
    url: "https://db4tarkov.com",
    hostname: "db4tarkov.com",
    category: "Database",
    icon: Database,
  },
  {
    id: "tarkov-perks",
    group: "tools",
    title: "Tarkov Perks",
    description:
      "Another seasonal modifier planner: plan your picks before they lock in for the season, with your point balance and incompatible combinations flagged.",
    url: "https://tarkovperks.com",
    hostname: "tarkovperks.com",
    category: "Planner",
    icon: SlidersHorizontal,
  },
  {
    id: "mrsouer-guides",
    group: "guides",
    title: "Story Guides",
    description:
      "Escape from Tarkov lore and story guides, note: translated from Russian. Usually updated faster than the official wiki, but sometimes lacks complete information such as missing task item spawn locations.",
    url: "https://mrsouer.com/guides/eft",
    hostname: "mrsouer.com",
    category: "Guides",
    icon: BookOpen,
  },
  {
    id: "tarkov-changes",
    group: "guides",
    title: "Tarkov Changes",
    description:
      "Displays the latest code and variable changes bundled with each Tarkov update. Handy for catching under-the-hood tweaks patch notes don't always spell out.",
    url: "https://changes.tarkov-changes.com/latest",
    hostname: "changes.tarkov-changes.com",
    category: "Changelog",
    icon: GitCompare,
  },
  {
    id: "eft-wiki-discord",
    group: "discords",
    title: "EFT Wiki Discord",
    description:
      "The wiki's own Discord. Its #new-info-forum is the best place to catch the newest task and event info, especially during events or the start of a wipe.",
    url: "https://discord.com/invite/7ZeEyfU",
    hostname: "discord.com/invite/7ZeEyfU",
    category: "Discord",
    icon: MessagesSquare,
  },
  {
    id: "sherpa-hub",
    group: "discords",
    title: "Sherpa Hub",
    description:
      "Another spot for Sherpa sessions, where official green names help beginners learn the game.",
    url: "https://discord.com/invite/sherpahub",
    hostname: "discord.com/invite/sherpahub",
    category: "Discord",
    icon: MessagesSquare,
  },
];
