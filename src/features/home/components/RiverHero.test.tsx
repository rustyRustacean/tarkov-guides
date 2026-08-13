import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/shared/ui/theme/ThemeProvider";

import { RiverHero } from "./RiverHero";

/**
 * jsdom doesn't implement a real canvas 2D context (`getContext("2d")`
 * returns `null` by default), so without a stub, `RiverHero`'s effects bail
 * out before ever reaching `requestAnimationFrame`, making it impossible to
 * test the reduced-motion branch. Scoped to this test file (not a global
 * `src/test/setup.ts` stub, unlike `matchMedia`/Pointer Events) since
 * `RiverHero` is the only canvas consumer in the project today.
 */
function mockCanvasContext() {
  const gradient = { addColorStop: () => undefined };
  const context = {
    scale: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    beginPath: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    get fillStyle() {
      return "";
    },
    set fillStyle(_value: unknown) {
      // no-op setter: tests only assert on scheduling, not draw output
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}

/** Installs a controllable `matchMedia` mock, mirroring the one in `use-prefers-reduced-motion.test.ts`. */
function mockReducedMotion(matches: boolean) {
  window.matchMedia = () =>
    ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

describe("RiverHero", () => {
  beforeEach(() => {
    mockCanvasContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a canvas without crashing", () => {
    mockReducedMotion(false);
    const { container } = render(
      <ThemeProvider>
        <RiverHero />
      </ThemeProvider>,
    );
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("never schedules an animation frame when prefers-reduced-motion is set", () => {
    mockReducedMotion(true);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    render(
      <ThemeProvider>
        <RiverHero />
      </ThemeProvider>,
    );

    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("schedules an animation frame when motion is allowed", () => {
    mockReducedMotion(false);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);

    render(
      <ThemeProvider>
        <RiverHero />
      </ThemeProvider>,
    );

    expect(rafSpy).toHaveBeenCalled();
  });
});
