import {
  GAUNTLET_VIEWBOX,
  buildGauntletViewModel,
  type CouncilStage,
  type GauntletHubState,
  type GauntletPoint,
  type GauntletViewModel,
  type PowerState,
  type RealityState,
  type SoulState,
  type TimeActivationState,
} from "@/lib/gauntlet-visualization";

import { GauntletAtmosphere } from "./GauntletAtmosphere";
import { GauntletHub } from "./GauntletHub";
import { MindZone } from "./MindZone";
import { PowerZone } from "./PowerZone";
import { RealityZone } from "./RealityZone";
import { SoulZone } from "./SoulZone";
import { SpaceZone } from "./SpaceZone";
import { TimeZone } from "./TimeZone";

export interface GauntletPipelineProps {
  viewModel?: GauntletViewModel;
  hubState?: GauntletHubState;
  timeState?: TimeActivationState;
  councilStage?: CouncilStage;
  soulState?: SoulState;
  realityState?: RealityState;
  powerState?: PowerState;
  presentation?: "standard" | "cinematic";
}

export function GauntletPipeline({
  viewModel,
  hubState,
  timeState,
  councilStage,
  soulState,
  realityState,
  powerState,
  presentation = "standard",
}: GauntletPipelineProps) {
  const baseModel =
    viewModel ??
    buildGauntletViewModel({
      hubState: hubState ?? "default",
      timeState: timeState ?? "idle",
      councilStage: councilStage ?? "idle",
      soulState: soulState ?? "idle",
      realityState: realityState ?? "idle",
      powerState: powerState ?? "idle",
    });
  const isCinematic = presentation === "cinematic";
  const model = isCinematic
    ? toCinematicGauntletViewModel(baseModel)
    : baseModel;
  const viewBox = isCinematic ? CINEMATIC_GAUNTLET_VIEWBOX : GAUNTLET_VIEWBOX;
  const viewBoxX = "x" in viewBox ? viewBox.x : 0;
  const viewBoxY = "y" in viewBox ? viewBox.y : 0;
  const space = model.zones.find((zone) => zone.zone_id === "space");
  const time = model.zones.find((zone) => zone.zone_id === "time");
  const mind = model.zones.find((zone) => zone.zone_id === "mind");
  const soul = model.zones.find((zone) => zone.zone_id === "soul");
  const reality = model.zones.find((zone) => zone.zone_id === "reality");
  const power = model.zones.find((zone) => zone.zone_id === "power");
  const populatedZones = model.populated_zones.join(",");
  const atmosphereMode =
    model.hub.state === "proposal_pending" || model.hub.state === "denied"
      ? "warning"
      : model.time_state !== "idle" ||
          model.mind_council_stage !== "idle" ||
          model.soul_state !== "idle" ||
          model.reality_state !== "idle" ||
          model.power_state !== "idle"
        ? "focused"
        : "stable";

  return (
    <section
      aria-label="JARVIS Living System Map"
      role="region"
      data-living-system-map="read-only"
      data-execute-affordance-present={String(model.execute_affordance_present)}
      data-approve-affordance-present={String(model.approve_affordance_present)}
      data-mutation-affordance-present={String(
        model.mutation_affordance_present,
      )}
      data-recording-enabled={String(model.recording_enabled)}
      data-voice-enabled={String(model.voice_enabled)}
      data-export-enabled={String(model.export_enabled)}
      data-live-telemetry-subscribed={String(model.live_telemetry_subscribed)}
      data-gauntlet-presentation={presentation}
      className={
        isCinematic
          ? "relative grid w-full gap-3 overflow-hidden rounded-lg border border-cyan-200/10 bg-slate-950/10 p-3 shadow-[0_0_80px_rgba(14,165,233,0.12)]"
          : "grid w-full gap-6 border border-border-subtle bg-panel p-6 shadow-cockpit-depth"
      }
    >
      {isCinematic ? null : (
        <header className="grid gap-2">
          <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-signal">
            Living System Map - read only - demo fixtures
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {model.title}
          </h1>
          <p className="max-w-prose text-sm leading-6 text-ink/70">
            {model.subtitle}
          </p>
        </header>
      )}

      <div
        className="relative overflow-hidden rounded-md"
        data-gauntlet-atmosphere-shell="optional"
      >
        <GauntletAtmosphere presentationalMode={atmosphereMode} />
        <svg
          role="img"
          aria-label="Living System Map governance flow"
          data-gauntlet-pipeline="read-only"
          data-hub-state={model.hub.state}
          data-time-state={model.time_state}
          data-mind-council-stage={model.mind_council_stage}
          data-soul-state={model.soul_state}
          data-reality-state={model.reality_state}
          data-power-state={model.power_state}
          data-populated-zones={populatedZones}
          data-gauntlet-cinematic-canvas={String(isCinematic)}
          viewBox={`${viewBoxX} ${viewBoxY} ${viewBox.width} ${viewBox.height}`}
          className="relative z-10 w-full"
          style={{ minHeight: isCinematic ? "min(70vw, 820px)" : "320px" }}
        >
          <defs>
            <pattern
              id="gauntlet-grid"
              width={64}
              height={64}
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M64 0 L0 0 0 64"
                fill="none"
                stroke="var(--jarvis-color-border-subtle)"
                strokeWidth={1}
              />
            </pattern>
            <radialGradient id="gauntlet-atmosphere" cx="50%" cy="28%" r="65%">
              <stop offset="0%" stopColor="rgba(56,189,248,0.10)" />
              <stop offset="55%" stopColor="rgba(8,47,73,0.04)" />
              <stop offset="100%" stopColor="rgba(2,6,23,0)" />
            </radialGradient>
          </defs>
          <rect
            data-gauntlet-backdrop="panel"
            x={viewBoxX}
            y={viewBoxY}
            width={viewBox.width}
            height={viewBox.height}
            fill={
              isCinematic ? "rgba(2,6,23,0.18)" : "var(--jarvis-color-panel)"
            }
          />
          <rect
            data-gauntlet-backdrop="grid"
            x={viewBoxX}
            y={viewBoxY}
            width={viewBox.width}
            height={viewBox.height}
            fill="url(#gauntlet-grid)"
            opacity={isCinematic ? 0.28 : 1}
          />
          <rect
            data-gauntlet-backdrop="atmosphere"
            x={viewBoxX}
            y={viewBoxY}
            width={viewBox.width}
            height={viewBox.height}
            fill="url(#gauntlet-atmosphere)"
          />

          {space ? <SpaceZone zone={space} /> : null}
          {time ? (
            <TimeZone zone={time} state={model.time_state} hub={model.hub} />
          ) : null}
          {mind ? (
            <MindZone
              zone={mind}
              councilStage={model.mind_council_stage}
              hub={model.hub}
            />
          ) : null}
          {soul ? (
            <SoulZone zone={soul} state={model.soul_state} hub={model.hub} />
          ) : null}
          {reality ? (
            <RealityZone
              zone={reality}
              state={model.reality_state}
              hub={model.hub}
            />
          ) : null}
          {power ? (
            <PowerZone zone={power} state={model.power_state} hub={model.hub} />
          ) : null}

          <GauntletHub hub={model.hub} />
        </svg>
      </div>

      {isCinematic ? null : (
        <footer className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-ink/45">
          Read-only governance surface - no execute - no approve - no mutate -
          no recording - no voice - no exports
        </footer>
      )}
    </section>
  );
}

