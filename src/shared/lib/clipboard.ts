/**
 * Copies `text` to the clipboard. Tries the modern async Clipboard API first,
 * falling back to a hidden-textarea `document.execCommand("copy")` for
 * contexts where `navigator.clipboard` is unavailable (non-HTTPS, older
 * browsers). Never throws: returns `false` on total failure so callers can
 * toast an error instead of assuming success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // `Navigator.clipboard` is typed as always-present in DOM lib types, but
  // it's genuinely absent at runtime in some real browsers/contexts (non-
  // HTTPS origins, older engines): this check is load-bearing despite what
  // the type checker can see.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Falls through to the legacy path below.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    // Deprecated but still the only fallback for non-HTTPS/older-browser
    // contexts where the async Clipboard API above isn't available.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
