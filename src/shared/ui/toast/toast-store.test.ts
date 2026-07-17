import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast, useToastStore } from "./toast-store";

describe("toast store", () => {
  beforeEach(() => {
    useToastStore.setState({ toast: null });
  });

  it("defaults a plain toast to a 2500ms duration", () => {
    toast({ message: "Saved" });
    const active = useToastStore.getState().toast;
    expect(active).toMatchObject({ message: "Saved", durationMs: 2500 });
    expect(active?.action).toBeUndefined();
  });

  it("defaults an action toast to a 6000ms duration", () => {
    const onClick = vi.fn();
    toast({ message: "Task removed", action: { label: "UNDO", onClick } });
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Task removed",
      durationMs: 6000,
      action: { label: "UNDO" },
    });
  });

  it("respects an explicit durationMs override", () => {
    toast({ message: "Custom", durationMs: 1000 });
    expect(useToastStore.getState().toast?.durationMs).toBe(1000);
  });

  it("replaces the current toast rather than stacking", () => {
    toast({ message: "First" });
    const firstId = useToastStore.getState().toast?.id;

    toast({ message: "Second" });
    const state = useToastStore.getState();

    expect(state.toast?.message).toBe("Second");
    expect(state.toast?.id).not.toBe(firstId);
  });

  it("dismiss clears the active toast", () => {
    toast({ message: "Saved" });
    useToastStore.getState().dismiss();
    expect(useToastStore.getState().toast).toBeNull();
  });
});
