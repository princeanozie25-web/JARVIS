import { AuditShell } from "@/components/audit/AuditShell";
import {
  SYNTHETIC_OBSERVABILITY_MARKER,
  syntheticAuditPanels,
} from "@/lib/observability/synthetic-data";

export default function AuditPage() {
  return (
    <main
      data-audit-layout="read-only-forensics"
      className="min-h-screen overflow-hidden bg-[#02040a] px-6 py-8 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:72px_72px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(125,211,252,0.12),transparent_32%),radial-gradient(circle_at_84%_12%,rgba(20,184,166,0.08),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,4,10,0.98)_72%)]"
      />

      <div className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl">
        <p className="mb-4 text-xs uppercase tracking-[0.22em] text-cyan-200/70">
          {SYNTHETIC_OBSERVABILITY_MARKER}
        </p>
        <a
          href="/audit/gauntlet"
          data-audit-gauntlet-nav-link="cinematic-gauntlet"
          className="mb-4 inline-flex border border-cyan-100/15 bg-cyan-300/[0.045] px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100/80"
        >
          Open Living System Map
        </a>
        <AuditShell projectionPanels={syntheticAuditPanels()} />
      </div>
    </main>
  );
}
