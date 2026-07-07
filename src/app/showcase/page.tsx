import type { Metadata } from "next";

import { ShowcaseShell } from "@/components/showcase/ShowcaseShell";
import { buildWorkingCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";
import { buildOperatingMapScene } from "@/lib/showcase/operating-map-scene";

import { loadCockpitWorkflowbox } from "../working/workflowbox-live";
import { loadCockpitVoiceView } from "../working/voice-health";

// THE SHOWCASE — a display-only presentation surface over the REAL governed
// backend. This server component performs READS ONLY: the same projection
// builders the audited cockpit renders (the command-center view-model, the
// E-019 WorkflowBox lane, the E-020 voice health view) are reshaped into a
// scene and handed to the cinematic renderer. There is no write path, no
// approve/deny, no runtime access anywhere on this route (I-SHOW-1) — the
// Human Gate lives in the cockpit; this surface only VISUALIZES its state.

export const metadata: Metadata = {
  title: "JARVIS — Showcase",
  description:
    "The operating map: the governed system rendered live, with the Human Gate at its center.",
};

// (The force-dynamic route-segment config lives in app/showcase/page.tsx —
// the route file — because Next requires it statically there, not re-exported.)

export default async function ShowcasePage() {
  const model = buildWorkingCommandCenterModel();
  const workflowbox = loadCockpitWorkflowbox();
  const voice = await loadCockpitVoiceView();
  const scene = buildOperatingMapScene({ model, workflowbox, voice });

  return <ShowcaseShell scene={scene} />;
}
