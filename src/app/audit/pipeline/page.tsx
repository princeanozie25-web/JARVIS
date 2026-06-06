import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";

export default function PipelineVisualizationPage() {
  return (
    <main
      aria-label="JARVIS governed pipeline visualization"
      data-audit-surface="pipeline"
      data-pipeline-surface-style="mission-control"
      data-command-center-shell="pipeline"
      className="cc-shell min-h-screen overflow-hidden bg-void px-6 py-6 text-ink sm:px-10"
    >
      <a className="jarvis-skip-link" href="#pipeline-diagram">
        Skip to pipeline diagram
      </a>
      <div className="cc-atmosphere" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-theme-glow),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,4,10,0.98)_72%)]"
      />
      <header className="cc-shell-header relative z-10 mx-auto grid max-w-[1720px] grid-cols-[220px_minmax(0,1fr)_220px] items-center gap-4 border border-cyan-100/12 px-4 py-3">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-cyan-200/62">
            Jarvis
          </p>
          <h1 className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-white">
            Pipeline
          </h1>
        </div>
        <CommandCenterNav active="pipeline" compact />
        <div className="border border-cyan-100/12 bg-cyan-300/[0.04] px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em]">
          <p className="text-slate-500">Authority</p>
          <p className="text-cyan-100">read only</p>
        </div>
      </header>
      <div
        id="pipeline-diagram"
        className="relative z-10 mx-auto mt-6 w-full max-w-[1720px]"
      >
        <PipelineDiagram />
      </div>
    </main>
  );
}
