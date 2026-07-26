import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitSessionToken } from "./join-session";
import { useMapSessionStore } from "./session-store";

describe("submitSessionToken", () => {
  beforeEach(() => {
    useMapSessionStore.getState().clearActiveSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("activates the session locally on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "tok" }), { status: 200 })),
    );

    const result = await submitSessionToken("host", "silent-scav-42", "Alice");
    expect(result.ok).toBe(true);
    expect(useMapSessionStore.getState().activeSession).toEqual({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "host",
      displayName: "Alice",
    });
  });

  it("does not activate the session and surfaces the server's reason on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "not-found", reason: "No session found with that code." }),
          {
            status: 404,
          },
        ),
      ),
    );

    const result = await submitSessionToken("join", "silent-scav-42", "Bob");
    expect(result).toEqual({ ok: false, reason: "No session found with that code." });
    expect(useMapSessionStore.getState().activeSession).toBeNull();
  });

  it("reports a friendly reason when the network request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await submitSessionToken("join", "silent-scav-42", "Bob");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/connection/i);
  });
});
