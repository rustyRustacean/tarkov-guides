import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { idbDelImage, idbGetImage, idbPutImage } from "../persistence/custom-map-idb";
import { useMapsSession } from "../session/use-maps-session";
import { useMapsStore } from "../store";

import { MapVariantSwitcher } from "./MapVariantSwitcher";

vi.mock("../persistence/custom-map-idb", () => ({
  idbGetImage: vi.fn(),
  idbPutImage: vi.fn(),
  idbDelImage: vi.fn(),
}));
vi.mock("../session/use-maps-session", () => ({ useMapsSession: vi.fn() }));

const initialState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialState, true);
  vi.mocked(idbPutImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbDelImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbGetImage).mockReset().mockResolvedValue(undefined);
});

describe("MapVariantSwitcher during a collaborative session", () => {
  it("disables variant tabs for a non-controller", async () => {
    vi.mocked(useMapsSession).mockReturnValue({ active: true, isController: false } as never);
    const user = userEvent.setup();
    render(<MapVariantSwitcher normalizedName="reserve" />);

    const tab = screen.getByRole("tab", { name: "3D" });
    expect(tab).toBeDisabled();

    await user.click(tab);
    expect(useMapsStore.getState().mapVariants.reserve).not.toBe("3d");
  });

  it("leaves variant tabs enabled for the controller", async () => {
    vi.mocked(useMapsSession).mockReturnValue({ active: true, isController: true } as never);
    const user = userEvent.setup();
    render(<MapVariantSwitcher normalizedName="reserve" />);

    const tab = screen.getByRole("tab", { name: "3D" });
    expect(tab).toBeEnabled();

    await user.click(tab);
    expect(useMapsStore.getState().mapVariants.reserve).toBe("3d");
  });
});
