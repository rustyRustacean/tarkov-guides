import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMapsStore } from "../store";

import { MapPicker } from "./MapPicker";

// This file exercises MapPicker's own selection behavior, not collaborative-
// session control-locking (covered by MapPicker.session.test.tsx) - mocking
// this hook as "no session active" avoids needing a real RoomProvider
// ancestor just to render the component.
vi.mock("../session/use-maps-session", () => ({
  useMapsSession: () => ({ active: false, isController: false }),
}));

const initialState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialState, true);
});

describe("MapPicker", () => {
  it("renders a tab for every one of the 13 maps, in canonical order", () => {
    render(<MapPicker />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Reserve",
      "Customs",
      "Woods",
      "Streets of Tarkov",
      "Shoreline",
      "Labyrinth",
      "Interchange",
      "Lighthouse",
      "The Lab",
      "Factory",
      "Ground Zero",
      "Terminal",
      "Ice Breaker",
    ]);
  });

  it("defaults to Reserve being active", () => {
    render(<MapPicker />);
    expect(screen.getByRole("tab", { name: "Reserve" })).toHaveAttribute("data-state", "active");
  });

  it("selecting a tab updates the store's currentMap", async () => {
    const user = userEvent.setup();
    render(<MapPicker />);

    await user.click(screen.getByRole("tab", { name: "Woods" }));

    expect(useMapsStore.getState().currentMap).toBe("woods");
  });

  it("reflects an already-selected currentMap as the active tab", () => {
    useMapsStore.getState().setCurrentMap("factory");
    render(<MapPicker />);

    expect(screen.getByRole("tab", { name: "Factory" })).toHaveAttribute("data-state", "active");
  });
});
