import { WorkingShell } from "@/components/working/WorkingShell";

export default function WorkingPage() {
  return (
    <main
      data-working-layout="read-only-cockpit"
      className="min-h-screen overflow-hidden bg-[#02040a] px-6 py-8 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:72px_72px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(20,184,166,0.1),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,4,10,0.98)_72%)]"
      />

      <div className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl">
        <WorkingShell />
      </div>
    </main>
  );
}
