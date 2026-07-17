import { TARKOV_API_ENDPOINT } from "@/shared/lib/tarkov-api/constants";

import { MOCK_TARKOV_DATA } from "../fixtures/mock-tarkov-data";

import type { Page } from "@playwright/test";

/**
 * Intercepts the app's one live network dependency (the tarkov.dev GraphQL
 * endpoint) and fulfills it with `MOCK_TARKOV_DATA` instead - must be
 * called before `page.goto()` so the very first request is caught. Keeps
 * these Progress Tracker e2e specs deterministic and independent of
 * tarkov.dev's real, ever-changing data (unlike this project's manual
 * verification passes during development, which deliberately hit the real
 * live API).
 */
export async function mockTarkovApi(page: Page): Promise<void> {
  await page.route(TARKOV_API_ENDPOINT, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_TARKOV_DATA }),
    });
  });
}

/**
 * Opens the Progress Tracker's profile switcher, creates a new profile
 * through `ProfileManagerDialog`, and closes the dialog - `createProfile`
 * makes the new profile active immediately (see `store.ts`), so no separate
 * switch step is needed right after creating one.
 */
export async function createProfile(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /Profile/ }).click();
  await page.getByRole("menuitem", { name: "Manage Profiles" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create Profile" }).click();
  await page.keyboard.press("Escape");
}

/** Switches the active profile via the header's profile-switcher dropdown, by profile name. */
export async function switchToProfile(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /Profile/ }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(name) }).click();
}
