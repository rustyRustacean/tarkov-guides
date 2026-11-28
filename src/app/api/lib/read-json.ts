/**
 * Reads a request body as text, stopping as soon as it passes `maxBytes`,
 * so an oversized body (chunked, or with a missing or false
 * `content-length`) is never buffered whole. `null` when it's too large.
 */
async function readCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Reads a JSON object body for an API route, refusing anything larger than
 * `maxBytes` (by the declared length, and by the bytes actually read).
 * `"too-large"` for a 413; `null` for a missing, malformed or non-object
 * body (a 400).
 */
export async function readJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown> | "too-large" | null> {
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes) return "too-large";
  try {
    const text = await readCapped(request, maxBytes);
    if (text === null) return "too-large";
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
