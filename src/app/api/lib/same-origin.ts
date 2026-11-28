/**
 * True when a request can only have come from this site's own pages. For
 * routes that write without any key (reporting a preset), where another
 * site could otherwise make its visitors' browsers send the write from
 * many real IPs.
 *
 * Two checks, either of which stops a cross-site request:
 * - `Sec-Fetch-Site` (sent by every current browser) must be absent or
 *   `same-origin`; `same-site` is refused too, since it includes other
 *   subdomains.
 * - The body must be declared as JSON. A cross-site page can only send
 *   `text/plain`, form or multipart bodies without a CORS preflight, and the
 *   preflight fails because no route allows other origins. This covers
 *   browsers too old to send `Sec-Fetch-Site`.
 */
export function isSameOriginJsonRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;
  const type = request.headers.get("content-type") ?? "";
  return type.split(";")[0]?.trim().toLowerCase() === "application/json";
}
