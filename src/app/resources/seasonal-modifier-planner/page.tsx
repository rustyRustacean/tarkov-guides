import { ResourceItemPage } from "@/features/resources/components/ResourceItemPage";
import { SeasonalModifierPlanner } from "@/features/resources/components/SeasonalModifierPlanner";
import {
  hostedResourceMetadata,
  requireHostedResource,
} from "@/features/resources/lib/resource-metadata";

const SLUG = "seasonal-modifier-planner";

export const metadata = hostedResourceMetadata(SLUG);

/** Route entry for the Seasonal Modifier Planner: the shared resource shell, widened for the card grid. */
export default function SeasonalModifierPlannerRoute() {
  return (
    <ResourceItemPage resource={requireHostedResource(SLUG)} wide>
      <SeasonalModifierPlanner />
    </ResourceItemPage>
  );
}
