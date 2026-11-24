/**
 * Packs a JSON value into a short URL-safe string and back, for kit and
 * preset links. Nothing is stored server side: the link is the data. The
 * value is deflated (the browser's built-in `CompressionStream`, no
 * library) and base64url-encoded, behind a version prefix so the format can
 * change later without breaking old links. Links live in the URL fragment,
 * which never reaches the server.
 */

const PREFIX = "1.";

/** The longest packed string accepted, so a pasted giant link can't stall the page. */
export const MAX_PACKED_LENGTH = 16_000;

/** Inflated size cap, against a tiny link that decompresses into something huge. */
const MAX_UNPACKED_BYTES = 256_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  limit: number,
) {
  // A stream built from the bytes directly rather than `Blob.stream()`, which jsdom lacks.
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  // The DOM typings declare these streams' writable side as `BufferSource`,
  // which TypeScript won't match to a `Uint8Array` stream; at runtime they
  // take exactly these bytes.
  const transform = stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
  const reader = source.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Packs a JSON-serializable value into a link-safe string. */
export async function packForLink(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const deflated = await pipe(json, new CompressionStream("deflate-raw"), Number.MAX_SAFE_INTEGER);
  return PREFIX + toBase64Url(deflated);
}

/** Unpacks a string from {@link packForLink}, or `null` for anything that isn't one. Validate the result before using it. */
export async function unpackFromLink(text: string): Promise<unknown> {
  if (!text.startsWith(PREFIX) || text.length > MAX_PACKED_LENGTH) return null;
  try {
    const bytes = await pipe(
      fromBase64Url(text.slice(PREFIX.length)),
      new DecompressionStream("deflate-raw"),
      MAX_UNPACKED_BYTES,
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

/** Reads `key=value` pairs from a URL fragment like `#p=...&k=...`. */
export function hashParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}