const CINEMATIC_GAUNTLET_VIEWBOX = {
  x: 0,
  y: 54,
  width: 1500,
  height: 866,
} as const;
const CINEMATIC_HUB_POSITION = { x: 870, y: 495 } as const;

const CINEMATIC_SPACE_POSITIONS: Readonly<Record<string, GauntletPoint>> = {
  input_gateway: { x: 90, y: 520 },
  intent_classifier: { x: 235, y: 455 },
  safety_classifier: { x: 235, y: 585 },
  router: { x: 455, y: 520 },
  tier_t0: { x: 620, y: 360 },
  tier_t1: { x: 620, y: 430 },
  tier_t2: { x: 620, y: 520 },
  tier_t3: { x: 620, y: 610 },
  tier_t4: { x: 620, y: 690 },
  tool_runtime: { x: 1215, y: 500 },
  audit_store: { x: 1400, y: 500 },
};

const CINEMATIC_ZONE_PROFILES = {
  time: { from: { x: 400, y: 1250 }, to: { x: 555, y: 210 }, scale: 0.62 },
  mind: { from: { x: 1100, y: 1250 }, to: { x: 1040, y: 220 }, scale: 0.58 },
  soul: { from: { x: 400, y: 1900 }, to: { x: 555, y: 735 }, scale: 0.62 },
  reality: {
    from: { x: 1200, y: 1900 },
    to: { x: 1245, y: 730 },
    scale: 0.62,
  },
  power: { from: { x: 800, y: 2400 }, to: { x: 905, y: 765 }, scale: 0.58 },
} as const;

function toCinematicGauntletViewModel(
  model: GauntletViewModel,
): GauntletViewModel {
  return {
    ...model,
    hub: {
      ...model.hub,
      position: { ...CINEMATIC_HUB_POSITION },
    },
    zones: model.zones.map((zone) => {
      if (zone.zone_id === "space") {
        return {
          ...zone,
          nodes: zone.nodes.map((node) => ({
            ...node,
            position: CINEMATIC_SPACE_POSITIONS[node.node_id] ?? node.position,
          })),
        };
      }

      const profile =
        zone.zone_id in CINEMATIC_ZONE_PROFILES
          ? CINEMATIC_ZONE_PROFILES[
              zone.zone_id as keyof typeof CINEMATIC_ZONE_PROFILES
            ]
          : null;

      if (!profile) return zone;

      return {
        ...zone,
        nodes: zone.nodes.map((node) => ({
          ...node,
          position: remapPoint(node.position, profile),
        })),
      };
    }),
  };
}

function remapPoint(
  point: GauntletPoint,
  profile: { from: GauntletPoint; to: GauntletPoint; scale: number },
): GauntletPoint {
  return {
    x: Math.round(profile.to.x + (point.x - profile.from.x) * profile.scale),
    y: Math.round(profile.to.y + (point.y - profile.from.y) * profile.scale),
  };
}
