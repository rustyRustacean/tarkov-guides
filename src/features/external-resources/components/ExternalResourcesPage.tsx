import {
  BookOpen,
  Box,
  Crosshair,
  Database,
  ExternalLink,
  GitCompare,
  Skull,
  SlidersHorizontal,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import Image from "next/image";

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

import type { LucideIcon } from "lucide-react";

const SOG_LOGO_SRC = "/images/sog-logo.png";

interface ExternalResource {
  title: string;
  description: string;
  url: string;
  hostname: string;
  category: string;
  icon: LucideIcon;
}

/** The SOG is featured in its own banner above the grid, so it's kept
 * separate rather than mapped generically like the rest of the list. */
const FEATURED_RESOURCE = {
  title: "The SOG",
  description:
    "Feel free to join the discord if you're looking for a community or need a Sherpa Session, ran alongside Official BSG Sherpas",
  url: "https://discord.gg/the-sog",
  hostname: "discord.gg/the-sog",
  category: "Community",
};

const EXTERNAL_RESOURCES: ExternalResource[] = [
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
      "Plan your seasonal modifier picks (global and personal perks) before they lock in for the season - tracks your point balance and flags incompatible combinations.",
    url: "https://tarkov-seasonal.vercel.app",
    hostname: "tarkov-seasonal.vercel.app",
    category: "Planner",
    icon: SlidersHorizontal,
  },
  {
    title: "Tarkov Changes",
    description:
      "Displays the latest code and variable changes bundled with each Tarkov update - handy for catching under-the-hood tweaks patch notes don't always spell out.",
    url: "https://changes.tarkov-changes.com/latest",
    hostname: "changes.tarkov-changes.com",
    category: "Changelog",
    icon: GitCompare,
  },
];

interface OtherDiscord {
  title: string;
  description: string;
  url: string;
  hostname: string;
}

/** Rendered as its own card alongside `EXTERNAL_RESOURCES` rather than folded into that
 * list, since it links out to two communities instead of one. */
const OTHER_DISCORDS: OtherDiscord[] = [
  {
    title: "EFT Wiki Discord",
    description:
      "The wiki's own Discord. Specifically, its #new-info-forum is the best place to catch the newest task and event info, especially useful during events or the start of a wipe.",
    url: "https://discord.com/invite/7ZeEyfU",
    hostname: "discord.com/invite/7ZeEyfU",
  },
  {
    title: "Sherpa Hub",
    description:
      "Another spot for Sherpa sessions, where official green names help beginners learn the game.",
    url: "https://discord.com/invite/sherpahub",
    hostname: "discord.com/invite/sherpahub",
  },
];

/**
 * A curated list of external community sites and tools that don't (yet, or
 * ever) belong on TarkovGuides itself - each card leaves the site via a
 * plain `<a target="_blank" rel="noopener noreferrer">`, not `TransitionLink`,
 * since these aren't internal routes.
 */
export function ExternalResourcesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">External Resources</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">External Resources</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Community-run sites and tools worth knowing about, beyond what TarkovGuides covers itself.
        </p>
      </div>

      <Card className="mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center">
          <div className="flex-1">
            <CardHeader>
              <Badge variant="outline" className="mb-3 w-fit">
                {FEATURED_RESOURCE.category}
              </Badge>
              <CardTitle className="text-2xl">{FEATURED_RESOURCE.title}</CardTitle>
              <CardDescription>{FEATURED_RESOURCE.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-muted-foreground text-xs">{FEATURED_RESOURCE.hostname}</span>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <a href={FEATURED_RESOURCE.url} target="_blank" rel="noopener noreferrer">
                  Join Discord
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </CardFooter>
          </div>
          <Image
            src={SOG_LOGO_SRC}
            alt="The SOG logo"
            width={1200}
            height={718}
            priority
            className="w-full max-w-2xs shrink-0 px-6 pb-6 sm:max-w-xs sm:px-8 sm:py-6"
          />
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EXTERNAL_RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <Card key={resource.title}>
              <CardHeader>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Icon className="text-primary size-8" />
                  <Badge variant="outline">{resource.category}</Badge>
                </div>
                <CardTitle>{resource.title}</CardTitle>
                <CardDescription>{resource.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-muted-foreground text-xs">{resource.hostname}</span>
              </CardContent>
              <CardFooter>
                <Button asChild>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    Visit site
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}

        <Card className="sm:col-span-2">
          <CardHeader>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Users className="text-primary size-8" />
              <Badge variant="outline">Community</Badge>
            </div>
            <CardTitle>Other Discords</CardTitle>
            <CardDescription>
              A couple more communities worth joining beyond The SOG.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {OTHER_DISCORDS.map((discord) => (
              <div key={discord.title}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{discord.title}</span>
                  <a
                    href={discord.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    Join
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{discord.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
