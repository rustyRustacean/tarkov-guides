import "@testing-library/jest-dom/vitest";

/**
 * jsdom doesn't implement the Pointer Events capture API, even though
 * TypeScript's DOM types (correctly, for real browsers) declare these
 * methods as always present - so an `if (!Element.prototype.x)` existence
 * check would be flagged as statically-always-false by the type checker.
 * Several Radix UI primitives (Toast's swipe-to-dismiss gesture, among
 * others) call these methods unconditionally, so without a stub any test
 * that fires pointer events at them throws
 * `target.hasPointerCapture is not a function`. Assigned unconditionally
 * since this file only ever runs in the jsdom test environment.
 */
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;

/**
 * jsdom doesn't implement `window.matchMedia` at all. Several hooks read
 * media queries reactively (`prefers-reduced-motion`, the existing view-
 * transitions support check) via `useSyncExternalStore`, so any test that
 * mounts them needs a stub - a minimal `MediaQueryList`-shaped object
 * whose `matches` is `false` by default and whose listener methods are
 * no-ops unless a test explicitly overrides `window.matchMedia` to
 * simulate a change.
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

/**
 * jsdom implements neither `ResizeObserver` nor the Fullscreen API. Stubbed
 * unconditionally (this file only runs under jsdom) so components that use
 * them - `MapViewer`'s resize-driven `invalidateSize()`, `use-fullscreen`'s
 * `requestFullscreen`/`exitFullscreen` - don't throw `is not a function` in
 * tests that don't specifically exercise resize/fullscreen behavior. Tests
 * that DO need to assert on these call `vi.fn()` overrides themselves.
 */
class ResizeObserverStub {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}
globalThis.ResizeObserver = ResizeObserverStub;

Element.prototype.requestFullscreen = () => Promise.resolve();
document.exitFullscreen = () => Promise.resolve();
