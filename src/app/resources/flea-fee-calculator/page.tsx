import { FleaFeeCalculator } from "@/features/resources/components/FleaFeeCalculator";
import { ResourceItemPage } from "@/features/resources/components/ResourceItemPage";
import {
  hostedResourceMetadata,
  requireHostedResource,
} from "@/features/resources/lib/resource-metadata";

const SLUG = "flea-fee-calculator";

export const metadata = hostedResourceMetadata(SLUG);

/** Route entry for the Flea Fee Calculator: the shared resource shell around the tool. */
export default function FleaFeeCalculatorRoute() {
  return (
    <ResourceItemPage resource={requireHostedResource(SLUG)}>
      <FleaFeeCalculator />
    </ResourceItemPage>
  );
}
