import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { copyToClipboard } from "@/shared/lib/clipboard";
import { downloadBlob } from "@/shared/lib/download-blob";
import { useToastStore } from "@/shared/ui/toast/toast-store";

import { MODIFIER_SEASON } from "../data/seasonal-modifiers";
import { savePicks } from "../lib/modifier-picks-storage";
import { CanvasBlockedError } from "../lib/modifier-plan-image";
import { renderPlanImage } from "../lib/render-plan-image";

import { SeasonalModifierPlanner } from "./SeasonalModifierPlanner";

vi.mock("@/shared/lib/clipboard", () => ({ copyToClipboard: vi.fn(() => Promise.resolve(true)) }));
vi.mock("@/shared/lib/download-blob", () => ({ downloadBlob: vi.fn() }));
// jsdom has no canvas: the drawing itself is covered by modifier-plan-image's tests.
vi.mock("../lib/render-plan-image", () => ({
  renderPlanImage: vi.fn(() => Promise.resolve(new Blob(["png"], { type: "image/png" }))),
}));

const STORAGE_KEY = `tarkovguides.seasonal-modifier-picks.${MODIFIER_SEASON.id}`;

function setHash(hash: string): void {
  window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
}

/** Renders the planner opened from a link, with Lucky already saved as the reader's own pick. */
function openLink(hash: string): void {
  savePicks(STORAGE_KEY, ["lucky"]);
  setHash(hash);
  render(<SeasonalModifierPlanner />);
}

function sharedBanner(): HTMLElement {
  return screen.getByRole("region", { name: "Shared plan" });
}

function queryBanner(): HTMLElement | null {
  return screen.queryByRole("region", { name: "Shared plan" });
}

function bannerButton(name: string): HTMLElement {
  return within(sharedBanner()).getByRole("button", { name });
}

