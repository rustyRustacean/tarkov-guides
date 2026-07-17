"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef } from "react";

import { useViewTransition } from "./use-view-transition";

import type { ComponentProps, MouseEvent } from "react";

export interface TransitionLinkProps extends Omit<ComponentProps<typeof NextLink>, "href"> {
  /**
   * Narrowed to a plain string (unlike `next/link`'s `href`, which also
   * accepts a `UrlObject`) - this component needs the href as a string to
   * pass to `router.push`, and silently stringifying a `UrlObject` would
   * produce `"[object Object]"` rather than a real URL.
   */
  href: string;
}

/**
 * Drop-in replacement for `next/link`'s `Link` that wraps client-side
 * navigation in `document.startViewTransition` when supported, for a
 * smoother page transition. Falls back to a plain `router.push` (still
 * client-side, just without the transition animation) when unsupported.
 * Modifier-key clicks (opening in a new tab, etc.) are left entirely to
 * the browser's default behavior.
 */
export const TransitionLink = forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  function TransitionLink({ href, onClick, ...props }, ref) {
    const router = useRouter();
    const { startViewTransition } = useViewTransition();

    return (
      <NextLink
        ref={ref}
        href={href}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          onClick?.(event);

          const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
          if (event.defaultPrevented || isModifiedClick) {
            return;
          }

          event.preventDefault();
          startViewTransition(() => {
            router.push(href);
          });
        }}
        {...props}
      />
    );
  },
);
