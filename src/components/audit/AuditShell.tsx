import { AUDIT_SHELL_MODEL } from "./panel-registry";
import type { AuditPanelViewModel, AuditShellModel } from "./types";

export { AUDIT_SHELL_MODEL } from "./panel-registry";

function formatStatus(status: AuditPanelViewModel["status"]) {
  return status.replaceAll("_", " ");
}

function statusClass(status: AuditPanelViewModel["status"]) {
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
  projectionPanels?: readonly AuditPanelViewModel[];
}

export function AuditShell({
  model = AUDIT_SHELL_MODEL,
  projectionPanels,
}: AuditShellProps) {
  const panels = projectionPanels
    ? createProjectionBackedPanels(model.panels, projectionPanels)
    : model.panels;

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
        aria-label="Audit panel registry layout"
        className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {panels.map((panel) => (
          <article
            key={panel.panel_id}
            aria-label={panel.title}
            data-audit-panel-id={panel.panel_id}
            data-panel-status={panel.status}
            data-posture={panel.posture}
            data-metadata-only={String(panel.metadataOnly)}
            data-authority={panel.shellAuthority}
            data-registry-authority={panel.authority}
            data-refresh-policy={panel.refresh_policy}
            className="relative min-h-56 overflow-hidden border border-white/10 bg-slate-950/62 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.3)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent"
            />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                  {panel.eyebrow}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  {panel.title}
                </h2>
              </div>
              <span
                className={`border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] ${statusClass(
                  panel.status,
                )}`}
              >
                {formatStatus(panel.status)}
              </span>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300/72">
              {panel.description}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {panel.placeholder_rows.map((row) => (
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

function createProjectionBackedPanels(
  fallbackPanels: readonly AuditPanelViewModel[],
  suppliedPanels: readonly AuditPanelViewModel[],
): readonly AuditPanelViewModel[] {
  return fallbackPanels.map((fallback) => {
    const supplied = suppliedPanels.find(
      (panel) => panel.panel_id === fallback.panel_id,
    );
    if (!supplied || !isSafeProjectionPanel(supplied)) {
      return withheldPanel(fallback);
    }
    return {
      ...fallback,
      title: supplied.title,
      description: supplied.description,
      status: supplied.status,
      eyebrow: supplied.eyebrow,
      posture: "inspection_only",
      placeholder_rows: supplied.placeholder_rows.map((row) => ({
        label: row.label,
        value: row.value,
      })),
      metadataOnly: true,
      localOnly: true,
      shellAuthority: "none",
      withheld: supplied.withheld,
      projectionBacked: supplied.projectionBacked === true,
    };
  });
}

function isSafeProjectionPanel(panel: AuditPanelViewModel): boolean {
  return (
    panel.data_classification === "metadata_only" &&
    panel.authority === "read_only" &&
    panel.refresh_policy === "static_placeholder" &&
    panel.posture === "inspection_only" &&
    panel.metadataOnly === true &&
    panel.localOnly === true &&
    panel.shellAuthority === "none" &&
    panel.withheld === false &&
    panel.placeholder_rows.length > 0 &&
    isSafeMetadataValue(panel)
  );
}

function withheldPanel(panel: AuditPanelViewModel): AuditPanelViewModel {
  return {
    ...panel,
    status: "withheld",
    withheld: true,
    projectionBacked: false,
    placeholder_rows: [{ label: "State", value: "withheld" }],
  };
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
    if (key === "raw_payload_included" && value === false) return false;
    return true;
  }
  return false;
}

function isSecretText(value: string): boolean {
  return /(api[_-]?key|password|secret|token|sk-)/i.test(value);
}
