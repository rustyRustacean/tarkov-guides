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
 * Opens the Progress Tracker's profile switcher and creates a new profile
 * through `ProfileManagerDialog` - `createProfile` makes the new profile
 * active immediately (see `store.ts`), so no separate switch step is needed
 * right after creating one. `ProfileManagerDialog`'s own submit handler
 * already closes itself on successful creation, so no extra close step is
 * needed here - a trailing `Escape` press used to sit here for that purpose,
 * but once the dialog is already closed it lands on whatever `DismissableLayer`
 * is now topmost instead (e.g. an already-showing action toast), dismissing
 * it - a real bug this helper doesn't need to reintroduce for the sake of a
 * no-op close.
 */
export async function createProfile(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /Profile/ }).click();
  await page.getByRole("menuitem", { name: "Manage Profiles" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create Profile" }).click();
}

/** Switches the active profile via the header's profile-switcher dropdown, by profile name. */
export async function switchToProfile(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /Profile/ }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(name) }).click();
}
