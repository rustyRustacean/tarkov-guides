import { cn } from "../lib/cn";

import type { HTMLAttributes } from "react";

/** A bordered surface container. Compose with `CardHeader`/`CardContent`/`CardFooter`. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-card text-card-foreground rounded-lg border shadow-sm backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}

/** Top section of a `Card` - typically holds `CardTitle` and `CardDescription`. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

/** A `Card`'s heading. Renders as a `<h3>` for correct document outline. */
export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-display text-lg leading-none font-semibold", className)} {...props}>
      {children}
    </h3>
  );
}

/** Secondary/supporting text under a `CardTitle`. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

/** Main body of a `Card`. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

/** Bottom section of a `Card` - typically holds actions. */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
