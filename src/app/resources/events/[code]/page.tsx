import { notFound } from "next/navigation";

import { EventPage } from "@/features/events/components/EventPage";
import { EventsShell } from "@/features/events/components/EventsShell";
import { isEventCode } from "@/features/events/lib/event-code";

import type { Metadata } from "next";

/** Event pages are shared by link, not meant to be found by search. */
export const metadata: Metadata = {
  title: "Event scoreboard | TarkovGuides",
  description: "A live Tarkov event scoreboard.",
  robots: { index: false, follow: false },
};

/** Route entry for one event's scoreboard (view-only, or editing with an edit key). */
export default async function EventRoute({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  if (!isEventCode(code)) notFound();
  const { as } = await searchParams;
  return (
    <EventsShell current="Scoreboard">
      <EventPage code={code} viewOnly={as === "viewer"} />
    </EventsShell>
  );
}
