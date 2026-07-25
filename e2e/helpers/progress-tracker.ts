import { TARKOV_DATA_PROXY_PATH } from "@/shared/lib/tarkov-api/fetch-tarkov-data";

import { MOCK_TARKOV_DATA } from "../fixtures/mock-tarkov-data";

import type { Page } from "@playwright/test";

/**
 * Intercepts the app's one live network dependency (the same-origin
 * `/api/tarkov-data` proxy - the browser hasn't called tarkov.dev's GraphQL
 * endpoint directly since the 2026-07-16 caching-proxy change) and fulfills
 * it with `MOCK_TARKOV_DATA` instead - must be called before `page.goto()`
 * so the very first request is caught. Keeps these Progress Tracker e2e
 * specs deterministic and independent of tarkov.dev's real, ever-changing
 * data (unlike this project's manual verification passes during
 * development, which deliberately hit the real live API). The fulfilled
 * body is the unwrapped `RawTarkovApiResponseData` itself (no GraphQL
 * `{ data: ... }` envelope) - that's the proxy route's own response shape,
 * not tarkov.dev's raw one.
 */
export async function mockTarkovApi(page: Page): Promise<void> {
  await page.route(`**${TARKOV_DATA_PROXY_PATH}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(MOCK_TARKOV_DATA),
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
