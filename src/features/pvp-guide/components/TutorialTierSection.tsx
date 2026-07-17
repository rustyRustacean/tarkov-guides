import { ArrowRight, Rocket } from "lucide-react";

import { Badge, type BadgeProps } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";
import type { PvpTier } from "../types";

interface TierConfig {
  label: string;
  description: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
}

const TIER_CONFIG: Readonly<Record<PvpTier, TierConfig>> = {
  essential: {
    label: "Essential Foundation",
    description:
      "Master these fundamentals before moving to intermediate techniques - non-negotiable skills for PvP success.",
    badgeVariant: "green",
  },
  intermediate: {
    label: "Intermediate Mastery",
    description:
      "Build on your essential skills with combat positioning, advanced peeking, and tactical information warfare.",
    badgeVariant: "amber",
  },
  advanced: {
    label: "Advanced Mastery",
    description:
      "Master the highest levels of PvP technique with movement integration and equipment optimization.",
    badgeVariant: "red",
  },
};

interface Props {
  tier: PvpTier;
  items: readonly LearningPathItemWithTutorial[];
}

/**
 * One tier's tutorial-link list on the Full Guide tab - one component
 * parameterized by tier, replacing
 * `old/tarkov-tips/src/components/pvp/PVPGuideClient.tsx`'s 3 near-identical
 * copy-pasted Essential/Intermediate/Advanced JSX blocks (only the color/
 * label/description differed between them - a straightforward, in-scope
 * simplification per `CODING_STANDARDS.md`, not a redesign).
 */
export function TutorialTierSection({ tier, items }: Props) {
  const config = TIER_CONFIG[tier];
  const first = items[0];

  return (
    <div className="bg-muted/40 rounded-3xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-foreground text-2xl font-bold">{config.label}</h2>
        {tier === "essential" && first && (
          <Button asChild>
            <TransitionLink href={`/pvp-guide/${first.tutorialSlug}`}>
              <Rocket className="size-4" />
              Start Here
            </TransitionLink>
          </Button>
        )}
      </div>

      <p className="text-muted-foreground mb-6">{config.description}</p>

      <div className="grid gap-3">
        {items.map((item) => {
          if (!item.tutorial) return null;
          return (
            <TransitionLink
              key={item.tutorialSlug}
              href={`/pvp-guide/${item.tutorialSlug}`}
              className="group bg-card border-border hover:border-primary/50 flex items-center gap-4 rounded-lg border p-4 shadow-sm transition-colors hover:shadow-md"
            >
              <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {item.order}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-foreground group-hover:text-primary font-semibold transition-colors">
                      {item.tutorial.frontmatter.title}
                    </h3>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span>{item.estimatedTime} min</span>
                      <Badge variant={config.badgeVariant}>{config.label.split(" ")[0]}</Badge>
                      <span className="capitalize">{item.tutorial.frontmatter.difficulty}</span>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
                <p className="text-muted-foreground mt-2 line-clamp-1 text-sm">
                  {item.description}
                </p>
              </div>
            </TransitionLink>
          );
        })}
      </div>
    </div>
  );
}
