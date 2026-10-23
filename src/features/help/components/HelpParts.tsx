import Image from "next/image";

import type { CSSProperties, ReactNode } from "react";

/** Whether a feature needs the companion running (orange), works without it (green), or both. */
export type CompanionDot = "orange" | "green";

/** Filter groups the page can show. */
export type HelpTag = "new" | "keys" | "setup";

const DOT_LABELS: Record<CompanionDot, string> = {
  orange: "Needs the companion running",
  green: "Works without the companion",
};

/** The dots in a card's top right corner. */
export function Dots({ kinds }: { kinds: readonly CompanionDot[] }) {
  return (
    <span
      className="dots"
      role="img"
      aria-label={kinds.map((kind) => DOT_LABELS[kind]).join(" and ")}
    >
      {kinds.map((kind) => (
        <i key={kind} className={`dot ${kind}`} title={DOT_LABELS[kind]} />
      ))}
    </span>
  );
}

interface HelpCardProps {
  name: string;
  tags: readonly HelpTag[];
  dots: readonly CompanionDot[];
  /** Step number for the exit flow cards. */
  step?: number;
  /** Shows the NEW badge. */
  isNew?: boolean;
  /** The picture area. */
  art: ReactNode;
  /** Gives the picture area the picture's own height instead of a fixed one. */
  tall?: boolean;
  /** Whether the current filter hides this card. */
  hidden?: boolean;
  /** The one-line tip at the bottom. */
  tip?: ReactNode;
  children: ReactNode;
}

/** One feature card: its name loud on top, then a picture, the steps, and a quiet tip. */
export function HelpCard({
  name,
  tags,
  dots,
  step,
  isNew = false,
  art,
  tall = false,
  hidden = false,
  tip,
  children,
}: HelpCardProps) {
  return (
    <div className={hidden ? "tile hide" : "tile"} data-tags={tags.join(" ")}>
      <Dots kinds={dots} />
      <div className="head">
        {step === undefined ? null : <span className="n">{step}</span>}
        <h3>{name}</h3>
        {isNew ? <span className="new">New</span> : null}
      </div>
      <div className={tall ? "art tall" : "art"}>{art}</div>
      <div className="body">
        {children}
        {tip === undefined ? null : <div className="tip">{tip}</div>}
      </div>
    </div>
  );
}

interface ShotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** `"bg"` makes the picture the background of a drawn map piece. */
  className?: string;
}

/** A screenshot from `public/help`. Plain static files, so no image optimizer is involved. */
export function Shot({ src, alt, width, height, className }: ShotProps) {
  return (
    <Image src={src} alt={alt} width={width} height={height} className={className} unoptimized />
  );
}

/** The pennant and stem as ONE outline: straight top edge, rounded stem end. */
const FLAG_SHAPE = "M3.2 2.6 L23 9 L6.8 15.2 L6.8 27.8 A1.8 1.8 0 0 1 3.2 27.8 Z";

/** Flag kinds, as drawn on the map: green extract, mustard unknown, orange transit. */
export type FlagKind = "extract" | "unknown" | "transit";

interface PlacedProps {
  left: string;
  top: string;
}

/** An exit flag. Layers, outside in: bold border in its color, thin black line, dimmer fill. */
export function Flag({ kind, left, top }: PlacedProps & { kind: FlagKind }) {
  const style: CSSProperties = { left, top };
  return (
    <svg
      className={kind === "extract" ? "xflag" : `xflag xflag--${kind}`}
      viewBox="0 0 26 32"
      style={style}
      aria-hidden="true"
    >
      <path className="ring" d={FLAG_SHAPE} />
      <path className="inside" d={FLAG_SHAPE} />
      <path className="line" d={FLAG_SHAPE} />
    </svg>
  );
}

/** The name pill beside a flag. */
export function FlagLabel({
  kind,
  left,
  top,
  children,
}: PlacedProps & { kind: FlagKind; children: ReactNode }) {
  const style: CSSProperties = { left, top };
  return (
    <span className={kind === "extract" ? "xlabel" : `xlabel xlabel--${kind}`} style={style}>
      {children}
    </span>
  );
}

/** A toast like the site's, with its action. */
export function MiniToast({ message, action }: { message: string; action: string }) {
  return (
    <div className="xtoast">
      <span>{message}</span>
      <b>{action}</b>
    </div>
  );
}

/** The player's marker: the site's chevron, rotated to face a direction. */
export function PlayerMarker({ left, top, degrees }: PlacedProps & { degrees: number }) {
  const style: CSSProperties = { left, top };
  return (
    <svg className="xplayer" viewBox="0 0 60 60" style={style} aria-hidden="true">
      <g style={{ transform: `rotate(${String(degrees)}deg)`, transformOrigin: "30px 30px" }}>
        <path d="M 30 12 L 42 40 L 30 33 L 18 40 Z" />
      </g>
    </svg>
  );
}

/** The marker's name tag. */
export function PlayerName({ left, top, children }: PlacedProps & { children: ReactNode }) {
  const style: CSSProperties = { left, top };
  return (
    <span className="xname" style={style}>
      {children}
    </span>
  );
}
