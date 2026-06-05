import {
  GAUNTLET_VIEWBOX,
  buildGauntletViewModel,
  type CouncilStage,
  type GauntletHubState,
  type GauntletViewModel,
  type PowerState,
  type RealityState,
  type SoulState,
  type TimeActivationState,
} from "@/lib/gauntlet-visualization";

import { GauntletHub } from "./GauntletHub";
import { MindZone } from "./MindZone";
import { PowerZone } from "./PowerZone";
import { RealityZone } from "./RealityZone";
import { SoulZone } from "./SoulZone";
import { SpaceZone } from "./SpaceZone";
import { TimeZone } from "./TimeZone";

/**
 * Living System Map root — DD.2 + DD.3.
 *
 * Composes the Human Gate hub at the visual center and the populated
 * Space zone. The hub is rendered last so it always paints on top —
 * it can never be visually obscured. The root `data-hub-state` is the
 * trigger CSS uses to halt or resume pulses approaching / passing
 * through the gate.
 *
 * Strict read-only contract:
 *   - no <button>, <form>, <input>, <select>, <a>
 *   - no controls, no actions, no execution
 *   - no live telemetry subscription
 */

export interface GauntletPipelineProps {
  viewModel?: GauntletViewModel;
  hubState?: GauntletHubState;
  timeState?: TimeActivationState;
  councilStage?: CouncilStage;
  soulState?: SoulState;
  realityState?: RealityState;
  powerState?: PowerState;
}

export function GauntletPipeline({
  viewModel,
  hubState,
  timeState,
  councilStage,
  soulState,
  realityState,
  powerState,
}: GauntletPipelineProps) {
  const model =
    viewModel ??
    buildGauntletViewModel({
      hubState: hubState ?? "default",
      timeState: timeState ?? "idle",
      councilStage: councilStage ?? "idle",
      soulState: soulState ?? "idle",
      realityState: realityState ?? "idle",
      powerState: powerState ?? "idle",
    });
  const space = model.zones.find((zone) => zone.zone_id === "space");
  const time = model.zones.find((zone) => zone.zone_id === "time");
  const mind = model.zones.find((zone) => zone.zone_id === "mind");
  const soul = model.zones.find((zone) => zone.zone_id === "soul");
  const reality = model.zones.find((zone) => zone.zone_id === "reality");
  const power = model.zones.find((zone) => zone.zone_id === "power");
  const populatedZones = model.populated_zones.join(",");

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
      className="grid w-full gap-6 border border-border-subtle bg-panel p-6 shadow-cockpit-depth"
    >
      <header className="grid gap-2">
        <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-signal">
          Living System Map · read only · demo fixtures
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {model.title}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-ink/70">
          {model.subtitle}
        </p>
      </header>

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
        viewBox={`0 0 ${GAUNTLET_VIEWBOX.width} ${GAUNTLET_VIEWBOX.height}`}
        className="w-full"
        style={{ minHeight: "320px" }}
      >
        {/* Backdrop grid for the cockpit feel. */}
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
        </defs>
        <rect
          width={GAUNTLET_VIEWBOX.width}
          height={GAUNTLET_VIEWBOX.height}
          fill="url(#gauntlet-grid)"
        />

        {/* Zones paint first; hub overlays last so it is never obscured. */}
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

        {/* Hub — always visible. */}
        <GauntletHub hub={model.hub} />
      </svg>

      <footer className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-ink/45">
        Read-only governance surface · no execute · no approve · no mutate · no
        recording · no voice · no exports
      </footer>
    </section>
  );
}
