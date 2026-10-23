import { buttonVariants } from "@/shared/ui/button/Button";
import { cn } from "@/shared/ui/lib/cn";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

/**
 * The header's help button: a large, accent-colored "?" that opens the help
 * page. Deliberately a step bigger than the other corner icon buttons (40px
 * vs 36px) so it reads as the "start here" control, while still fitting the
 * header's 56px height without changing it.
 */
export function HelpLink() {
  return (
    <TransitionLink
      href="/help"
      aria-label="Help"
      title="Help: companion and map tools"
      className={cn(
        buttonVariants({ variant: "default", size: "icon" }),
        "h-10 w-10 rounded-full text-xl leading-none font-bold",
      )}
    >
      ?
    </TransitionLink>
  );
}
