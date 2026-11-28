import { annularSector, DiagramFigure, polar } from "./DiagramFigure";

const CX = 50;
const CY = 270;
const INNER = 90;
const OUTER = 230;

const BANDS = [
  {
    from: 0,
    to: 10,
    className: "fill-status-amber/30",
    label: "tries to pen",
    mid: 5,
    r: OUTER + 12,
  },
  { from: 10, to: 47.5, className: "fill-status-teal/30", label: "can ricochet", mid: 28, r: 160 },
  { from: 47.5, to: 90, className: "fill-muted", label: "never ricochets", mid: 68, r: 160 },
] as const;

const TICKS = [0, 10, 47.5, 90] as const;

/** A quarter-circle gauge of impact angles, measured from the surface, with the ricochet window shaded. */
export function RicochetWindowDiagram() {
  return (
    <DiagramFigure
      viewBox="0 0 400 300"
      label="Gauge of impact angles from 0 to 90 degrees off the surface. Ricochets only happen between 10 and 47.5 degrees"
      caption={
        <>
          Impact angle measured off the surface (0° is a graze along the wall, 90° is head on).
          Ricochets can only happen inside the 10° to 47.5° window. Steeper than that, or flatter
          than 10°, the bullet skips the ricochet roll and goes straight to the penetration check.
        </>
      }
    >
      {BANDS.map((band) => (
        <path
          key={band.label}
          d={annularSector(CX, CY, INNER, OUTER, band.from, band.to)}
          className={`${band.className} stroke-border`}
          strokeWidth={1}
        />
      ))}
      {BANDS.map((band) => {
        const [x, y] = polar(CX, CY, band.r, band.mid);
        return (
          <text
            key={band.label}
            x={x}
            y={y}
            fontSize={14}
            fontWeight={600}
            textAnchor={band.from === 0 ? "start" : "middle"}
            className="fill-foreground"
          >
            {band.label}
          </text>
        );
      })}
      {TICKS.map((tick) => {
        const [x1, y1] = polar(CX, CY, OUTER, tick);
        const [x2, y2] = polar(CX, CY, OUTER + 10, tick);
        const [tx, ty] = polar(CX, CY, OUTER + 26, tick);
        // The 0° label would sit on the surface line, so it drops below it.
        const labelY = tick === 0 ? ty + 20 : ty + 5;
        return (
          <g key={tick}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-foreground" strokeWidth={2} />
            <text
              x={tx}
              y={labelY}
              fontSize={13}
              textAnchor="middle"
              className="fill-muted-foreground"
            >
              {tick}°
            </text>
          </g>
        );
      })}
      <line x1={10} y1={CY} x2={390} y2={CY} className="stroke-foreground" strokeWidth={3} />
      <text x={390} y={CY + 22} fontSize={13} textAnchor="end" className="fill-muted-foreground">
        surface
      </text>
    </DiagramFigure>
  );
}
