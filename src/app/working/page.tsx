import { WorkingCockpit } from "@/components/working/WorkingCockpit";
import {
  SYNTHETIC_OBSERVABILITY_MARKER,
  syntheticWorkingPanels,
} from "@/lib/observability/synthetic-data";

export default function WorkingPage() {
  return (
    <main
      aria-label="JARVIS Working cockpit"
      data-working-layout="read-only-cockpit"
      data-working-layout-style="mission-control"
      className="min-h-screen overflow-hidden bg-void px-6 py-8 text-ink sm:px-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:72px_72px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-theme-glow),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(20,184,166,0.08),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,4,10,0.98)_72%)]"
      />

      <div className="relative w-full min-h-[calc(100vh-4rem)]">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-signal">
          {SYNTHETIC_OBSERVABILITY_MARKER}
        </p>
        <WorkingCockpit projectionPanels={syntheticWorkingPanels()} />
      </div>
    </main>
  );
}
