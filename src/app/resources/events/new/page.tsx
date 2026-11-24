import { CreateEventForm } from "@/features/events/components/CreateEventForm";
import { EventsShell } from "@/features/events/components/EventsShell";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New event | TarkovGuides",
  description: "Set up a Tarkov event scoreboard: modes, team size, raids and teams.",
};

/** Route entry for creating an event. */
export default function NewEventRoute() {
  return (
    <EventsShell current="New event">
      <h1 className="font-display mb-6 text-3xl font-bold">New event</h1>
      <CreateEventForm />
    </EventsShell>
  );
}
