import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { idbDelImage, idbGetImage, idbPutImage } from "../persistence/custom-map-idb";
import { useMapsStore } from "../store";

import { MapVariantSwitcher } from "./MapVariantSwitcher";

vi.mock("../persistence/custom-map-idb", () => ({
  idbGetImage: vi.fn(),
  idbPutImage: vi.fn(),
  idbDelImage: vi.fn(),
}));

const initialState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialState, true);
  vi.mocked(idbPutImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbDelImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbGetImage).mockReset().mockResolvedValue(undefined);
});

describe("MapVariantSwitcher", () => {
  it("renders a tab for every one of the map's variants", () => {
    render(<MapVariantSwitcher normalizedName="reserve" />);
    for (const label of ["Interactable", "Overview", "2D", "3D", "3D tunnels"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("defaults to the Overview tab being active", () => {
    render(<MapVariantSwitcher normalizedName="reserve" />);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("data-state", "active");
  });

  it("selecting a tab updates the store's mapVariants", async () => {
    const user = userEvent.setup();
    render(<MapVariantSwitcher normalizedName="reserve" />);

    await user.click(screen.getByRole("tab", { name: "3D" }));

    expect(useMapsStore.getState().mapVariants.reserve).toBe("3d");
  });

  it("renders nothing for an unknown map", () => {
    const { container } = render(<MapVariantSwitcher normalizedName="not-a-real-map" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("clicking the add-custom-map button opens the dialog", async () => {
    const user = userEvent.setup();
    render(<MapVariantSwitcher normalizedName="reserve" />);

    await user.click(screen.getByRole("button", { name: "Add custom map" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add Custom Map")).toBeInTheDocument();
  });

  it("renders an already-resolved custom variant as an extra tab", () => {
    useMapsStore
      .getState()
      .addCustomMap("reserve", { id: "custom-1", label: "My callouts", custom: true });
    useMapsStore.getState().setCustomMapImage("custom-1", "data:image/png;base64,AAAA");

    render(<MapVariantSwitcher normalizedName="reserve" />);

    expect(screen.getByRole("tab", { name: /My callouts/ })).toBeInTheDocument();
  });

  it("clicking a custom variant's remove button deletes it without switching to that tab", async () => {
    const user = userEvent.setup();
    useMapsStore
      .getState()
      .addCustomMap("reserve", { id: "custom-1", label: "My callouts", custom: true });
    useMapsStore.getState().setCustomMapImage("custom-1", "data:image/png;base64,AAAA");
    render(<MapVariantSwitcher normalizedName="reserve" />);

    await user.click(screen.getByRole("button", { name: "Remove My callouts" }));

    expect(useMapsStore.getState().customMaps.reserve).toEqual([]);
    expect(useMapsStore.getState().mapVariants.reserve).not.toBe("custom-1");
  });
});
