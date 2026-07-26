import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMapsSession } from "../session/use-maps-session";
import { useMapsStore } from "../store";

import { MapPicker } from "./MapPicker";

vi.mock("../session/use-maps-session", () => ({ useMapsSession: vi.fn() }));

const initialState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialState, true);
});

describe("MapPicker during a collaborative session", () => {
  it("disables map tabs for a non-controller", async () => {
    vi.mocked(useMapsSession).mockReturnValue({ active: true, isController: false } as never);
    const user = userEvent.setup();
    render(<MapPicker />);

    const tab = screen.getByRole("tab", { name: "Woods" });
    expect(tab).toBeDisabled();

    await user.click(tab);
    expect(useMapsStore.getState().currentMap).toBe("reserve"); // unchanged
  });

  it("leaves map tabs enabled for the controller", async () => {
    vi.mocked(useMapsSession).mockReturnValue({ active: true, isController: true } as never);
    const user = userEvent.setup();
    render(<MapPicker />);

    const tab = screen.getByRole("tab", { name: "Woods" });
    expect(tab).toBeEnabled();

    await user.click(tab);
    expect(useMapsStore.getState().currentMap).toBe("woods");
  });
});
