import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapTimes } from "./MapTimes";

describe("MapTimes", () => {
  it("renders nothing when there's no raid duration and no player count", () => {
    const { container } = render(
      <MapTimes raidTimes={{ raidMinutes: null, extractMinutes: null, players: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders raid duration and extract time in minutes", () => {
    render(<MapTimes raidTimes={{ raidMinutes: 45, extractMinutes: 38, players: null }} />);
    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.getByText("38m")).toBeInTheDocument();
  });

  it("renders the player count only when present", () => {
    render(<MapTimes raidTimes={{ raidMinutes: 45, extractMinutes: 38, players: "8-12" }} />);
    expect(screen.getByText("Players")).toBeInTheDocument();
    expect(screen.getByText("8-12")).toBeInTheDocument();
  });

  it("omits the Players row when players is null", () => {
    render(<MapTimes raidTimes={{ raidMinutes: 45, extractMinutes: 38, players: null }} />);
    expect(screen.queryByText("Players")).not.toBeInTheDocument();
  });

  it("shows a placeholder when raidMinutes is null but players is present", () => {
    render(<MapTimes raidTimes={{ raidMinutes: null, extractMinutes: null, players: "8-12" }} />);
    expect(screen.getAllByText("…")).toHaveLength(2);
  });
});
