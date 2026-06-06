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
  "src/components/command-center/RestCommandCenter.tsx",
  "src/components/command-center/CommandCenterNav.tsx",
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

    expect(html).toContain('data-command-center-shell="rest-liquid-glass"');
    expect(html).toContain('data-rest-authority="none"');
    expect(html).toContain('data-rest-mutating-affordances="0"');
    expect(html).toContain('data-voice-authorizes-actions="false"');
    expect(html).toContain("rest mode");
    expect(html).toContain("SYSTEM STANDBY");
    expect(html).toContain("Awaiting you");
    expect(html).toContain("TAP ONCE TO ENABLE VOICE");
    expect(html).toContain("NO ACTION AUTHORITY");
    expect(html.match(/data-suggestion-card=/g)).toHaveLength(4);
    expect(html.match(/data-suggestion-executable="false"/g)).toHaveLength(4);
    expect(html).toContain("JOB SCOUT");
    expect(html).toContain("LIFE COACH");
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
    const html = renderToStaticMarkup(<Orb state={IDLE_ORB_STATE} />);

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
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).toContain('data-rest-mutating-affordances="0"');
    expect(html).toContain('data-voice-authorizes-actions="false"');
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
