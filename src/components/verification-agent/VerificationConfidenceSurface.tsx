import type { VerificationConfidenceSurfaceViewModel } from "../../lib/verification-agent";

export interface VerificationConfidenceSurfaceProps {
  readonly model: VerificationConfidenceSurfaceViewModel;
}

export function VerificationConfidenceSurface({
  model,
}: VerificationConfidenceSurfaceProps) {
  return (
    <aside
      aria-label="Verification confidence metadata"
      data-verification-confidence-surface={model.state}
      data-metadata-only={String(model.metadata_only)}
      data-advisory-only="true"
      data-confidence={model.confidence}
      data-confidence-tone={model.confidence_tone}
      data-execution-controls-visible={String(model.execution_controls_visible)}
      className="grid gap-4 border border-white/10 bg-slate-950/72 p-4 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">
            Verification
          </p>
          <p className="mt-2 text-sm text-slate-300">{model.advisory_label}</p>
        </div>
        <span
          aria-label={`Verification ${model.confidence_label}`}
          className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${confidenceToneClass(
            model.confidence_tone,
          )}`}
        >
          {model.confidence_label}
        </span>
      </div>

      <div
        title={model.caveat}
        className="border border-white/10 bg-white/[0.03] px-3 py-2"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Caveat
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-200">{model.caveat}</p>
      </div>

      <div
        aria-label="Verification state metadata"
        className="flex flex-wrap gap-2"
      >
        <span className="border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          {formatToken(model.state)}
        </span>
        <span className="border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          {model.truth_claim_label}
        </span>
      </div>

      <section aria-label="Verification risk flags">
        <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Risk Flags
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {model.risk_badges.length > 0 ? (
            model.risk_badges.map((badge) => (
              <span
                key={badge.flag}
                data-risk-flag={badge.flag}
                className="border border-amber-100/20 bg-amber-300/[0.055] px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-amber-50/85"
              >
                {badge.label}
              </span>
            ))
          ) : (
            <span className="border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-slate-400">
              none
            </span>
          )}
        </div>
      </section>
    </aside>
  );
}

function confidenceToneClass(
  tone: VerificationConfidenceSurfaceViewModel["confidence_tone"],
): string {
  switch (tone) {
    case "success":
      return "border-emerald-100/25 bg-emerald-300/[0.07] text-emerald-50";
    case "caution":
      return "border-amber-100/25 bg-amber-300/[0.07] text-amber-50";
    case "danger":
      return "border-rose-100/25 bg-rose-300/[0.07] text-rose-50";
    case "unavailable":
      return "border-slate-100/15 bg-slate-300/[0.045] text-slate-300";
    case "neutral":
      return "border-cyan-100/20 bg-cyan-300/[0.055] text-cyan-50";
  }
}

function formatToken(value: string): string {
  return value.replaceAll("_", " ");
}
