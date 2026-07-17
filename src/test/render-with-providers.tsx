import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import type { RenderOptions, RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/** A fresh, retry-disabled `QueryClient` scoped to one render - avoids cross-test cache pollution and slow real retries. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Renders with a fresh `QueryClientProvider` ancestor - needed by any
 * component (directly or transitively) calling `useTarkovGameData()`.
 * Mirrors the wrapper pattern already used in
 * `src/shared/lib/tarkov-api/use-tarkov-game-data.test.tsx`, centralized
 * here since most Progress Tracker feature components need the same setup.
 * Pair with `vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", ...)` in
 * the consuming test file so no real network call happens.
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
