import type { OrbVisualState } from "./types";
import { IDLE_ORB_STATE } from "./state-tokens";

export interface OrbProps {
  state?: OrbVisualState;
}

export function Orb({ state = IDLE_ORB_STATE }: OrbProps) {
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
      className="flex min-h-[420px] w-full flex-col items-center justify-center gap-8 text-center"
    >
      <div
        aria-hidden="true"
        className="relative grid h-60 w-60 place-items-center rounded-full border border-cyan-200/30 bg-[radial-gradient(circle_at_50%_45%,rgba(155,231,255,0.34),rgba(19,92,120,0.22)_38%,rgba(6,16,24,0.92)_70%)] shadow-[0_0_70px_rgba(34,211,238,0.2)]"
      >
        <div className="h-36 w-36 rounded-full border border-white/20 bg-[radial-gradient(circle,rgba(255,255,255,0.2),rgba(34,211,238,0.12)_42%,rgba(3,7,18,0.7)_72%)]" />
        <div className="absolute h-48 w-48 rounded-full border border-teal-100/15" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal text-white">
          {state.label}
        </h1>
        <p className="text-sm text-cyan-100/70">{state.statusText}</p>
        <p className="mx-auto max-w-xl text-xs text-slate-400">
          {state.detailText}
        </p>
      </div>
    </section>
  );
}
