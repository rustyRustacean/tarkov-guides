import { DiagramFigure, svgPath } from "./DiagramFigure";

const BLAST_X = 300;
const BLAST_Y = 165;

/** Top-down sketch of a minefield: the outer trigger zone, the danger zone, and the rings around a first blast. */
export function MinefieldDiagram() {
  return (
    <DiagramFigure
      viewBox="0 0 560 330"
      label="Top-down minefield: an outer rectangular trigger zone, a wavy danger zone inside it, and a first blast with a small safe ring and a larger splash ring"
      caption={
        <>
          Walking into the outer zone does nothing visible, but it starts a check once a second. Be
          inside the danger zone on a check and the first blast goes off, leaving you a 3 to 7 m
          safe ring around it. Leave that ring deeper in and the next blast kills. Anyone else
          inside the outer zone within 5 to 8 m of a blast takes splash damage, which can hit the
          head.
        </>
      }
    >
      <rect
        x={14}
        y={14}
        width={532}
        height={286}
        rx={8}
        className="fill-status-amber/10 stroke-status-amber"
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      <text x={28} y={40} fontSize={19} fontWeight={600} className="fill-status-amber">
        Outer trigger zone
      </text>

      <path
        d="M 170 70 C 230 40, 300 95, 370 60 S 500 80, 505 150 S 470 260, 400 255 S 280 290, 220 255 S 140 230, 150 160 S 130 95, 170 70 Z"
        className="fill-status-red/20 stroke-status-red"
        strokeWidth={2}
      />
      <text
        x={440}
        y={110}
        fontSize={19}
        fontWeight={600}
        textAnchor="middle"
        className="fill-status-red"
      >
        Danger zone
      </text>

      <circle
        cx={BLAST_X}
        cy={BLAST_Y}
        r={92}
        className="stroke-status-red fill-none"
        strokeWidth={2}
        strokeDasharray="4 5"
      />
      <circle
        cx={BLAST_X}
        cy={BLAST_Y}
        r={50}
        className="fill-status-teal/25 stroke-status-teal"
        strokeWidth={2}
      />
      <path
        d={svgPath(
          "M",
          BLAST_X - 9,
          BLAST_Y - 9,
          "L",
          BLAST_X + 9,
          BLAST_Y + 9,
          "M",
          BLAST_X + 9,
          BLAST_Y - 9,
          "L",
          BLAST_X - 9,
          BLAST_Y + 9,
        )}
        className="stroke-foreground"
        strokeWidth={3}
      />
      <text
        x={BLAST_X}
        y={BLAST_Y + 36}
        fontSize={16}
        textAnchor="middle"
        className="fill-foreground"
      >
        your safe ring
      </text>
      <text
        x={BLAST_X}
        y={BLAST_Y - 100}
        fontSize={16}
        textAnchor="middle"
        className="fill-foreground"
      >
        splash for others
      </text>

      <path
        d={svgPath("M", 30, BLAST_Y, "L", BLAST_X - 16, BLAST_Y)}
        className="stroke-foreground"
        strokeWidth={2}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      <text x={34} y={BLAST_Y - 10} fontSize={16} className="fill-muted-foreground">
        your path
      </text>
    </DiagramFigure>
  );
}
