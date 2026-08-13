import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only`'s own package.json resolves to a throwing stub unless
    // the bundler applies Next.js's special "react-server" export
    // condition - Next's own build does this, but Vitest's plain Node
    // resolution doesn't know about that condition, so any file importing
    // `server-only` (a defensive marker - see `src/features/pvp-guide/lib/
    // tutorial-content.ts`, the first real consumer) would throw on import
    // under a plain test run. Alias straight to the package's own no-op
    // build (what the "react-server" condition would have resolved to
    // anyway) rather than disabling the check - keeps it load-bearing for
    // real `next build`/`next dev`, inert only here.
    alias: {
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // "e2e" holds Playwright specs (different test runner/API - see
    // playwright.config.ts) and must not be picked up by Vitest's glob.
    exclude: ["node_modules", ".next", "old", "e2e", "docs-site"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/**", ".next/**", "old/**", "docs-site/**", "**/*.config.*"],
    },
  },
});
