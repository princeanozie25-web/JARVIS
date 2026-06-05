import { GauntletPipeline } from "@/components/gauntlet/GauntletPipeline";

export default function GauntletPage() {
  return (
    <main
      aria-label="JARVIS Living System Map"
      data-audit-surface="gauntlet"
      data-gauntlet-surface-style="living-system-map"
      className="min-h-screen overflow-hidden bg-void px-6 py-10 text-ink sm:px-10"
    >
      <a className="jarvis-skip-link" href="#gauntlet-pipeline">
        Skip to Living System Map
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_20%,var(--color-theme-glow),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,4,10,0.98)_72%)]"
      />
      <div id="gauntlet-pipeline" className="relative w-full">
        <GauntletPipeline />
      </div>
    </main>
  );
}
