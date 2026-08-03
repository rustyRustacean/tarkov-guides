import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves `public/companion/companion.ps1` as `text/plain` so it opens in the
 * browser instead of downloading.
 *
 * The file is already served statically from `public/`, but a `.ps1` has no
 * registered MIME type, so it goes out as `application/octet-stream` and the
 * browser saves it. That defeats the entire reason the companion stopped being
 * an .exe: someone should be able to read every line before running it, with
 * one click and no ceremony.
 *
 * Reads the same file `scripts/build-companion-zip.ps1` puts in the download,
 * rather than keeping a `.txt` mirror - a second copy would drift from the real
 * script, and a source link that shows stale code is worse than none.
 */
export async function GET(): Promise<Response> {
  const file = path.join(process.cwd(), "public", "companion", "companion.ps1");
  try {
    const source = await readFile(file, "utf8");
    return new Response(source, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // The download button serves the zip; this is for reading, and it must
        // never show a version older than the one being handed out.
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("companion.ps1 is not available on this deployment.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
