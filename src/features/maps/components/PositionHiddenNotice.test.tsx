import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompanionPosition } from "@/features/companion/use-companion";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useMapsStore } from "../store";

import { PositionHiddenNotice } from "./PositionHiddenNotice";

import type { RawMap } from "@/shared/lib/tarkov-api/types";

vi.mock("@/features/companion/use-companion", () => ({
  useCompanionPosition: vi.fn(),
}));

vi.mock("@/shared/lib/tarkov-api/use-tarkov-game-data", () => ({
  useTarkovGameData: vi.fn(),
}));

function map(normalizedName: string, nameId: string | null): RawMap {
  return {
    name: normalizedName,
    normalizedName,
    nameId,
    raidDuration: null,
    players: null,
    bosses: [],
  };
}

const MAPS: readonly RawMap[] = [map("customs", "bigmap"), map("reserve", "RezervBase")];
const POSITION = { x: -201.84, z: -3.19, yaw: 88.8, at: 1, map: "bigmap" };

describe("PositionHiddenNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapsStore.setState({ mapVariants: {} });
    vi.mocked(useTarkovGameData).mockReturnValue({ data: { maps: MAPS } } as never);
    vi.mocked(useCompanionPosition).mockReturnValue(POSITION);
  });

  it("offers the switch when the live position's map is open on a variant that hides markers", () => {
    useMapsStore.setState({ mapVariants: { customs: "2d" } });
    render(<PositionHiddenNotice normalizedName="customs" />);

    expect(screen.getByText(/live position is on this map/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show on/i }));
    expect(useMapsStore.getState().mapVariants.customs).toBe("overview");
  });

  it("renders nothing when the active variant already shows markers", () => {
    // No stored choice resolves to the default variant, which is Overview.
    const { container } = render(<PositionHiddenNotice normalizedName="customs" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on a map the position doesn't belong to", () => {
    useMapsStore.setState({ mapVariants: { reserve: "3d" } });
    const { container } = render(<PositionHiddenNotice normalizedName="reserve" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a live position", () => {
    vi.mocked(useCompanionPosition).mockReturnValue(null);
    useMapsStore.setState({ mapVariants: { customs: "2d" } });
    const { container } = render(<PositionHiddenNotice normalizedName="customs" />);
    expect(container).toBeEmptyDOMElement();
  });
});
