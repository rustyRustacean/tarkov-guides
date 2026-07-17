import { expect, test } from "@playwright/test";

import { createProfile, mockTarkovApi, switchToProfile } from "./helpers/progress-tracker";

test.describe("Progress Tracker profile isolation", () => {
  test("a stale undo toast from profile A never touches A's history once B is active", async ({
    page,
  }) => {
    // Regression coverage for a confirmed legacy bug class: every
    // `useUndoableState` consumer's stack must reset when the active
    // profile changes, so a still-visible toast's UNDO button - created
    // while profile A was active - becomes a harmless no-op once the user
    // has switched to profile B, rather than corrupting A's progress from
    // underneath it (Phase 4 deviation from the original migration plan).
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await mockTarkovApi(page);
    await page.goto("/progress-tracker");

    // Build undo history on Profile A: start task-alpha, leaving its
    // "Started" toast (with a live UNDO action) on screen.
    await createProfile(page, "ProfileA");
    const questAOnA = page.getByRole("listitem").filter({ hasText: "Secure the Alpha Widget" });
    await questAOnA.getByRole("button", { name: "Start" }).click();
    await expect(questAOnA.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Started Secure the Alpha Widget").first()).toBeVisible();

    // Switch to Profile B WITHOUT dismissing or interacting with that
    // toast - it's still showing (6s duration for action toasts).
    await createProfile(page, "ProfileB");
    await expect(page.getByRole("button", { name: "ProfileB", exact: true })).toBeVisible();

    // Confirm B starts with a clean slate - task-alpha is untouched here.
    const questAOnB = page.getByRole("listitem").filter({ hasText: "Secure the Alpha Widget" });
    await expect(questAOnB.getByRole("button", { name: "Start" })).toBeEnabled();

    // Click the STALE toast's UNDO - its `onClick` closure was bound to
    // Profile A's undo stack, which must already be cleared by the
    // `activeProfileId` change above.
    await page.getByRole("button", { name: "UNDO", exact: true }).click();

    // B must be unaffected: task-alpha is still just "Available" on B, not
    // reverted to some other state by A's stale undo.
    await expect(questAOnB.getByRole("button", { name: "Start" })).toBeEnabled();

    // Switch back to A and confirm ITS task-alpha is still "In Progress" -
    // the stale undo must not have reverted it back to "notstarted".
    await switchToProfile(page, "ProfileA");
    const questAOnAAgain = page
      .getByRole("listitem")
      .filter({ hasText: "Secure the Alpha Widget" });
    await expect(questAOnAAgain.getByText("In Progress")).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
