import type { Metadata } from "next";

import { Core } from "@/components/core";
import { CommandCenterShell } from "@/components/shell";
import { buildPresenceRail } from "@/lib/shell";

import { loadCorePresence } from "./core-presence";

// Program U.3/U.4 (E-030/E-031) — the Command Center, additive at /cc while
// the Phase 21 shell at / stays frozen. Server component; ONE read (pending
// approvals count) + the static agent registry; no write path, no server
// actions (I-U-1). The shell wraps the Core; the Core stays the truth layer.

export const metadata: Metadata = {
  title: "JARVIS — Core",
  description:
    "The Human Gate at the centre. Amber only when a real proposal waits.",
};

export default function CommandCenterCorePage() {
  const presence = loadCorePresence();
  const agents = buildPresenceRail();
  return (
    <main aria-label="JARVIS command center" data-surface="command-center">
      <CommandCenterShell presence={presence} agents={agents}>
        <Core presence={presence} />
      </CommandCenterShell>
    </main>
  );
}
