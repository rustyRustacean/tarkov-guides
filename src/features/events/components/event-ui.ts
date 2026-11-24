/** Shared input styling for the events forms, matching the Flea Fee Calculator's fields. */
export const INPUT_CLASS =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60";

/** Small uppercase label above a field or a group of controls. */
export const LABEL_CLASS = "text-muted-foreground text-xs font-semibold tracking-wide uppercase";

const POINTS_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Points as the scoreboard shows them: grouped thousands, up to 2 decimals. */
export function formatPoints(points: number): string {
  return POINTS_FORMAT.format(points);
}

/** "just now", "12s ago", "4m ago", "3h ago", or a date for anything older. */
export function formatAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${String(seconds)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  return new Date(at).toLocaleDateString();
}
