import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";

export default function PipelineVisualizationPage() {
  return (
    <main
      aria-label="JARVIS governed pipeline visualization"
      data-audit-surface="pipeline"
      data-pipeline-surface-style="mission-control"
      className="min-h-screen overflow-hidden bg-void px-6 py-10 text-ink sm:px-10"
    >
      <a className="jarvis-skip-link" href="#pipeline-diagram">
        Skip to pipeline diagram
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-theme-glow),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,4,10,0.98)_72%)]"
      />
      <div id="pipeline-diagram" className="relative w-full">
        <PipelineDiagram />
      </div>
    </main>
  );
}
