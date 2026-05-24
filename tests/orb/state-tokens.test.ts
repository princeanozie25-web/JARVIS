import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_REST_ORB_TOKENS,
  restOrbTokensToViewModel,
} from "../../src/components/orb/state-tokens";
import type { RestOrbStateTokens } from "../../src/components/orb/types";

const TOKEN_SOURCE_FILES = [
  "src/components/orb/state-tokens.ts",
  "src/components/orb/types.ts",
] as const;

function sourceText() {
  return TOKEN_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

describe("Phase 12A.3 Rest orb state tokens", () => {
  it("maps valid token sets deterministically to metadata-only view models", () => {
    const tokens: RestOrbStateTokens = {
      mode: "working",
      load_band: "active",
      last_event_class: "routine_completed",
      governance_posture: "all_green",
      heartbeat: "stable",
    };

    expect(restOrbTokensToViewModel(tokens)).toEqual(
      restOrbTokensToViewModel({ ...tokens }),
    );
    expect(restOrbTokensToViewModel(tokens)).toMatchObject({
      mode: "working",
      loadBand: "active",
      lastEventClass: "routine_completed",
      governancePosture: "all_green",
      heartbeat: "stable",
      label: "JARVIS Room OS - Working Signal",
      metadataOnly: true,
      rawPayloadIncluded: false,
      localOnly: true,
      authority: "none",
      withheld: false,
    });
  });

  it("keeps the default Rest state idle and read-only", () => {
    expect(restOrbTokensToViewModel(DEFAULT_REST_ORB_TOKENS)).toMatchObject({
      mode: "idle",
      loadBand: "idle",
      lastEventClass: "none",
      governancePosture: "all_green",
      heartbeat: "stable",
      label: "JARVIS Room OS — Rest Mode",
      authority: "none",
      withheld: false,
    });
  });

  it("fails closed for unknown or unsafe token combinations", () => {
    const unsafeIdle = restOrbTokensToViewModel({
      mode: "idle",
      load_band: "busy",
      last_event_class: "none",
      governance_posture: "all_green",
      heartbeat: "stable",
    });
    const unknownMode = restOrbTokensToViewModel({
      mode: "streaming" as RestOrbStateTokens["mode"],
      load_band: "idle",
      last_event_class: "none",
      governance_posture: "all_green",
      heartbeat: "stable",
    });

    expect(unsafeIdle).toMatchObject({
      mode: "degraded",
      lastEventClass: "error",
      governancePosture: "gated_active",
      heartbeat: "unavailable",
      withheld: true,
      metadataOnly: true,
      rawPayloadIncluded: false,
      authority: "none",
    });
    expect(unknownMode).toEqual(unsafeIdle);
  });

  it("maps kill switch mode to a non-authoritative visual state only", () => {
    expect(
      restOrbTokensToViewModel({
        mode: "kill_switch",
        load_band: "idle",
        last_event_class: "error",
        governance_posture: "kill_switch_on",
        heartbeat: "unavailable",
      }),
    ).toMatchObject({
      mode: "kill_switch",
      label: "JARVIS Room OS - Kill Switch Signal",
      statusText: "Authority remains unavailable.",
      authority: "none",
      metadataOnly: true,
      rawPayloadIncluded: false,
      withheld: false,
    });
  });

  it("fails closed when kill switch posture and mode disagree", () => {
    expect(
      restOrbTokensToViewModel({
        mode: "working",
        load_band: "active",
        last_event_class: "error",
        governance_posture: "kill_switch_on",
        heartbeat: "unavailable",
      }),
    ).toMatchObject({
      mode: "degraded",
      withheld: true,
      authority: "none",
    });
  });

  it("keeps approval pending visual-only without creating an affordance", () => {
    const model = restOrbTokensToViewModel({
      mode: "audit",
      load_band: "light",
      last_event_class: "approval_pending",
      governance_posture: "gated_active",
      heartbeat: "delayed",
    });

    expect(model).toMatchObject({
      mode: "audit",
      lastEventClass: "approval_pending",
      authority: "none",
      metadataOnly: true,
    });
    expect(
      `${model.label} ${model.statusText} ${model.detailText}`,
    ).not.toMatch(/\b(approve|execute|retry|run)\b/i);
  });

  it("keeps error and degraded states metadata-only without raw payload fields", () => {
    const degraded = restOrbTokensToViewModel({
      mode: "degraded",
      load_band: "idle",
      last_event_class: "error",
      governance_posture: "gated_active",
      heartbeat: "unavailable",
    });

    expect(JSON.stringify(degraded)).not.toMatch(
      /raw_payload|prompt|output|frame|transcript|secret|token/i,
    );
    expect(degraded).toMatchObject({
      metadataOnly: true,
      rawPayloadIncluded: false,
      authority: "none",
    });
  });

  it("does not import live telemetry, network, provider, persistence, room, or Tauri IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|invoke\(|@tauri-apps|tauri::command/i,
    );
    expect(sourceText()).not.toMatch(
      /observability|telemetry|store\/|event-store|better-sqlite3|provider|openai|anthropic|ollama|hue|adapter|room\//i,
    );
  });
});
