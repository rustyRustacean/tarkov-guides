import { EventsHome } from "@/features/events/components/EventsHome";
import { ResourceItemPage } from "@/features/resources/components/ResourceItemPage";
import {
  hostedResourceMetadata,
  requireHostedResource,
} from "@/features/resources/lib/resource-metadata";

const SLUG = "events";

export const metadata = hostedResourceMetadata(SLUG);

/** Route entry for the Event Scoreboard landing page: start or import an event, reopen your own. */
export default function EventsRoute() {
  return (
    <ResourceItemPage resource={requireHostedResource(SLUG)} wide>
      <EventsHome />
    </ResourceItemPage>
  );
}
