import type { OrbVisualState } from "./types";
import { IDLE_ORB_STATE } from "./state-tokens";

export interface OrbProps {
  state?: OrbVisualState;
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

export function Orb({ state = IDLE_ORB_STATE }: OrbProps) {
  const tone = toneClasses[state.tone];
  const metadata = [
    ["Mode", state.mode],
    ["Load", state.loadBand],
    ["Governance", state.governancePosture],
    ["Heartbeat", state.heartbeat],
    ["Event", state.lastEventClass],
  ] as const;

  return (
    <section
      aria-label={state.label}
      data-orb-mode={state.mode}
      data-load-band={state.loadBand}
      data-governance-posture={state.governancePosture}
      data-heartbeat={state.heartbeat}
      data-local-only={String(state.localOnly)}
      data-authority={state.authority}
      data-metadata-only={String(state.metadataOnly)}
      data-withheld={String(state.withheld)}
      className="flex min-h-[560px] w-full flex-col items-center justify-center gap-9 text-center"
    >
      <div className="relative grid h-[21rem] w-[21rem] place-items-center sm:h-[26rem] sm:w-[26rem]">
        <div
          aria-hidden="true"
          className={`absolute h-full w-full rounded-full border ${tone.accent} opacity-55 motion-safe:animate-pulse`}
        />
        <div
          aria-hidden="true"
          className="absolute h-[82%] w-[82%] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute h-[64%] w-[64%] rounded-full border border-cyan-100/10"
        />

        <div
          aria-hidden="true"
          className={`relative grid h-60 w-60 place-items-center rounded-full border bg-[radial-gradient(circle_at_50%_42%,var(--tw-gradient-stops))] ${tone.core} ${tone.shell} sm:h-72 sm:w-72`}
        >
          <div className="h-36 w-36 rounded-full border border-white/20 bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(34,211,238,0.12)_42%,rgba(3,7,18,0.78)_72%)] sm:h-44 sm:w-44" />
          <div className="absolute h-48 w-48 rounded-full border border-teal-100/15 sm:h-60 sm:w-60" />
          <div className="absolute h-20 w-20 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/70">
          Command Center Foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
          {state.label}
        </h1>
        <p className="text-base text-cyan-100/78">{state.statusText}</p>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300/72">
          {state.detailText}
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
