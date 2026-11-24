import { notFound } from "next/navigation";

import { EventOverlay } from "@/features/events/components/EventOverlay";
import { isEventCode } from "@/features/events/lib/event-code";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event overlay | TarkovGuides",
  robots: { index: false, follow: false },
};

const DEFAULT_TOP = 10;
const MAX_TOP = 50;

/** Route entry for an event's stream overlay (no site chrome, transparent background; see `chromeless-routes.ts`). */
export default async function EventOverlayRoute({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  if (!isEventCode(code)) notFound();
  const { mode, top } = await searchParams;
  const parsedTop = typeof top === "string" ? Number.parseInt(top, 10) : DEFAULT_TOP;
  return (
    <div className="p-4">
      <EventOverlay
        code={code}
        mode={typeof mode === "string" ? mode : null}
        top={Number.isFinite(parsedTop) ? Math.min(Math.max(parsedTop, 1), MAX_TOP) : DEFAULT_TOP}
      />
    </div>
  );
}
