import { EventsShell } from "@/features/events/components/EventsShell";
import { StandaloneKitCheck } from "@/features/events/components/presets/KitCheckPages";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kit check | TarkovGuides",
  description: "Check a Tarkov kit against a shared preset.",
  robots: { index: false, follow: false },
};

/** Route entry for the standalone kit checker; the preset and kit ride in the link's fragment. */
export default function StandaloneKitRoute() {
  return (
    <EventsShell current="Kit check">
      <StandaloneKitCheck />
    </EventsShell>
  );
}
