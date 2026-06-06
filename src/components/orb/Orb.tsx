import type { OrbVisualState, RestOrbStateTokens } from "./types";
import { IDLE_ORB_STATE, restOrbTokensToViewModel } from "./state-tokens";
import {
  type OrbActivityState,
  resolveOrbActivityState,
} from "./activity-states";
import { OrbReactorAtmosphere } from "./OrbReactorAtmosphere";

export interface OrbProps {
  state?: OrbVisualState;
  projectionTokens?: RestOrbStateTokens;
  projectionState?: OrbVisualState;
  /**
   * UI.6 activity state. Drives the SVG/CSS truth layer via
   * `data-orb-activity-state`. Unknown values fall back to `idle`.
   */
  activityState?: OrbActivityState | string;
}

const toneClasses = {
  quiet: {
    shell: "border-cyan-100/30 shadow-[0_0_90px_rgba(34,211,238,0.22)]",
    core: "from-cyan-100/28 via-teal-300/16 to-slate-950",
    accent: "border-emerald-200/20",
  },
  focused: {
    shell: "border-sky-100/35 shadow-[0_0_96px_rgba(56,189,248,0.24)]",
    core: "from-sky-100/30 via-blue-300/16 to-slate-950",
    accent: "border-sky-200/22",
  },
  review: {
    shell: "border-amber-100/35 shadow-[0_0_96px_rgba(251,191,36,0.2)]",
    core: "from-amber-100/28 via-cyan-200/14 to-slate-950",
    accent: "border-amber-100/22",
  },
  withheld: {
    shell: "border-rose-100/28 shadow-[0_0_90px_rgba(244,63,94,0.14)]",
    core: "from-rose-100/22 via-slate-300/10 to-slate-950",
    accent: "border-rose-100/18",
  },
} as const;

function formatToken(value: string) {
  return value.replaceAll("_", " ");
}

