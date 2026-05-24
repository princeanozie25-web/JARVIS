import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RestPage from "../../src/app/rest/page";
import { Orb } from "../../src/components/orb/Orb";
import {
  IDLE_ORB_STATE,
  restOrbTokensToViewModel,
} from "../../src/components/orb/state-tokens";

const ORB_SOURCE_FILES = [
  "src/app/rest/page.tsx",
  "app/rest/page.tsx",
  "src/components/orb/Orb.tsx",
  "src/components/orb/types.ts",
  "src/components/orb/state-tokens.ts",
] as const;

function renderRestPage() {
  return renderToStaticMarkup(<RestPage />);
}

function sourceText() {
  return ORB_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("Phase 12A.2 Rest orb skeleton", () => {
  it("/rest page renders the polished local Rest Mode layout", () => {
    const html = renderRestPage();

    expect(html).toContain('data-rest-layout="command-center-showpiece"');
    expect(html).toContain("Command Center Foundation");
    expect(html).toContain("JARVIS Room OS — Rest Mode");
    expect(html).toContain("Idle. Local shell only.");
    expect(html).toContain("Metadata-only visual layer");
    expect(html).toContain("No live telemetry binding");
    expect(html).toContain("No execution authority");
    expect(html).toContain('data-orb-mode="idle"');
    expect(html).toContain('data-load-band="idle"');
    expect(html).toContain('data-governance-posture="all_green"');
    expect(html).toContain('data-heartbeat="stable"');
    expect(html).toContain('data-local-only="true"');
    expect(html).toContain('data-authority="none"');
    expect(html).toContain('data-metadata-only="true"');
  });

  it("orb component renders the deterministic idle state", () => {
    const first = renderToStaticMarkup(<Orb />);
    const second = renderToStaticMarkup(<Orb state={IDLE_ORB_STATE} />);

    expect(first).toBe(second);
    expect(first).toContain('aria-label="JARVIS Room OS — Rest Mode"');
    expect(IDLE_ORB_STATE).toEqual({
      mode: "idle",
      label: "JARVIS Room OS — Rest Mode",
      statusText: "Idle. Local shell only.",
      detailText:
        "Load idle. No recent event. Governance all_green. Heartbeat stable.",
      loadBand: "idle",
      lastEventClass: "none",
      governancePosture: "all_green",
      heartbeat: "stable",
      tone: "quiet",
      metadataOnly: true,
      rawPayloadIncluded: false,
      localOnly: true,
      authority: "none",
      withheld: false,
    });
  });

  it("renders metadata labels from the state-token view model", () => {
    const html = renderRestPage();

    expect(html).toContain('aria-label="Rest orb metadata"');
    expect(html).toContain("<dt");
    expect(html).toContain("Mode");
    expect(html).toContain("Load");
    expect(html).toContain("Governance");
    expect(html).toContain("Heartbeat");
    expect(html).toContain("Event");
    expect(html).toContain("all green");
    expect(html).toContain("stable");
  });

  it("orb renders each supported mode without controls", () => {
    const modes = [
      restOrbTokensToViewModel({
        mode: "idle",
        load_band: "idle",
        last_event_class: "none",
        governance_posture: "all_green",
        heartbeat: "stable",
      }),
      restOrbTokensToViewModel({
        mode: "working",
        load_band: "active",
        last_event_class: "routine_completed",
        governance_posture: "all_green",
        heartbeat: "stable",
      }),
      restOrbTokensToViewModel({
        mode: "audit",
        load_band: "light",
        last_event_class: "approval_pending",
        governance_posture: "gated_active",
        heartbeat: "delayed",
      }),
      restOrbTokensToViewModel({
        mode: "degraded",
        load_band: "idle",
        last_event_class: "vision_degraded",
        governance_posture: "gated_active",
        heartbeat: "delayed",
      }),
      restOrbTokensToViewModel({
        mode: "kill_switch",
        load_band: "idle",
        last_event_class: "error",
        governance_posture: "kill_switch_on",
        heartbeat: "unavailable",
      }),
    ];

    for (const state of modes) {
      const html = renderToStaticMarkup(<Orb state={state} />);

      expect(html).toContain(`data-orb-mode="${state.mode}"`);
      expect(html).not.toMatch(/<button\b/i);
      expect(html).not.toMatch(/\brole="button"/i);
      expect(html).not.toMatch(/\b(run|retry|approve|execute)\b/i);
    }
  });

  it("renders no buttons, form controls, or authority affordances", () => {
    const html = renderRestPage();

    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(/\b(run|retry|approve|execute)\b/i);
  });

  it("does not reference capture, room, provider, persistence, network, or Tauri IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /getUserMedia|getDisplayMedia|mediaDevices|AudioContext|navigator\.mediaDevices|camera|microphone|screen capture|global-hotkey|globalShortcut/i,
    );
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|invoke\(|@tauri-apps|tauri::command/i,
    );
    expect(sourceText()).not.toMatch(
      /room\/|store\/|event-store|better-sqlite3|provider|openai|anthropic|ollama|hue|adapter/i,
    );
  });

  it("does not touch global fetch during render", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderRestPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
