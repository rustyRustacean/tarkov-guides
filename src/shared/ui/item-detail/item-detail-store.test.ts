import { beforeEach, describe, expect, it } from "vitest";

import { openItemDetail, useItemDetailStore } from "./item-detail-store";

describe("useItemDetailStore", () => {
  beforeEach(() => {
    useItemDetailStore.setState({ current: null, stack: [] });
  });

  it("opens an item as the current target", () => {
    useItemDetailStore.getState().openItem("ledx");
    expect(useItemDetailStore.getState().current).toEqual({ type: "item", id: "ledx" });
    expect(useItemDetailStore.getState().stack).toEqual([]);
  });

  it("pushes the current target onto the stack when drilling", () => {
    const store = useItemDetailStore.getState();
    store.openItem("ledx");
    useItemDetailStore.getState().openTask("task-1");
    expect(useItemDetailStore.getState().current).toEqual({ type: "task", id: "task-1" });
    expect(useItemDetailStore.getState().stack).toEqual([{ type: "item", id: "ledx" }]);
  });

  it("walks back through the drilldown in reverse", () => {
    useItemDetailStore.getState().openItem("ledx");
    useItemDetailStore.getState().openTask("task-1");
    useItemDetailStore.getState().openItem("gpu");
    useItemDetailStore.getState().back();
    expect(useItemDetailStore.getState().current).toEqual({ type: "task", id: "task-1" });
    useItemDetailStore.getState().back();
    expect(useItemDetailStore.getState().current).toEqual({ type: "item", id: "ledx" });
  });

  it("closes everything when back is called with an empty stack", () => {
    useItemDetailStore.getState().openItem("ledx");
    useItemDetailStore.getState().back();
    expect(useItemDetailStore.getState().current).toBeNull();
    expect(useItemDetailStore.getState().stack).toEqual([]);
  });

  it("close clears the current target and the whole stack", () => {
    useItemDetailStore.getState().openItem("ledx");
    useItemDetailStore.getState().openTask("task-1");
    useItemDetailStore.getState().close();
    expect(useItemDetailStore.getState().current).toBeNull();
    expect(useItemDetailStore.getState().stack).toEqual([]);
  });

  it("openItemDetail helper opens from outside a component", () => {
    openItemDetail("bitcoin");
    expect(useItemDetailStore.getState().current).toEqual({ type: "item", id: "bitcoin" });
  });
});
