import type { AuditRegionPlaceholder, AuditShellModel } from "./types";

export const AUDIT_SHELL_MODEL: AuditShellModel = Object.freeze({
  title: "JARVIS Room OS — Audit Mode",
  subtitle: "Read-only forensics shell. Static placeholder regions only.",
  posture: "read_only_forensics_shell",
  localOnly: true,
  metadataOnly: true,
  authority: "none",
  regions: Object.freeze([
    {
      region_id: "replay_timeline",
      title: "Replay timeline",
      eyebrow: "Forensics",
      description: "Timeline metadata placeholder for future trace inspection.",
      status: "placeholder",
      posture: "inspection_only",
      dataClassification: "metadata_only",
      authority: "none",
      rows: Object.freeze([
        { label: "Timeline", value: "static" },
        { label: "Payloads", value: "withheld" },
      ]),
    },
    {
      region_id: "trace_viewer",
      title: "Trace viewer",
      eyebrow: "Evidence",
      description: "Trace metadata remains disconnected from stored events.",
      status: "not_connected",
      posture: "inspection_only",
      dataClassification: "metadata_only",
      authority: "none",
      rows: Object.freeze([
        { label: "Trace", value: "placeholder" },
        { label: "Bodies", value: "withheld" },
      ]),
    },
    {
      region_id: "governance_boundary_viewer",
      title: "Governance boundary viewer",
      eyebrow: "Policy",
      description:
        "Boundary visualization placeholder with no decision surface.",
      status: "placeholder",
      posture: "inspection_only",
      dataClassification: "metadata_only",
      authority: "none",
      rows: Object.freeze([
        { label: "Boundary", value: "visible" },
        { label: "Authority", value: "none" },
      ]),
    },
    {
      region_id: "runtime_dependency_viewer",
      title: "Runtime dependency viewer",
      eyebrow: "Runtime",
      description:
        "Dependency graph placeholder; graph logic is not connected.",
      status: "not_connected",
      posture: "inspection_only",
      dataClassification: "metadata_only",
      authority: "none",
      rows: Object.freeze([
        { label: "Graph", value: "placeholder" },
        { label: "Edges", value: "metadata only" },
      ]),
    },
    {
      region_id: "redaction_status",
      title: "Redaction status",
      eyebrow: "Privacy",
      description: "Redaction posture placeholder without raw content display.",
      status: "withheld",
      posture: "inspection_only",
      dataClassification: "metadata_only",
      authority: "none",
      rows: Object.freeze([
        { label: "Payload", value: "withheld" },
        { label: "Display", value: "metadata only" },
      ]),
    },
    {
      region_id: "disabled_feature_matrix",
      title: "Disabled-feature matrix",
      eyebrow: "Safety",
      description: "Frozen feature posture placeholder for audit review.",
      status: "placeholder",
      posture: "inspection_only",
      dataClassification: "metadata_only",
      authority: "none",
      rows: Object.freeze([
        { label: "Matrix", value: "static" },
        { label: "Controls", value: "absent" },
      ]),
    },
  ] satisfies AuditRegionPlaceholder[]),
});

function formatStatus(status: AuditRegionPlaceholder["status"]) {
  return status.replaceAll("_", " ");
}

function statusClass(status: AuditRegionPlaceholder["status"]) {
  switch (status) {
    case "placeholder":
      return "border-cyan-100/20 bg-cyan-300/[0.055] text-cyan-100/80";
    case "withheld":
      return "border-amber-100/20 bg-amber-300/[0.055] text-amber-100/80";
    case "not_connected":
      return "border-slate-100/15 bg-slate-300/[0.045] text-slate-200/70";
  }
}

export interface AuditShellProps {
  model?: AuditShellModel;
}

export function AuditShell({ model = AUDIT_SHELL_MODEL }: AuditShellProps) {
  return (
    <section
      aria-label="JARVIS Audit forensics shell"
      data-audit-shell="read-only"
      data-local-only={String(model.localOnly)}
      data-metadata-only={String(model.metadataOnly)}
      data-authority={model.authority}
      className="grid gap-6"
    >
      <header className="relative overflow-hidden border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.36)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(125,211,252,0.11),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/70">
              Command Center Forensics
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
              {model.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/75">
              {model.subtitle}
            </p>
          </div>
          <dl
            aria-label="Audit shell metadata"
            className="grid grid-cols-1 gap-2 text-left text-xs sm:grid-cols-3 lg:min-w-[30rem]"
          >
            <div className="border border-cyan-100/15 bg-cyan-300/[0.045] px-3 py-2">
              <dt className="uppercase tracking-[0.18em] text-slate-500">
                Posture
              </dt>
              <dd className="mt-1 text-slate-100">inspection only</dd>
            </div>
            <div className="border border-emerald-100/15 bg-emerald-300/[0.04] px-3 py-2">
              <dt className="uppercase tracking-[0.18em] text-slate-500">
                Data
              </dt>
              <dd className="mt-1 text-slate-100">metadata only</dd>
            </div>
            <div className="border border-slate-100/15 bg-slate-300/[0.035] px-3 py-2">
              <dt className="uppercase tracking-[0.18em] text-slate-500">
                Authority
              </dt>
              <dd className="mt-1 text-slate-100">none</dd>
            </div>
          </dl>
        </div>
      </header>

      <div
        aria-label="Audit placeholder regions"
        className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {model.regions.map((region) => (
          <article
            key={region.region_id}
            aria-label={region.title}
            data-audit-region-id={region.region_id}
            data-region-status={region.status}
            data-posture={region.posture}
            data-metadata-only={String(
              region.dataClassification === "metadata_only",
            )}
            data-authority={region.authority}
            className="relative min-h-56 overflow-hidden border border-white/10 bg-slate-950/62 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.3)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent"
            />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                  {region.eyebrow}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  {region.title}
                </h2>
              </div>
              <span
                className={`border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] ${statusClass(
                  region.status,
                )}`}
              >
                {formatStatus(region.status)}
              </span>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300/72">
              {region.description}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {region.rows.map((row) => (
                <div
                  key={row.label}
                  className="border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <dt className="uppercase tracking-[0.16em] text-slate-500">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-slate-200">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-500">
              Static forensics placeholder
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