export function Orb({
  state = IDLE_ORB_STATE,
  projectionTokens,
  projectionState,
  activityState,
}: OrbProps) {
  const renderedState = resolveVisualState(
    state,
    projectionTokens,
    projectionState,
  );
  const tone = toneClasses[renderedState.tone];
  const activity = resolveOrbActivityState(activityState);
  const metadata = [
    ["Mode", renderedState.mode],
    ["Load", renderedState.loadBand],
    ["Governance", renderedState.governancePosture],
    ["Heartbeat", renderedState.heartbeat],
    ["Event", renderedState.lastEventClass],
    ["Activity", activity.label],
  ] as const;

  return (
    <section
      aria-label={renderedState.label}
      data-orb-mode={renderedState.mode}
      data-load-band={renderedState.loadBand}
      data-governance-posture={renderedState.governancePosture}
      data-heartbeat={renderedState.heartbeat}
      data-local-only={String(renderedState.localOnly)}
      data-authority={renderedState.authority}
      data-metadata-only={String(renderedState.metadataOnly)}
      data-withheld={String(renderedState.withheld)}
      data-orb-activity-state={activity.state}
      data-orb-activity-tone={activity.semantic}
      data-orb-activity-animation={activity.animation}
      className="flex min-h-[500px] w-full flex-col items-center justify-center gap-6 text-center"
    >
      <div className="relative grid h-[19rem] w-[19rem] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.12),rgba(8,47,73,0.08)_38%,rgba(2,6,23,0)_72%)] sm:h-[22rem] sm:w-[22rem]">
        <OrbReactorAtmosphere presentationalState={activity.state} />
        <div
          aria-hidden="true"
          data-orb-layer="reactor-shell"
          data-orb-reactor-layer="mechanical_outer_ring"
          data-orb-layer-purpose="machined reactor casing"
          data-orb-layer-identity="arc reactor outer steel-blue shell"
          data-orb-layer-motion="slow structural idle spin"
          className="absolute h-[106%] w-[106%] rounded-full border border-cyan-100/20 bg-[repeating-conic-gradient(from_0deg,rgba(226,246,255,0.18)_0deg,rgba(226,246,255,0.18)_2deg,transparent_2deg,transparent_11deg),radial-gradient(circle,transparent_58%,rgba(14,165,233,0.1)_60%,transparent_68%)]"
        />
        {/* Atmospheric outer halo — reactor exhaust. */}
        <div
          aria-hidden="true"
          data-orb-layer="atmosphere"
          data-orb-reactor-layer="atmospheric_halo"
          data-orb-layer-purpose="environment illumination"
          data-orb-layer-identity="navy reactor exhaust halo"
          data-orb-layer-motion="slow atmospheric breathing"
          className="absolute h-[112%] w-[112%] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18)_0%,rgba(8,47,73,0.08)_45%,transparent_72%)] blur-2xl"
        />
        {/* Outer containment ring. */}
        <div
          aria-hidden="true"
          data-orb-layer="ring"
          data-orb-reactor-layer="outer_containment_ring"
          data-orb-layer-purpose="primary containment"
          data-orb-layer-identity="engineered pressure shell"
          data-orb-layer-motion="restrained containment pulse"
          className={`absolute h-full w-full rounded-full border ${tone.accent} opacity-55 motion-safe:animate-pulse`}
        />
        <div
          aria-hidden="true"
          data-orb-layer="reactor-vane"
          data-orb-reactor-layer="blue_plasma_vane_array"
          data-orb-layer-purpose="radial plasma focusing"
          data-orb-layer-identity="blue-white reactor vane array"
          data-orb-layer-motion="subtle counter-pressure flicker"
          className="absolute h-[92%] w-[92%] rounded-full bg-[repeating-conic-gradient(from_9deg,rgba(186,230,253,0.22)_0deg,rgba(186,230,253,0.22)_4deg,transparent_4deg,transparent_20deg)] opacity-70"
        />
        {/* Mid containment ring — counter-rotates with the turbine. */}
        <div
          aria-hidden="true"
          data-orb-layer="sweep"
          data-orb-reactor-layer="compression_ring"
          data-orb-layer-purpose="plasma compression"
          data-orb-layer-identity="focused pressure band"
          data-orb-layer-motion="state-driven compression"
          className="absolute h-[82%] w-[82%] rounded-full border border-white/10"
        />
        {/* Inner containment ring — reactor lattice. */}
        <div
          aria-hidden="true"
          data-orb-layer="containment"
          data-orb-reactor-layer="counter_rotating_containment_lattice"
          data-orb-layer-purpose="field stabilization"
          data-orb-layer-identity="counter-rotating lattice"
          data-orb-layer-motion="reverse containment rotation"
          className="absolute h-[72%] w-[72%] rounded-full border border-cyan-100/15"
        />
        <div
          aria-hidden="true"
          data-orb-reactor-layer="plasma_compression_chamber"
          data-orb-layer-purpose="energy pressure vessel"
          data-orb-layer-identity="compressed plasma chamber"
          data-orb-layer-motion="contained pressure breathing"
          className="absolute h-[64%] w-[64%] rounded-full border border-cyan-100/10"
        />
        <div
          aria-hidden="true"
          data-orb-reactor-layer="triangular_flux_bridge"
          data-orb-layer-purpose="arc reactor structural bridge"
          data-orb-layer-identity="tri-blade inner compression bridge"
          data-orb-layer-motion="locked alignment shimmer"
          className="absolute h-[46%] w-[46%] bg-[conic-gradient(from_30deg,transparent_0deg,transparent_24deg,rgba(226,246,255,0.22)_24deg,rgba(226,246,255,0.22)_42deg,transparent_42deg,transparent_144deg,rgba(125,211,252,0.2)_144deg,rgba(125,211,252,0.2)_162deg,transparent_162deg,transparent_264deg,rgba(226,246,255,0.22)_264deg,rgba(226,246,255,0.22)_282deg,transparent_282deg)] opacity-80"
        />

        {/* Turbine — jet-engine blade ring rendered as conic SVG. */}
        <svg
          aria-hidden="true"
          data-orb-layer="turbine"
          data-orb-reactor-layer="turbine_ring"
          data-orb-layer-purpose="reactor turbine"
          data-orb-layer-identity="jet-engine blade ring"
          data-orb-layer-motion="state-paced turbine rotation"
          viewBox="-100 -100 200 200"
          className="absolute h-[58%] w-[58%]"
        >
          <defs>
            <radialGradient id="orb-turbine-fade" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="rgba(125,211,252,0.55)" />
              <stop offset="60%" stopColor="rgba(56,189,248,0.18)" />
              <stop offset="100%" stopColor="rgba(2,6,23,0)" />
            </radialGradient>
          </defs>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            return (
              <g key={i} transform={`rotate(${angle})`}>
                <path
                  d="M 0 -90 L 14 -36 L 0 -28 L -14 -36 Z"
                  fill="url(#orb-turbine-fade)"
                  opacity={0.78}
                />
              </g>
            );
          })}
          <circle
            cx={0}
            cy={0}
            r={40}
            fill="none"
            stroke="rgba(186,230,253,0.18)"
            strokeWidth={1}
          />
        </svg>

        <div
          aria-hidden="true"
          data-orb-layer="core"
          data-orb-reactor-layer="fusion_core"
          data-orb-layer-purpose="central power source"
          data-orb-layer-identity="contained fusion heart"
          data-orb-layer-motion="plasma heartbeat"
          className={`relative grid h-52 w-52 place-items-center rounded-full border bg-[radial-gradient(circle_at_50%_42%,var(--tw-gradient-stops))] ${tone.core} ${tone.shell} sm:h-64 sm:w-64`}
        >
          <div
            aria-hidden="true"
            data-orb-reactor-layer="arc_reactor_blue_white_core"
            data-orb-layer-purpose="visible arc-reactor authority core"
            data-orb-layer-identity="blue-white contained intelligence core"
            data-orb-layer-motion="slow contained plasma ignition"
            className="absolute h-[72%] w-[72%] rounded-full border border-white/30 bg-[radial-gradient(circle,rgba(255,255,255,0.88)_0%,rgba(186,230,253,0.55)_18%,rgba(56,189,248,0.24)_42%,transparent_72%)]"
          />
          {/* Plasma flame — bright reactor center. */}
          <div
            aria-hidden="true"
            data-orb-layer="plasma"
            data-orb-reactor-layer="fusion_flame"
            data-orb-layer-purpose="visible fusion pressure"
            data-orb-layer-identity="compressed blue plasma"
            data-orb-layer-motion="contained flame compression"
            className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.92)_0%,rgba(125,211,252,0.55)_22%,rgba(14,165,233,0.35)_48%,rgba(8,47,73,0)_78%)] sm:h-44 sm:w-44"
          />
          <div className="h-32 w-32 rounded-full border border-white/20 bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(34,211,238,0.12)_42%,rgba(3,7,18,0.78)_72%)] sm:h-40 sm:w-40" />
          <div className="absolute h-44 w-44 rounded-full border border-teal-100/15 sm:h-56 sm:w-56" />
          <div className="absolute h-16 w-16 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/70">
          Command Center Foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
          {renderedState.label}
        </h1>
        <p className="text-base text-cyan-100/78">{renderedState.statusText}</p>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300/72">
          {renderedState.detailText}
        </p>
      </div>

      <dl
        aria-label="Rest orb metadata"
        className="grid w-full max-w-4xl grid-cols-2 gap-3 text-left sm:grid-cols-5"
      >
        {metadata.map(([label, value]) => (
          <div
            key={label}
            className="border border-white/10 bg-white/[0.035] px-4 py-3"
          >
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </dt>
            <dd className="mt-1 text-sm text-slate-100">
              {formatToken(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const UNSAFE_PROJECTION_TOKENS: RestOrbStateTokens = Object.freeze({
  mode: "idle",
  load_band: "idle",
  last_event_class: "error",
  governance_posture: "gated_active",
  heartbeat: "unavailable",
});

function resolveVisualState(
  fallbackState: OrbVisualState,
  projectionTokens: RestOrbStateTokens | undefined,
  projectionState: OrbVisualState | undefined,
): OrbVisualState {
  if (projectionTokens) {
    return restOrbTokensToViewModel(projectionTokens);
  }
  if (projectionState) {
    return isSafeProjectionState(projectionState)
      ? restOrbTokensToViewModel(tokensFromVisualState(projectionState))
      : restOrbTokensToViewModel(UNSAFE_PROJECTION_TOKENS);
  }
  return isSafeProjectionState(fallbackState)
    ? fallbackState
    : restOrbTokensToViewModel(UNSAFE_PROJECTION_TOKENS);
}

function tokensFromVisualState(state: OrbVisualState): RestOrbStateTokens {
  return {
    mode: state.mode,
    load_band: state.loadBand,
    last_event_class: state.lastEventClass,
    governance_posture: state.governancePosture,
    heartbeat: state.heartbeat,
  };
}

function isSafeProjectionState(state: OrbVisualState): boolean {
  return (
    state.metadataOnly === true &&
    state.rawPayloadIncluded === false &&
    state.localOnly === true &&
    state.authority === "none" &&
    state.withheld === false &&
    isSafeMetadataValue(state)
  );
}

function isSafeMetadataValue(value: unknown): boolean {
  return !containsUnsafePayload(value, new Set());
}

function containsUnsafePayload(value: unknown, seen: Set<object>): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return isSecretText(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafePayload(item, seen));
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeKeyValue(key, child)) return true;
    if (containsUnsafePayload(child, seen)) return true;
  }
  return false;
}

function isUnsafeKeyValue(key: string, value: unknown): boolean {
  if (
    /raw|payload_json|prompt|output|transcript|frame|secret|token/i.test(key)
  ) {
    if (value === null || value === false) return false;
    if (key === "rawPayloadIncluded" && value === false) return false;
    if (key === "raw_payload_included" && value === false) return false;
    return true;
  }
  return false;
}

function isSecretText(value: string): boolean {
  return /(api[_-]?key|password|secret|token|sk-)/i.test(value);
}
