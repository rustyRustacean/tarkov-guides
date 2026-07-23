import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { copyToClipboard } from "@/shared/lib/clipboard";

import { SessionStatusPill } from "./SessionStatusPill";

vi.mock("@/shared/lib/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

const participants = [
  { id: "host-1", name: "Alice", color: "#ef4444", isHost: true },
  { id: "guest-1", name: "Bob", color: "#3b82f6", isHost: false },
];

describe("SessionStatusPill", () => {
  it("shows Request control for a non-controller", async () => {
    render(
      <SessionStatusPill
        code="silent-scav-42"
        isHost={false}
        isController={false}
        participants={participants}
        onRequestControl={vi.fn()}
        onReleaseControl={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Request control")).toBeInTheDocument();
    expect(screen.queryByText("Release control")).not.toBeInTheDocument();
  });

  it("shows Release control (not Request) for a non-host controller", async () => {
    render(
      <SessionStatusPill
        code="silent-scav-42"
        isHost={false}
        isController={true}
        participants={participants}
        onRequestControl={vi.fn()}
        onReleaseControl={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Release control")).toBeInTheDocument();
    expect(screen.queryByText("Request control")).not.toBeInTheDocument();
  });

  it("shows End session for the host and Leave session for a guest", async () => {
    const { rerender } = render(
      <SessionStatusPill
        code="silent-scav-42"
        isHost={true}
        isController={true}
        participants={participants}
        onRequestControl={vi.fn()}
        onReleaseControl={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("End session")).toBeInTheDocument();

    rerender(
      <SessionStatusPill
        code="silent-scav-42"
        isHost={false}
        isController={false}
        participants={participants}
        onRequestControl={vi.fn()}
        onReleaseControl={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    expect(await screen.findByText("Leave session")).toBeInTheDocument();
  });

  it("calls onEnd when the host clicks End session", async () => {
    const onEnd = vi.fn();
    render(
      <SessionStatusPill
        code="silent-scav-42"
        isHost={true}
        isController={true}
        participants={participants}
        onRequestControl={vi.fn()}
        onReleaseControl={vi.fn()}
        onLeave={vi.fn()}
        onEnd={onEnd}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(await screen.findByText("End session"));
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("copies the code via the clipboard utility", async () => {
    render(
      <SessionStatusPill
        code="silent-scav-42"
        isHost={true}
        isController={true}
        participants={participants}
        onRequestControl={vi.fn()}
        onReleaseControl={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(await screen.findByText("Copy code"));
    expect(copyToClipboard).toHaveBeenCalledWith("silent-scav-42");
  });
});
