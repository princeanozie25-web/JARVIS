import { Orb } from "@/components/orb/Orb";
import { IDLE_ORB_STATE } from "@/components/orb/state-tokens";

export default function RestPage() {
  return (
    <main
      data-rest-layout="command-center-showpiece"
      className="min-h-screen overflow-hidden bg-[#02040a] px-6 py-8 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:72px_72px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(20,184,166,0.16),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,4,10,0.96)_72%)]"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-5 text-xs uppercase tracking-[0.22em] text-slate-400">
          <span>JARVIS</span>
          <span>Local shell</span>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <Orb state={IDLE_ORB_STATE} />
        </section>

        <footer className="grid gap-3 border-t border-white/10 pt-5 text-xs text-slate-400 sm:grid-cols-3">
          <span>Metadata-only visual layer</span>
          <span className="sm:text-center">No live telemetry binding</span>
          <span className="sm:text-right">No execution authority</span>
        </footer>
      </div>
    </main>
  );
}
