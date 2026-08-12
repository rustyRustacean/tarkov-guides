import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useToastStore } from "@/shared/ui/toast/toast-store";

import { useProgressTrackerStore } from "../store";

import { useRaidCommit } from "./use-raid-commit";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useToastStore.setState({ toast: null });
});

describe("useRaidCommit", () => {
  it("extract merges all pending into have and clears pending", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 2);
    useProgressTrackerStore.getState().setPending("item-a", 3);
    useProgressTrackerStore.getState().setPending("item-b", 1);

    const { result } = renderHook(() => useRaidCommit());
    act(() => {
      result.current.extract();
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.have).toEqual({ "item-a": 5, "item-b": 1 });
    expect(progress?.pending).toEqual({});
  });

  it("die discards pending unconditionally and leaves have untouched", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 2);
    useProgressTrackerStore.getState().setPending("item-a", 3);

    const { result } = renderHook(() => useRaidCommit());
    act(() => {
      result.current.die();
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.have).toEqual({ "item-a": 2 });
    expect(progress?.pending).toEqual({});
  });

  it("extract shows a toast with a working UNDO that restores prior have/pending", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 2);
    useProgressTrackerStore.getState().setPending("item-a", 3);

    const { result } = renderHook(() => useRaidCommit());
    act(() => {
      result.current.extract();
    });

    const activeToast = useToastStore.getState().toast;
    expect(activeToast?.message).toContain("Extracted");
    expect(activeToast?.action?.label).toBe("UNDO");

    act(() => {
      activeToast?.action?.onClick();
    });

    const profileId = useProgressTrackerStore.getState().activeProfileId;
    const progress = profileId
      ? useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]
      : undefined;
    expect(progress?.have).toEqual({ "item-a": 2 });
    expect(progress?.pending).toEqual({ "item-a": 3 });
  });

  it("die shows a toast with a working UNDO that restores prior have/pending", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 2);
    useProgressTrackerStore.getState().setPending("item-a", 3);

    const { result } = renderHook(() => useRaidCommit());
    act(() => {
      result.current.die();
    });

    const activeToast = useToastStore.getState().toast;
    expect(activeToast?.message).toContain("Died");
    expect(activeToast?.action?.label).toBe("UNDO");

    act(() => {
      activeToast?.action?.onClick();
    });

    const profileId = useProgressTrackerStore.getState().activeProfileId;
    const progress = profileId
      ? useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]
      : undefined;
    expect(progress?.have).toEqual({ "item-a": 2 });
    expect(progress?.pending).toEqual({ "item-a": 3 });
  });

  it("extract and die with empty pending are harmless no-ops that still toast", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useRaidCommit());
    act(() => {
      result.current.extract();
    });
    expect(useToastStore.getState().toast?.message).toBe("Extracted");

    act(() => {
      result.current.die();
    });
    expect(useToastStore.getState().toast?.message).toBe("Died");
  });

  it("is a no-op when there is no active profile", () => {
    const { result } = renderHook(() => useRaidCommit());

    act(() => {
      result.current.extract();
    });
    act(() => {
      result.current.die();
    });

    expect(useProgressTrackerStore.getState().progressByProfile).toEqual({});
    expect(useToastStore.getState().toast).toBeNull();
  });
});
