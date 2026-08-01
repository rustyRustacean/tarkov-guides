"use client";

import { useEffect, useState } from "react";

/**
 * Whether `node` currently intersects the viewport at or above `threshold`
 * (fraction of the node's own area that must be visible, 0-1). Takes an
 * already-obtained node rather than returning its own ref, so a single
 * observed element can be watched at multiple thresholds at once (e.g.
 * `VideoCompareSlider` needs both a low "roughly on screen, safe to
 * autoplay" threshold and a near-1 "fully on screen, play the reveal intro"
 * threshold on the very same container) without juggling merged refs.
 *
 * Two real consumers: `AutoplayVideo` (pause when scrolled off-screen -
 * these are looping demo clips, decoding/rendering them off-screen is pure
 * wasted CPU/battery) and `VideoCompareSlider` (same, plus the fully-visible
 * intro-reveal trigger).
 */
export function useInViewport(node: Element | null, threshold: number): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    // No reset-to-false branch for a `null` node: the only way that happens
    // is the initial render before a callback ref attaches (already `false`
    // via `useState` above) or unmount (nothing renders afterward to see a
    // stale `true` anyway) - so there's nothing to synchronize here, just a
    // subscription to skip.
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsIntersecting(entry.isIntersecting);
      },
      { threshold },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [node, threshold]);

  return isIntersecting;
}
