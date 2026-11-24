/**
 * How long the object URL outlives the click. iOS Safari (and some older
 * browsers) start reading it after `click()` returns, so freeing it at once
 * can save an empty file. FileSaver.js waits the same 40 s.
 */
const REVOKE_DELAY_MS = 40_000;

/**
 * Saves `blob` as a file named `filename`, through a temporary
 * `<a download>` that's clicked and removed straight away.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
