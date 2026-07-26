import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMapSessionStore } from "../../session/session-store";
import { useMapsSession } from "../../session/use-maps-session";
import { useSessionInactivityClose } from "../../session/use-session-inactivity-close";
import { useSessionUrlParam } from "../../session/use-session-url-param";

import { SessionControls } from "./SessionControls";

vi.mock("../../session/use-maps-session", () => ({ useMapsSession: vi.fn() }));
vi.mock("../../session/use-session-url-param", () => ({ useSessionUrlParam: vi.fn() }));
vi.mock("../../session/use-session-inactivity-close", () => ({
  useSessionInactivityClose: vi.fn(),
}));

function baseSession() {
  return {
    active: false,
    selfId: "p1",
    isHost: false,
    isController: false,
    hostId: null,
    controllerId: null,
    participants: [],
    view: null,
    setView: vi.fn(),
    requestControl: vi.fn(),
    releaseControl: vi.fn(),
    incomingControlRequest: null,
    respondToControlRequest: vi.fn(),
  };
}

describe("SessionControls", () => {
  beforeEach(() => {
    useMapSessionStore.getState().clearActiveSession();
    vi.mocked(useMapsSession).mockReturnValue(baseSession());
    vi.mocked(useSessionUrlParam).mockReturnValue({
      pendingJoinCode: null,
      clearPendingJoinCode: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });

  it("shows the Collaborate button when no session is active", () => {
    render(<SessionControls />);
    expect(screen.getByRole("button", { name: /collaborate/i })).toBeInTheDocument();
  });

  it("opens the entry dialog pre-filled to Join when an invite link code is pending", () => {
    vi.mocked(useSessionUrlParam).mockReturnValue({
      pendingJoinCode: "silent-scav-42",
      clearPendingJoinCode: vi.fn(),
    });
    render(<SessionControls />);
    expect(screen.getByLabelText("Join code")).toHaveValue("silent-scav-42");
  });

  it("shows the participant status pill once a session is active", async () => {
    useMapSessionStore.getState().setActiveSession({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "host",
      displayName: "Alice",
    });
    render(<SessionControls />);
    expect(screen.queryByRole("button", { name: /collaborate/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText(/silent-scav-42/)).toBeInTheDocument();
  });

  it("leaving as a guest clears the local session without calling the end API", async () => {
    useMapSessionStore.getState().setActiveSession({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "guest",
      displayName: "Bob",
    });
    vi.mocked(useMapsSession).mockReturnValue({ ...baseSession(), isHost: false });
    render(<SessionControls />);

    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(await screen.findByText("Leave session"));

    expect(fetch).not.toHaveBeenCalled();
    expect(useMapSessionStore.getState().activeSession).toBeNull();
  });

  it("ending as the host calls the end API and then clears the local session", async () => {
    useMapSessionStore.getState().setActiveSession({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "host",
      displayName: "Alice",
    });
    vi.mocked(useMapsSession).mockReturnValue({
      ...baseSession(),
      isHost: true,
      isController: true,
    });
    render(<SessionControls />);

    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(await screen.findByText("End session"));

    expect(fetch).toHaveBeenCalledWith(
      "/api/maps-session/end",
      expect.objectContaining({ method: "POST" }),
    );
    expect(useMapSessionStore.getState().activeSession).toBeNull();
  });

  it("enables the inactivity-close timer only when active and hosting", () => {
    render(<SessionControls />);
    expect(vi.mocked(useSessionInactivityClose).mock.calls.at(-1)?.[0]).toBe(false);

    useMapSessionStore.getState().setActiveSession({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "guest",
      displayName: "Bob",
    });
    vi.mocked(useMapsSession).mockReturnValue({ ...baseSession(), isHost: false });
    render(<SessionControls />);
    expect(vi.mocked(useSessionInactivityClose).mock.calls.at(-1)?.[0]).toBe(false);

    vi.mocked(useMapsSession).mockReturnValue({
      ...baseSession(),
      isHost: true,
      isController: true,
    });
    render(<SessionControls />);
    expect(vi.mocked(useSessionInactivityClose).mock.calls.at(-1)?.[0]).toBe(true);
  });

  it("inactivity timeout ends the session and toasts the host", async () => {
    useMapSessionStore.getState().setActiveSession({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "host",
      displayName: "Alice",
    });
    vi.mocked(useMapsSession).mockReturnValue({
      ...baseSession(),
      isHost: true,
      isController: true,
    });
    render(<SessionControls />);

    const onTimeout = vi.mocked(useSessionInactivityClose).mock.calls.at(-1)?.[1];
    onTimeout?.();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/maps-session/end",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(useMapSessionStore.getState().activeSession).toBeNull();
  });
});