function card(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

function pointsPanel(): HTMLElement {
  return screen.getByRole("region", { name: "Your points" });
}

beforeEach(() => {
  savePicks(STORAGE_KEY, []);
  window.localStorage.clear();
  setHash("");
  vi.mocked(copyToClipboard).mockClear();
  vi.mocked(downloadBlob).mockClear();
  vi.mocked(renderPlanImage).mockClear();
  useToastStore.getState().dismiss();
});

describe("SeasonalModifierPlanner", () => {
  it("shows all three sections, with global modifiers not pickable", () => {
    render(<SeasonalModifierPlanner />);

    for (const title of ["Global modifiers", "Personal positive", "Personal negative"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("Untar Control")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Untar Control/ })).not.toBeInTheDocument();
  });

  it("tracks the balance as modifiers are picked", () => {
    render(<SeasonalModifierPlanner />);

    fireEvent.click(card(/^Average/));
    expect(card(/^Average/)).toHaveAttribute("aria-pressed", "true");
    expect(within(pointsPanel()).getByText("8 points short")).toBeInTheDocument();

    fireEvent.click(card(/^No Flea Market/));
    expect(within(pointsPanel()).getByText("Plan works")).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('["average","no-flea-market"]');

    fireEvent.click(screen.getByRole("button", { name: "Clear 2 picks" }));
    expect(within(pointsPanel()).getByText("Nothing picked yet")).toBeInTheDocument();
  });

  it("labels confirmed clashes and guesses, and can leave guesses out", () => {
    render(<SeasonalModifierPlanner />);
    fireEvent.click(card(/^Average/));
    fireEvent.click(card(/^Prodigy/));
    fireEvent.click(card(/^Introvert/));

    const clashes = screen.getByRole("region", { name: "Clashes in your picks" });
    expect(within(clashes).getByText("Average and Prodigy")).toBeInTheDocument();
    expect(within(clashes).getByText("Confirmed in Season 1")).toBeInTheDocument();
    expect(within(clashes).getByText("Average and Introvert")).toBeInTheDocument();
    expect(within(clashes).getAllByText("Our guess").length).toBeGreaterThan(0);
    expect(card(/^Introvert/)).toHaveTextContent("Clashes with Average (our guess)");
    expect(card(/^Prodigy/)).toHaveTextContent("Clashes with Average (Season 1)");

    fireEvent.click(within(clashes).getByLabelText("Include our guesses"));
    expect(within(clashes).queryByText("Average and Introvert")).not.toBeInTheDocument();
    expect(within(clashes).getByText("Average and Prodigy")).toBeInTheDocument();
    expect(card(/^Introvert/)).not.toHaveTextContent("Clashes with");
  });

  it("dims cards outside the highlighted category and polarity", () => {
    render(<SeasonalModifierPlanner />);

    fireEvent.click(screen.getByRole("button", { name: /Hideout & crafting/ }));
    expect(card(/^Advanced Hideout/).className).not.toContain("opacity-30");
    expect(card(/^Sprinter/).className).toContain("opacity-30");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Positive" }));
    expect(card(/^Sprinter/).className).toContain("opacity-30");
    expect(card(/^Exhaustion/).className).not.toContain("opacity-30");
  });

  it("restores saved picks", () => {
    savePicks(STORAGE_KEY, ["lucky"]);
    render(<SeasonalModifierPlanner />);

    expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "true");
  });

  describe("share link", () => {
    it("copies a link with the current picks", async () => {
      render(<SeasonalModifierPlanner />);
      expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();

      fireEvent.click(card(/^Average/));
      fireEvent.click(card(/^No Flea Market/));
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

      const { origin, pathname } = window.location;
      expect(copyToClipboard).toHaveBeenCalledWith(`${origin}${pathname}#s=2&p=AAAAEAAAIA`);
      await waitFor(() => {
        expect(useToastStore.getState().toast?.message).toBe("Link copied");
      });
    });

    it("shows the copy worked on the button itself, then resets", async () => {
      vi.useFakeTimers();
      try {
        savePicks(STORAGE_KEY, ["lucky"]);
        render(<SeasonalModifierPlanner />);

        fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
        await act(async () => {
          await Promise.resolve();
        });
        expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

        act(() => {
          vi.advanceTimersByTime(2000);
        });
        expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("restarts Copied on another copy, and drops it once the picks change", async () => {
      vi.useFakeTimers();
      try {
        savePicks(STORAGE_KEY, ["lucky"]);
        render(<SeasonalModifierPlanner />);
        const copy = async (name: string) => {
          fireEvent.click(screen.getByRole("button", { name }));
          await act(async () => {
            await Promise.resolve();
          });
        };

        await copy("Copy link");
        act(() => {
          vi.advanceTimersByTime(1500);
        });
        await copy("Copied");
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

        fireEvent.click(card(/^Average/));
        expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("says so when the link can't be copied", async () => {
      vi.mocked(copyToClipboard).mockResolvedValueOnce(false);
      savePicks(STORAGE_KEY, ["lucky"]);
      render(<SeasonalModifierPlanner />);

      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

      await waitFor(() => {
        expect(useToastStore.getState().toast?.message).toMatch(/Couldn't copy/);
      });
      expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
    });

    it("opens a shared link without touching saved picks", () => {
      openLink("#s=2&p=AAAAEA");

      expect(sharedBanner()).toHaveTextContent("replaces your 1 saved pick");
      expect(screen.getByRole("region", { name: "Shared plan points" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Clashes in this plan" })).toBeInTheDocument();
      expect(card(/^Average/)).toHaveAttribute("aria-pressed", "true");
      expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(card(/^Prodigy/));
      expect(card(/^Prodigy/)).toHaveAttribute("aria-pressed", "true");
      expect(window.location.hash).toBe("#s=2&p=AAAAEQ");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('["lucky"]');
    });

    it("saves a shared plan as my picks", () => {
      openLink("#s=2&p=AAAAEA");

      fireEvent.click(bannerButton("Save as my picks"));

      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('["average"]');
      expect(window.location.hash).toBe("");
      expect(queryBanner()).not.toBeInTheDocument();
      expect(card(/^Average/)).toHaveAttribute("aria-pressed", "true");
    });

    it("goes back to my picks, with an undo", () => {
      openLink("#s=2&p=AAAAEA");
      fireEvent.click(card(/^Prodigy/));

      fireEvent.click(bannerButton("Back to my picks"));

      expect(queryBanner()).not.toBeInTheDocument();
      expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "true");
      expect(card(/^Average/)).toHaveAttribute("aria-pressed", "false");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('["lucky"]');

      act(() => {
        useToastStore.getState().toast?.action?.onClick();
      });
      expect(sharedBanner()).toBeInTheDocument();
      expect(card(/^Prodigy/)).toHaveAttribute("aria-pressed", "true");
    });

    it("follows a link pasted into the same tab", () => {
      render(<SeasonalModifierPlanner />);
      expect(queryBanner()).not.toBeInTheDocument();

      act(() => {
        setHash("#s=2&p=AAAAQA");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });

      expect(sharedBanner()).toBeInTheDocument();
      expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "true");
    });

    it("explains a link from another season", () => {
      openLink("#s=3&p=AAAAEA");

      expect(sharedBanner()).toHaveTextContent("different season");
      expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(bannerButton("Dismiss"));
      expect(queryBanner()).not.toBeInTheDocument();
      expect(window.location.hash).toBe("");
    });

    it("explains a damaged link", () => {
      openLink("#p=AAAAEA");

      expect(sharedBanner()).toHaveTextContent("incomplete or damaged");
      expect(pointsPanel()).toBeInTheDocument();
      expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("PNG download", () => {
    it("downloads a PNG of the picks", async () => {
      savePicks(STORAGE_KEY, ["average", "prodigy", "no-flea-market"]);
      render(<SeasonalModifierPlanner />);

      fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

      await waitFor(() => {
        expect(downloadBlob).toHaveBeenCalledWith(
          expect.any(Blob),
          "untar-control-modifier-plan.png",
        );
      });
      const [image] = vi.mocked(renderPlanImage).mock.calls[0] ?? [];
      expect(image?.positive.map((pick) => pick.name)).toEqual(["Prodigy", "Average"]);
      expect(image?.negative.map((pick) => pick.name)).toEqual(["No Flea Market"]);
      expect(image?.clashes).toEqual(["Average and Prodigy (Season 1)"]);
      expect(image?.footer).toMatch(/#s=2&p=\S+$/);
    });

    it("says so when the image can't be made", async () => {
      vi.mocked(renderPlanImage).mockRejectedValueOnce(new Error("no canvas"));
      savePicks(STORAGE_KEY, ["lucky"]);
      render(<SeasonalModifierPlanner />);

      fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

      await waitFor(() => {
        expect(useToastStore.getState().toast?.message).toMatch(/Couldn't make the image/);
      });
      expect(downloadBlob).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled();
    });

    it("explains when the browser blocks reading the image", async () => {
      vi.mocked(renderPlanImage).mockRejectedValueOnce(new CanvasBlockedError());
      savePicks(STORAGE_KEY, ["lucky"]);
      render(<SeasonalModifierPlanner />);

      fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

      await waitFor(() => {
        expect(useToastStore.getState().toast?.message).toMatch(/privacy/);
      });
      expect(downloadBlob).not.toHaveBeenCalled();
    });
  });
});
