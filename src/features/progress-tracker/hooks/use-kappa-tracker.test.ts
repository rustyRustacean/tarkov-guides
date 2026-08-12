import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "@/shared/ui/toast/toast-store";

import { useProgressTrackerStore } from "../store";

import { useKappaTracker } from "./use-kappa-tracker";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useToastStore.setState({ toast: null });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useKappaTracker", () => {
  it("toggling un-got to got sets kappaGot and starts a transition hold", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useKappaTracker());
    act(() => {
      result.current.toggle("item-a", "Bolts");
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.kappaGot["item-a"],
    ).toBe(true);
    expect(result.current.justGotIds.has("item-a")).toBe(true);
  });

  it("removes the item from justGotIds once the 1.5s hold expires", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useKappaTracker());
    act(() => {
      result.current.toggle("item-a", "Bolts");
    });
    expect(result.current.justGotIds.has("item-a")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.justGotIds.has("item-a")).toBe(false);
  });

  it("toggling got back to un-got is immediate - no transition hold", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setKappaGot("item-a", true);

    const { result } = renderHook(() => useKappaTracker());
    act(() => {
      result.current.toggle("item-a", "Bolts");
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.kappaGot["item-a"],
    ).toBeUndefined();
    expect(result.current.justGotIds.has("item-a")).toBe(false);
  });

  it("un-getting an item mid-hold cancels the hold immediately", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useKappaTracker());
    act(() => {
      result.current.toggle("item-a", "Bolts");
    });
    expect(result.current.justGotIds.has("item-a")).toBe(true);

    act(() => {
      result.current.toggle("item-a", "Bolts");
    });
    expect(result.current.justGotIds.has("item-a")).toBe(false);
  });

  it("shows a toast with a working UNDO that restores wasGot and clears the hold", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useKappaTracker());
    act(() => {
      result.current.toggle("item-a", "Bolts");
    });

    const activeToast = useToastStore.getState().toast;
    expect(activeToast?.message).toBe("Got: Bolts");
    expect(activeToast?.action?.label).toBe("UNDO");

    act(() => {
      activeToast?.action?.onClick();
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.kappaGot["item-a"],
    ).toBeUndefined();
    expect(result.current.justGotIds.has("item-a")).toBe(false);
  });

  it("is a no-op when there is no active profile", () => {
    const { result } = renderHook(() => useKappaTracker());

    act(() => {
      result.current.toggle("item-a", "Bolts");
    });

    expect(useProgressTrackerStore.getState().progressByProfile).toEqual({});
    expect(useToastStore.getState().toast).toBeNull();
  });
});
