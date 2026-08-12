import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { localStorageAdapter } from "@/features/progress-tracker/persistence/local-storage-adapter";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import ProgressTrackerRoute from "./page";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);
  vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
  vi.mocked(fetchTarkovGameData).mockResolvedValue({
    tasks: [],
    tasksPve: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [],
    traders: [],
    barters: [],
    crafts: [],
  });
});

describe("ProgressTrackerRoute", () => {
  it("renders without crashing", () => {
    renderWithQueryClient(<ProgressTrackerRoute />);
    expect(screen.getByRole("heading", { name: "Progress Tracker" })).toBeInTheDocument();
  });
});
