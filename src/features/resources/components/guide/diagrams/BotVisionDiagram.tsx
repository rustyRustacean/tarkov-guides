import { annularSector, DiagramFigure, svgPath } from "./DiagramFigure";

const CX = 80;
const CY = 220;
const HALF_FOV = 22;

const BANDS = [
  {
    inner: 0,
    outer: 240,
    fill: "fill-status-teal/25",
    range: "Under 90 m",
    parts: "every body part",
    x: 208,
  },
  {
    inner: 240,
    outer: 390,
    fill: "fill-status-amber/25",
    range: "90 to 160 m",
    parts: "head, body, arms",
    x: 395,
  },
  {
    inner: 390,
    outer: 520,
    fill: "fill-status-red/20",
    range: "Over 160 m",
    parts: "head and body",
    x: 535,
  },
] as const;

/** Top-down sketch of a bot's vision checks: what it looks for at range, plus the 5 m and 20 m rings. Not to scale. */
export function BotVisionDiagram() {
  return (
    <DiagramFigure
      viewBox="0 10 620 420"
      label="Top-down diagram of a bot's field of view, split into three range bands, with small rings at 5 and 20 meters around the bot"
      caption={
        <>
          What a bot checks for at each range (not to scale; Scavs only check your head inside 90
          m). Inside the inner ring (5 m), every bot sees straight through foliage. Inside the
          dashed ring (20 m), bosses see in every direction, and cultists, Tagilla and Killa see all
          the way around at any range.
        </>
      }
    >
      {BANDS.map((band) => (
        <path
          key={band.range}
          d={annularSector(CX, CY, band.inner, band.outer, -HALF_FOV, HALF_FOV)}
          className={`${band.fill} stroke-border`}
          strokeWidth={1}
        />
      ))}
      {BANDS.map((band) => (
        <g key={band.range} className="fill-foreground" textAnchor="middle">
          <text x={band.x} y={CY - 8} fontSize={20} fontWeight={600}>
            {band.range}
          </text>
          <text x={band.x} y={CY + 18} fontSize={17} className="fill-muted-foreground">
            {band.parts}
          </text>
        </g>
      ))}

      <circle
        cx={CX}
        cy={CY}
        r={64}
        className="stroke-status-violet fill-none"
        strokeWidth={2}
        strokeDasharray="6 5"
      />
      <circle
        cx={CX}
        cy={CY}
        r={26}
        className="stroke-status-teal fill-status-teal/15"
        strokeWidth={2}
      />
      <text x={CX} y={CY - 72} fontSize={17} textAnchor="middle" className="fill-status-violet">
        20 m
      </text>
      <text x={CX} y={CY + 48} fontSize={17} textAnchor="middle" className="fill-status-teal">
        5 m
      </text>

      <circle cx={CX} cy={CY} r={9} className="fill-foreground" />
      <path
        d={svgPath("M", CX + 8, CY - 5, "L", CX + 18, CY, "L", CX + 8, CY + 5, "Z")}
        className="fill-foreground"
      />
      <text
        x={CX}
        y={CY + 100}
        fontSize={18}
        fontWeight={600}
        textAnchor="middle"
        className="fill-foreground"
      >
        Bot
      </text>
    </DiagramFigure>
  );
}
