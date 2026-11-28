import { DiagramFigure } from "./DiagramFigure";

const LETHAL = "fill-status-red/30 stroke-status-red";
const LIMB = "fill-status-amber/20 stroke-status-amber";
const STOMACH = "fill-status-violet/25 stroke-status-violet";

const LIMBS = [
  { id: "left-arm", x: 74, y: 92, width: 36, height: 150, label: "49%" },
  { id: "right-arm", x: 210, y: 92, width: 36, height: 150, label: "49%" },
  { id: "left-leg", x: 121, y: 248, width: 37, height: 142, label: "70%" },
  { id: "right-leg", x: 162, y: 248, width: 37, height: 142, label: "70%" },
] as const;

/** A body outline showing how much damage each blacked part passes on to the rest of the body. */
export function OverflowDamageDiagram() {
  return (
    <DiagramFigure
      viewBox="0 0 320 400"
      label="Body outline: a blacked arm passes on 49 percent of damage, a leg 70 percent, the stomach 105 percent, and head or chest damage kills"
      caption={
        <>
          How much of a hit on a blacked part spreads to the rest of you. The stomach is the one
          part that passes on <em>more</em> than it takes. A blacked head or chest passes nothing
          on: you just die.
        </>
      }
    >
      <circle cx={160} cy={46} r={30} className={LETHAL} strokeWidth={2} />
      <text x={160} y={51} fontSize={13} textAnchor="middle" className="fill-foreground">
        dead
      </text>

      <rect x={116} y={84} width={88} height={92} rx={10} className={LETHAL} strokeWidth={2} />
      <text x={160} y={135} fontSize={13} textAnchor="middle" className="fill-foreground">
        dead
      </text>

      <rect x={120} y={180} width={80} height={62} rx={10} className={STOMACH} strokeWidth={2} />
      <text
        x={160}
        y={216}
        fontSize={15}
        fontWeight={700}
        textAnchor="middle"
        className="fill-foreground"
      >
        105%
      </text>

      {LIMBS.map((limb) => (
        <g key={limb.id}>
          <rect
            x={limb.x}
            y={limb.y}
            width={limb.width}
            height={limb.height}
            rx={12}
            className={LIMB}
            strokeWidth={2}
          />
          <text
            x={limb.x + limb.width / 2}
            y={limb.y + limb.height / 2 + 5}
            fontSize={13}
            fontWeight={700}
            textAnchor="middle"
            className="fill-foreground"
          >
            {limb.label}
          </text>
        </g>
      ))}
    </DiagramFigure>
  );
}
