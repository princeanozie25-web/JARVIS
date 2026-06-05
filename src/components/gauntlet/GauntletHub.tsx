import { stoneColorVar } from "@/lib/design-tokens";
import type {
  GauntletHub as GauntletHubModel,
  GauntletHubState,
} from "@/lib/gauntlet-visualization";

/**
 * Human Gate hub — DD.2.
 *
 * SVG <g> fragment intended to be composed inside a parent <svg>. The
 * hub is always rendered (`hidden` cannot be set externally), always
 * carries an aria-label, and always exposes its state via
 * `data-gauntlet-hub`. The visible ring color tracks the state:
 *
 *   default            gold
 *   proposal_pending   amber review
 *   approved           emerald local
 *   denied             rose blocked
 *
 * Halt / resume mechanics are encoded in the parent pipeline via the
 * pulse stylesheet — this hub component renders the visible boundary.
 */

const STATE_STONE_VAR: Readonly<Record<GauntletHubState, string>> = {
  default: stoneColorVar("gold"),
  proposal_pending: "var(--jarvis-color-pipeline-human-gate)",
  approved: "var(--jarvis-color-pipeline-execute)",
  denied: "var(--jarvis-color-pipeline-forbidden)",
};

const STATE_LABEL: Readonly<Record<GauntletHubState, string>> = {
  default: "IDLE",
  proposal_pending: "APPROVAL PENDING",
  approved: "APPROVED",
  denied: "DENIED",
};

export interface GauntletHubProps {
  hub: GauntletHubModel;
}

export function GauntletHub({ hub }: GauntletHubProps) {
  const color = STATE_STONE_VAR[hub.state];
  const label = STATE_LABEL[hub.state];
  const { x, y } = hub.position;
  const radius = 72;

  return (
    <g
      data-gauntlet-hub={hub.state}
      data-gauntlet-hub-id={hub.hub_id}
      data-gauntlet-always-visible="true"
      aria-label={`Human Gate hub — ${label}`}
      role="img"
    >
      <g aria-hidden="true" data-human-gate-authority-core="true">
        <circle
          cx={x}
          cy={y}
          r={radius + 38}
          fill="none"
          stroke={color}
          strokeOpacity={0.18}
          strokeWidth={1}
        />
        <circle
          cx={x}
          cy={y}
          r={radius + 28}
          fill="none"
          stroke={color}
          strokeOpacity={0.24}
          strokeWidth={1.5}
          strokeDasharray="12 7"
        />
        <circle
          cx={x}
          cy={y}
          r={radius + 8}
          fill="rgba(250,204,21,0.08)"
          stroke={color}
          strokeOpacity={0.34}
          strokeWidth={1}
        />
      </g>
      <circle
        data-gauntlet-hub-ring
        cx={x}
        cy={y}
        r={radius + 18}
        fill="none"
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={2}
      />
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="var(--jarvis-color-panel)"
        stroke={color}
        strokeWidth={3}
      />
      <circle
        cx={x}
        cy={y}
        r={radius - 10}
        fill="none"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        fontFamily="var(--jarvis-font-display)"
        fontSize={22}
        fontWeight={600}
        fill="var(--jarvis-color-ink)"
      >
        Human Gate
      </text>
      <text
        x={x}
        y={y + 18}
        textAnchor="middle"
        fontFamily="var(--jarvis-font-mono)"
        fontSize={10}
        letterSpacing="0.24em"
        fill={color}
        data-gauntlet-hub-state-label="true"
      >
        {label}
      </text>
    </g>
  );
}
