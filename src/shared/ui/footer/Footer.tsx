import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { ContactLink } from "./ContactLink";

/**
 * Site-wide footer: tagline, unaffiliation disclaimer, the "Credits" link
 * (data/asset source attribution), the "Privacy" link (privacy policy), and
 * the "Contact us" link (email + Discord contact info).
 */
export function Footer() {
  return (
    <footer className="border-border text-muted-foreground border-t py-6 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>Built for the Tarkov community. Not affiliated with Battlestate Games.</p>
        <div className="flex items-center gap-4">
          <TransitionLink
            href="/credits"
            className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
          >
            Credits
          </TransitionLink>
          <TransitionLink
            href="/privacy"
            className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
          >
            Privacy
          </TransitionLink>
          <ContactLink />
        </div>
      </div>
    </footer>
  );
}
