import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { localStorageAdapter } from "@/features/progress-tracker/persistence/local-storage-adapter";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { emptyProfileProgress } from "@/features/progress-tracker/types";

import { Providers } from "./providers";

import type { ProgressTrackerSnapshot } from "@/features/progress-tracker/persistence/types";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.restoreAllMocks();
});

describe("Providers", () => {
  it("renders its children", () => {
    vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);
    render(
      <Providers>
        <p>child content</p>
      </Providers>,
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("hydrates the Progress Tracker store on mount - the fix for Phase 5 step 14's real cross-feature bug (Maps reads activeProfileId directly, so it must be hydrated app-wide, not only while ProgressTrackerPage itself is mounted)", async () => {
    const snapshot: ProgressTrackerSnapshot = {
      schemaVersion: 1,
      exportedAt: "2026-07-14T00:00:00.000Z",
      profiles: [{ id: "p1", name: "PMC", mode: "PVP", faction: "BEAR", face: null }],
      activeProfileId: "p1",
      progressByProfile: { p1: emptyProfileProgress() },
      autoStartNext: true,
    };
    vi.spyOn(localStorageAdapter, "read").mockResolvedValue(snapshot);

    render(
      <Providers>
        <p>child content</p>
      </Providers>,
    );

    await waitFor(() => {
      expect(useProgressTrackerStore.getState().activeProfileId).toBe("p1");
    });
  });
});
