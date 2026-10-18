import { HelpPage } from "@/features/help/components/HelpPage";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help | TarkovGuides",
  description: "What the EFT companion and the map tools can do, and how to use each one.",
};

/** Route entry for the help page: thin, delegates to the feature component. */
export default function HelpRoute() {
  return <HelpPage />;
}
