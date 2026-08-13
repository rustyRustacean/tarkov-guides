import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useBroadcastEvent,
  useEventListener,
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "./liveblocks-config";
import { useMapSessionStore } from "./session-store";
import { useMapsSession } from "./use-maps-session";

vi.mock("./liveblocks-config", () => ({
  useSelf: vi.fn(),
  useOthers: vi.fn(),
  useStorage: vi.fn(),
  useMutation: vi.fn(),
  useBroadcastEvent: vi.fn(),
  useEventListener: vi.fn(),
}));

interface FakeStorage {
  hostId: string;
  controllerId: string;
  view: unknown;
}

function makeUser(id: string, name: string, color: string, isHost: boolean) {
  return { id, info: { name, color, isHost } };
}

function setUpMocks(options: {
  self: ReturnType<typeof makeUser> | null;
  others?: ReturnType<typeof makeUser>[];
  storage?: Partial<FakeStorage>;
}) {
  const storage: FakeStorage = {
    hostId: "host-1",
    controllerId: "host-1",
    view: null,
    ...options.storage,
  };
  const others = options.others ?? [];

  vi.mocked(useSelf).mockReturnValue(options.self);
  vi.mocked(useOthers).mockReturnValue(others);
  // Cast the mock implementation itself to `never` (matching `useMutation`'s
  // mock below): the real `useStorage` selector's `root` param is widened to
  // a broad `Json` union by `SessionStorage`'s index signature (see
  // `liveblocks-config.ts`'s doc comment), which this test's precise
  // `FakeStorage` fixture doesn't need to model.
  vi.mocked(useStorage).mockImplementation((<T>(selector: (root: FakeStorage) => T) =>
    selector(storage)) as never);

  const storageSet = vi.fn((key: keyof FakeStorage, value: unknown) => {
    (storage as unknown as Record<string, unknown>)[key] = value;
  });
  const storageGet = vi.fn((key: keyof FakeStorage) => storage[key]);

  vi.mocked(useMutation).mockImplementation(((callback: never) => {
    const spy = vi.fn((...args: unknown[]) =>
      (callback as (...a: unknown[]) => unknown)(
        {
          storage: { set: storageSet, get: storageGet },
          self: options.self,
          others,
        },
        ...args,
      ),
    );
    return spy as never;
  }) as never);

  const broadcast = vi.fn();
  vi.mocked(useBroadcastEvent).mockReturnValue(broadcast);
  vi.mocked(useEventListener).mockImplementation(() => undefined);

  return { storage, storageSet, broadcast };
}

describe("useMapsSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapSessionStore.getState().clearActiveSession();
  });

  it("reports active: false when no session is active", () => {
    setUpMocks({ self: null });
    const { result } = renderHook(() => useMapsSession());
    expect(result.current.active).toBe(false);
  });

  it("reports isController true when self is the current controller", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "host", displayName: "Alice" });
    setUpMocks({
      self: makeUser("host-1", "Alice", "#ef4444", true),
      storage: { controllerId: "host-1" },
    });

    const { result } = renderHook(() => useMapsSession());
    expect(result.current.isController).toBe(true);
    expect(result.current.isHost).toBe(true);
  });

  it("reports isController false when someone else is controlling", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "guest", displayName: "Bob" });
    setUpMocks({
      self: makeUser("guest-1", "Bob", "#3b82f6", false),
      storage: { controllerId: "host-1" },
    });

    const { result } = renderHook(() => useMapsSession());
    expect(result.current.isController).toBe(false);
  });

  it("requestControl broadcasts a request when the host is present", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "guest", displayName: "Bob" });
    const { broadcast } = setUpMocks({
      self: makeUser("guest-1", "Bob", "#3b82f6", false),
      others: [makeUser("host-1", "Alice", "#ef4444", true)],
      storage: { hostId: "host-1", controllerId: "host-1" },
    });

    const { result } = renderHook(() => useMapsSession());
    result.current.requestControl();
    expect(broadcast).toHaveBeenCalledExactlyOnceWith({ type: "request-control" });
  });

  it("requestControl claims instantly when the host isn't present", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "guest", displayName: "Bob" });
    const { storage, broadcast } = setUpMocks({
      self: makeUser("guest-1", "Bob", "#3b82f6", false),
      others: [],
      storage: { hostId: "host-1", controllerId: "host-1" },
    });

    const { result } = renderHook(() => useMapsSession());
    result.current.requestControl();
    expect(broadcast).not.toHaveBeenCalled();
    expect(storage.controllerId).toBe("guest-1");
  });

  it("releaseControl hands control back to the host", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "guest", displayName: "Bob" });
    const { storage } = setUpMocks({
      self: makeUser("guest-1", "Bob", "#3b82f6", false),
      storage: { hostId: "host-1", controllerId: "guest-1" },
    });

    const { result } = renderHook(() => useMapsSession());
    result.current.releaseControl();
    expect(storage.controllerId).toBe("host-1");
  });

  it("setView reclaims control automatically when the host navigates", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "host", displayName: "Alice" });
    const { storage } = setUpMocks({
      self: makeUser("host-1", "Alice", "#ef4444", true),
      storage: { hostId: "host-1", controllerId: "guest-1" },
    });

    const { result } = renderHook(() => useMapsSession());
    result.current.setView({
      mapNormalizedName: "customs",
      variantId: "2d",
      center: { lat: 0, lng: 0 },
      zoom: 1,
    });
    expect(storage.controllerId).toBe("host-1");
  });
});
