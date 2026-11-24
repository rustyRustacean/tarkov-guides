import { EventsShell } from "@/features/events/components/EventsShell";
import { MyPresetWorkbench } from "@/features/events/components/presets/MyPresetWorkbench";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit preset | TarkovGuides",
  description:
    "Build a Tarkov event preset: gear bans, allowed lists, quantity caps and stat limits.",
  robots: { index: false, follow: false },
};

/** Route entry for editing one of this browser's saved presets (`?id=`), or a new one. */
export default async function MyPresetEditRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await searchParams;
  return (
    <EventsShell current="Preset">
      <MyPresetWorkbench
        key={typeof id === "string" ? id : "new"}
        id={typeof id === "string" ? id : null}
      />
    </EventsShell>
  );
}
