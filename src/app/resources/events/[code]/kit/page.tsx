import { notFound } from "next/navigation";

import { EventsShell } from "@/features/events/components/EventsShell";
import { EventKitCheck } from "@/features/events/components/presets/KitCheckPages";
import { isEventCode } from "@/features/events/lib/event-code";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kit check | TarkovGuides",
  description: "Check a Tarkov kit against an event's role preset.",
  robots: { index: false, follow: false },
};

/** Route entry for checking a kit against one of an event's role presets (`?role=`). */
export default async function EventKitRoute({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  if (!isEventCode(code)) notFound();
  const { role } = await searchParams;
  return (
    <EventsShell current="Kit check">
      <EventKitCheck code={code} roleId={typeof role === "string" ? role : null} />
    </EventsShell>
  );
}
