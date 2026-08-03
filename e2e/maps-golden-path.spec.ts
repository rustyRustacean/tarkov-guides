import { expect, test } from "@playwright/test";

import { createProfile, mockTarkovApi } from "./helpers/progress-tracker";

import type { MapsSnapshot } from "@/features/maps/persistence/types";

test.describe("Maps golden path", () => {
  test("switch maps, start+hide a task, draw an annotation, reload, and confirm it all persisted", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await mockTarkovApi(page);

    // No profile yet - drawing has nowhere to be saved, so it's disabled.
    await page.goto("/maps");
    await expect(page.getByRole("button", { name: "Draw", exact: true })).toBeDisabled();

    // Annotations/task-display-overrides are per-profile - create one via
    // Progress Tracker (Maps has no profile switcher of its own).
    await page.goto("/progress-tracker");
    await createProfile(page, "MapsProfile");

    await page.goto("/maps");
    await expect(page.getByRole("tab", { name: "Reserve", exact: true })).toHaveAttribute(
      "data-state",
      "active",
    );

    // Switch maps via the picker.
    await page.getByRole("tab", { name: "Woods", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Woods", exact: true })).toHaveAttribute(
      "data-state",
      "active",
    );

    await expect(page.getByRole("button", { name: "Draw", exact: true })).toBeEnabled();

    // Start a task (the sidebar has no auto-switching - MapSidebar's own doc
    // comment: "the query targets the visible pane" - so switch to the
    // Missions pane by hand) and toggle its "display on map" override off.
    await page.getByRole("tab", { name: "Missions", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("Alpha Widget");
    await expect(page.getByRole("tab", { name: "Missions", exact: true })).toHaveAttribute(
      "data-state",
      "active",
    );

    const taskRow = page.getByRole("listitem").filter({ hasText: "Secure the Alpha Widget" });
    await expect(taskRow).toBeVisible();
    await taskRow.getByRole("button", { name: "Start" }).click();
    await expect(taskRow.getByRole("checkbox")).toBeChecked();
    await taskRow.getByRole("checkbox").click();
    await expect(taskRow.getByRole("checkbox")).not.toBeChecked();

    // Draw one annotation stroke, clear of the toolbar's own top-left panel.
    await page.getByRole("button", { name: "Draw", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing", exact: true })).toBeVisible();

    const mapCanvas = page.locator(".leaflet-container");
    await expect(mapCanvas).toBeVisible();
    const box = await mapCanvas.boundingBox();
    if (!box) throw new Error("Map canvas has no bounding box");

    const startX = box.x + box.width * 0.6;
    const startY = box.y + box.height * 0.55;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 30);
    await page.mouse.move(startX + 120, startY + 60);
    await page.mouse.up();

    // Reload and confirm every piece of state above survived - both via a
    // direct localStorage read and via the UI itself.
    await page.reload();

    const raw = await page.evaluate(() => localStorage.getItem("tarkovguides.maps.v1"));
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw ?? "{}") as MapsSnapshot;

    expect(snapshot.currentMap).toBe("woods");
    const profileIds = Object.keys(snapshot.profileState);
    expect(profileIds).toHaveLength(1);
    const profileState = snapshot.profileState[profileIds[0] ?? ""];
    expect(profileState?.taskDisplayOverrides["task-alpha"]).toBe(false);

    const woodsLayers = Object.values(profileState?.annotations.woods ?? {});
    expect(woodsLayers.length).toBeGreaterThan(0);
    const strokes = woodsLayers[0]?.strokes ?? [];
    expect(strokes.length).toBeGreaterThanOrEqual(1);
    const firstStroke = strokes[0];
    expect(firstStroke?.type).toBe("pen");
    expect(firstStroke?.type === "pen" ? firstStroke.points.length : 0).toBeGreaterThanOrEqual(2);

    await expect(page.getByRole("tab", { name: "Woods", exact: true })).toHaveAttribute(
      "data-state",
      "active",
    );
    // The sidebar pane isn't part of the persisted snapshot, so it resets to
    // its default on reload - switch back to Missions before searching.
    await page.getByRole("tab", { name: "Missions", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("Alpha Widget");
    const taskRowAfterReload = page
      .getByRole("listitem")
      .filter({ hasText: "Secure the Alpha Widget" });
    await expect(taskRowAfterReload.getByRole("checkbox")).not.toBeChecked();

    // All 38 map image files are bundled under `public/maps/{svg,jpg}/` (see
    // `public/maps/SOURCES.md`), so a real image-load 404 here would now be
    // a genuine bug. Still filtered rather than asserted as a blanket empty
    // array, defensively, in case a live `assets.tarkov.dev` tile request
    // (Reserve's default "Interactable" variant isn't mocked) hiccups in a
    // real browser - this spec should still catch any OTHER, genuinely
    // unexpected console error.
    const unexpectedErrors = consoleErrors.filter(
      (message) => !message.includes("Failed to load resource"),
    );
    expect(unexpectedErrors).toEqual([]);
  });

  test("header nav and homepage card both link to the real route", async ({ page }) => {
    // /maps calls useTarkovGameData() (via MapSidebar) - mock for
    // determinism, unlike PvP Guide's equivalent test, which has no live
    // data dependency at all.
    await mockTarkovApi(page);

    await page.goto("/");
    await page.getByRole("link", { name: "Open Maps →" }).click();
    await expect(page).toHaveURL(/\/maps$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Maps", exact: true }).click();
    await expect(page).toHaveURL(/\/maps$/);
  });
});
