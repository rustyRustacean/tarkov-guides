"use client";

import { deserializeSnapshot } from "./serialize";

import type { PersistenceAdapter, ProgressTrackerSnapshot } from "./types";

/** `tarkovguides-progress-YYYY-MM-DD.json` - date-only, matching legacy's own export filename convention. */
function downloadFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `tarkovguides-progress-${date}.json`;
}

/**
 * Parses and validates one `File`'s contents as a {@link ProgressTrackerSnapshot}.
 * Split out from {@link manualJsonAdapter}'s `read()` specifically so it's
 * unit-testable without simulating a real OS file-picker dialog (jsdom has
 * no such thing) - `read()` itself is a thin DOM-wiring wrapper around this.
 */
export function readJsonFile(file: File): Promise<ProgressTrackerSnapshot | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      // `readAsText` below always yields a string result - the `ArrayBuffer`
      // half of FileReader's declared `result` type is only reachable via
      // `readAsArrayBuffer`, which this function never calls. Checked
      // explicitly (rather than `String(reader.result)`) since blindly
      // stringifying a hypothetical `ArrayBuffer` would silently parse
      // `"[object ArrayBuffer]"` as JSON instead of failing loudly.
      if (typeof reader.result !== "string") {
        resolve(null);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(reader.result);
        resolve(deserializeSnapshot(parsed));
      } catch {
        resolve(null);
      }
    });
    reader.addEventListener("error", () => {
      resolve(null);
    });
    reader.readAsText(file);
  });
}

/**
 * Tier 3 of the three-tier backup architecture - the universal fallback
 * that works in any browser (including ones without File System Access API
 * support). `write()` triggers a synthetic download via a temporary
 * `<a download>`; `read()` triggers a native `<input type="file">` picker
 * and resolves once the user selects a file (or cancels, resolving `null`).
 */
export const manualJsonAdapter: PersistenceAdapter = {
  id: "manual-json",

  isAvailable() {
    return typeof document !== "undefined";
  },

  write(snapshot) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return Promise.resolve();
  },

  read() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        readJsonFile(file)
          .then(resolve)
          .catch(() => {
            resolve(null);
          });
      });
      input.click();
    });
  },
};
