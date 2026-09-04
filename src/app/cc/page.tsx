import type { Metadata } from "next";

import { Core } from "@/components/core";

import { loadCorePresence } from "./core-presence";

// Program U.3 (E-030) — the Command Center's home, additive at /cc while the
// Phase 21 shell at / stays frozen. Server component; ONE read (pending
// approvals count); no write path, no server actions (I-U-1).

export const metadata: Metadata = {
  title: "JARVIS — Core",
  description:
    "The Human Gate at the centre. Amber only when a real proposal waits.",
};

export default function CommandCenterCorePage() {
  const presence = loadCorePresence();
  return (
    <main
      aria-label="JARVIS command center core"
      data-surface="command-center-core"
    >
      <Core presence={presence} />
    </main>
  );
}
