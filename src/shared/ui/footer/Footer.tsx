import { ContactLink } from "./ContactLink";

/**
 * Site-wide footer: tagline, unaffiliation disclaimer, and the "Contact us"
 * link (email + Discord contact info). A repository link goes here once the
 * project has a public repo to point at.
 */
export function Footer() {
  return (
    <footer className="border-border text-muted-foreground border-t py-6 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>Built for the Tarkov community. Not affiliated with Battlestate Games.</p>
        <ContactLink />
      </div>
    </footer>
  );
}
