export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#02040a] px-6 py-8 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(56,189,248,0.16),transparent_30%),radial-gradient(circle_at_78%_28%,rgba(168,85,247,0.12),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.2),#02040a_76%)]"
      />
      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl content-center gap-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-200/70">
            JARVIS Command Center
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Living system surfaces
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Read-only architecture, governance, and system-map views. No
            execution controls are exposed from this entry point.
          </p>
        </div>
        <nav
          aria-label="Primary JARVIS surfaces"
          className="flex flex-wrap gap-3"
        >
          <a
            href="/audit/gauntlet"
            data-root-gauntlet-nav-link="living-system-map"
            className="border border-cyan-100/20 bg-cyan-300/[0.06] px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan-100"
          >
            Open Living System Map
          </a>
          <a
            href="/audit"
            className="border border-white/10 bg-white/[0.035] px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-slate-300"
          >
            Open Audit Surfaces
          </a>
          <a
            href="/rest"
            className="border border-white/10 bg-white/[0.035] px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-slate-300"
          >
            Open Rest Mode
          </a>
        </nav>
      </section>
    </main>
  );
}
