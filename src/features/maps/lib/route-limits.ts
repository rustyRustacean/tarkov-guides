/**
 * Every limit on the server-side route endpoint, in one place so they can be
 * tuned without reading the router code.
 */

/** Largest obstacle grid ever built, in cells (2 m each). The biggest real map is about 0.6M. */
export const MAX_GRID_CELLS = 2_000_000;

/** Largest coordinate, in meters, the endpoint accepts for any point. */
export const MAX_COORDINATE_M = 5000;

/** Most targets one request may ask for. */
export const MAX_TARGETS = 40;

/** How far outside a map's known extent (obstacles, exits, minefields) a point may sit and still count as on the map. */
export const MAP_EDGE_MARGIN_M = 100;

/** How long fetched exit and minefield data is reused before it is fetched again. */
export const MAP_DATA_TTL_MS = 6 * 60 * 60 * 1000;

/** Longest wait for tarkov.dev or the private mesh store before giving up. */
export const FETCH_TIMEOUT_MS = 10_000;

/** After a failed load, how long to wait before trying again (a failure is not retried on every request). */
export const FAILURE_MEMORY_MS = 60_000;

/** Most route requests one client may make per minute (per server instance). */
export const MAX_REQUESTS_PER_MINUTE = 120;
