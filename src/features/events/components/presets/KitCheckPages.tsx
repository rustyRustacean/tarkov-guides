"use client";

import { useRouter } from "next/navigation";

import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { useItemCatalog } from "../../catalog/use-item-catalog";
import { useEventSnapshot } from "../../hooks/use-event-snapshot";
import { useHashKit } from "../../hooks/use-hash-kit";
import { useNamer } from "../../hooks/use-namer";
import { eventViewPath } from "../../lib/event-code";
import { eventKitPath, kitHash, STANDALONE_KIT_PATH } from "../../lib/kit-links";
import { EventUnavailable } from "../EventViewer";

import { KitBuilder } from "./KitBuilder";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { Kit, Preset } from "../../types";
import type { ReactNode } from "react";

function CatalogGate({ children }: { children: (index: CatalogIndex) => ReactNode }) {
  const { index, isPending } = useItemCatalog();
  if (isPending) return <p className="text-muted-foreground">Loading items...</p>;
  if (!index) {
    return (
      <EventUnavailable
        title="Items unavailable"
        body="The item list didn't load, so kits can't be checked right now. Try refreshing."
      />
    );
  }
  return children(index);
}

function KitBuilderFor({
  preset,
  index,
  kitLink,
  kit,
  setKit,
}: {
  preset: Preset | null;
  index: CatalogIndex;
  kitLink: (kit: Kit) => Promise<string>;
  kit: Kit;
  setKit: (kit: Kit) => void;
}) {
  const names = useNamer(index);
  return (
    <KitBuilder
      kit={kit}
      onKitChange={setKit}
      preset={preset}
      index={index}
      names={names}
      kitLink={kitLink}
    />
  );
}

/**
 * The kit checker for one of an event's role presets. The presets come from
 * the event's view-only snapshot, so an organizer's edit shows up here on
 * the next refresh. Switching role keeps the kit, which makes "does this
 * kit fit the DMR role instead?" one click.
 */
export function EventKitCheck({ code, roleId }: { code: string; roleId: string | null }) {
  const router = useRouter();
  const { data, isPending } = useEventSnapshot(code);
  const { kit, setKit, loaded } = useHashKit(false);

  if (isPending || !loaded) return <p className="text-muted-foreground">Loading...</p>;
  if (!data) {
    return (
      <EventUnavailable
        title="Event not found"
        body="This event doesn't exist, or it was deleted. Check the link you were given."
      />
    );
  }

  const presets = Object.values(data.document.presets);
  const preset = presets.find((candidate) => candidate.id === roleId) ?? presets[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold">Kit check</h1>
        <p className="text-muted-foreground">
          For{" "}
          <TransitionLink href={eventViewPath(code)} className="text-foreground underline">
            {data.document.settings.name}
          </TransitionLink>
          . Build your kit and the rules are checked as you go.
        </p>
        {presets.length > 1 && preset && (
          <SegmentedControl
            aria-label="Role"
            className="max-w-2xl"
            options={presets.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            value={preset.id}
            onChange={(id) => {
              void kitHash(kit).then((hash) => {
                router.replace(`${eventKitPath(code, id)}${hash}`, { scroll: false });
              });
            }}
          />
        )}
      </header>
      {presets.length === 0 ? (
        <p className="text-muted-foreground">This event has no role presets yet.</p>
      ) : (
        <CatalogGate>
          {(index) => (
            <KitBuilderFor
              preset={preset}
              index={index}
              kit={kit}
              setKit={setKit}
              kitLink={async (current) =>
                `${window.location.origin}${eventKitPath(code, preset?.id ?? "")}${await kitHash(current)}`
              }
            />
          )}
        </CatalogGate>
      )}
    </div>
  );
}

/** The kit checker for a preset shared on its own, carried in the link itself (`#p=`). */
export function StandaloneKitCheck() {
  const { kit, setKit, preset, loaded } = useHashKit(true);

  if (!loaded) return <p className="text-muted-foreground">Loading...</p>;
  if (!preset) {
    return (
      <EventUnavailable
        title="No preset in this link"
        body="A kit check link carries its preset with it. This one is missing or damaged: ask for the link again."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">Kit check: {preset.name}</h1>
        <p className="text-muted-foreground">Build your kit and the rules are checked as you go.</p>
      </header>
      <CatalogGate>
        {(index) => (
          <KitBuilderFor
            preset={preset}
            index={index}
            kit={kit}
            setKit={setKit}
            kitLink={async (current) =>
              `${window.location.origin}${STANDALONE_KIT_PATH}${await kitHash(current, preset)}`
            }
          />
        )}
      </CatalogGate>
    </div>
  );
}
