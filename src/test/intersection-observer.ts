import { vi } from "vitest";

interface CapturedInstance {
  threshold: number | number[] | undefined;
  callback: (entries: IntersectionObserverEntry[]) => void;
}

/**
 * Overrides the global `IntersectionObserver` (stubbed as an inert no-op in
 * `setup.ts`, since jsdom doesn't implement it at all) with one that
 * records every constructed instance's callback/threshold, so a test can
 * fire intersection changes manually. Mirrors `MapViewer.test.tsx`'s
 * `CapturingResizeObserver` pattern for the same underlying jsdom gap.
 *
 * Tracks *all* constructed instances, not just the most recent one -
 * `VideoCompareSlider` watches the same container at two different
 * thresholds (`useInViewport` called twice), so a test needs to fire each
 * one independently via `fireForThreshold`.
 */
export function installCapturingIntersectionObserver() {
  const original = globalThis.IntersectionObserver;
  const instances: CapturedInstance[] = [];
  const disconnect = vi.fn();

  class CapturingIntersectionObserver {
    constructor(
      cb: (entries: IntersectionObserverEntry[]) => void,
      options?: IntersectionObserverInit,
    ) {
      instances.push({ callback: cb, threshold: options?.threshold });
    }
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = disconnect;
    takeRecords = () => [];
  }

  globalThis.IntersectionObserver =
    CapturingIntersectionObserver as unknown as typeof IntersectionObserver;

  return {
    /** Fires an intersection change on the (first, if several) observer constructed with the given threshold. */
    fireForThreshold: (threshold: number, isIntersecting: boolean) => {
      const instance = instances.find((i) => i.threshold === threshold);
      instance?.callback([{ isIntersecting } as IntersectionObserverEntry]);
    },
    /** Fires an intersection change on the most recently constructed observer - convenient when only one is expected. */
    fire: (isIntersecting: boolean) => {
      instances[instances.length - 1]?.callback([{ isIntersecting } as IntersectionObserverEntry]);
    },
    instanceCount: () => instances.length,
    getThresholds: () => instances.map((i) => i.threshold),
    disconnect,
    /** Restores the real (stubbed) global - call in an `afterEach`/at the end of the test. */
    restore: () => {
      globalThis.IntersectionObserver = original;
    },
  };
}
