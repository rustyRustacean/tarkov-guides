import { ResourcesPage } from "@/features/resources/components/ResourcesPage";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resources | TarkovGuides",
  description:
    "Calculators, charts and tips built into TarkovGuides, plus community sites and Discords worth knowing about.",
};

/** Route entry for the Resources hub: thin, delegates to the feature component. */
export default function ResourcesRoute() {
  return <ResourcesPage />;
}
