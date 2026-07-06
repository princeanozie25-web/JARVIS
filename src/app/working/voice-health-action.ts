"use server";

// E-020 — the transport for the voice-pill health READ: a Next server
// action (the minimal server-transport pattern E-019 established). It
// returns a serializable, read-only health view and nothing else — no
// synthesis, no mutation, no authority. The cockpit calls it after mount to
// upgrade the pill from the synthetic default to the real probed picture.

import type { CockpitVoiceView } from "@/components/working/voice-view";

import { loadCockpitVoiceView } from "./voice-health";

export async function readVoiceHealthAction(): Promise<CockpitVoiceView> {
  return loadCockpitVoiceView();
}
