import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Orb } from "../../src/components/orb/Orb";
import {
  IDLE_ORB_STATE,
  restOrbTokensToViewModel,
} from "../../src/components/orb/state-tokens";
import type { OrbVisualState } from "../../src/components/orb/types";

const ORB_LIVE_SOURCE_FILES = [
  "src/components/orb/Orb.tsx",
  "src/components/orb/types.ts",
] as const;

function sourceText() {
  return ORB_LIVE_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

describe("Phase 12E.3 Rest orb live wiring", () => {
  it("keeps the default Orb render on deterministic idle state", () => {
    const first = renderToStaticMarkup(<Orb />);
    const second = renderToStaticMarkup(<Orb state={IDLE_ORB_STATE} />);

    expect(first).toBe(second);
    expect(first).toContain('data-orb-mode="idle"');
    expect(first).toContain('data-load-band="idle"');
    expect(first).toContain('data-governance-posture="all_green"');
    expect(first).toContain('data-authority="none"');
    expect(first).toContain('data-withheld="false"');
    expect(first).toContain("Rest Mode");
  });

  it("renders explicitly supplied projection-backed token metadata", () => {
    const html = renderToStaticMarkup(
      <Orb
        projectionTokens={{
          mode: "working",
          load_band: "active",
          last_event_class: "routine_completed",
          governance_posture: "all_green",
          heartbeat: "stable",
        }}
      />,
    );

    expect(html).toContain('data-orb-mode="working"');
    expect(html).toContain('data-load-band="active"');
    expect(html).toContain('data-governance-posture="all_green"');
    expect(html).toContain('data-heartbeat="stable"');
    expect(html).toContain("JARVIS Room OS - Working Signal");
    expect(html).toContain("Routine completed.");
  });

  it("renders explicitly supplied projection-backed view model metadata", () => {
    const state = restOrbTokensToViewModel({
      mode: "audit",
      load_band: "light",
      last_event_class: "approval_pending",
      governance_posture: "gated_active",
      heartbeat: "delayed",
    });
    const html = renderToStaticMarkup(<Orb projectionState={state} />);

    expect(html).toContain('data-orb-mode="audit"');
    expect(html).toContain('data-load-band="light"');
    expect(html).toContain('data-governance-posture="gated_active"');
    expect(html).toContain("JARVIS Room OS - Audit Signal");
    expect(html).toContain("Approval pending at the governance boundary.");
  });

  it("fails unsafe or withheld projection metadata closed visually", () => {
    const unsafeState: OrbVisualState = {
      ...IDLE_ORB_STATE,
      label: "sk-secret-label",
      statusText: "prompt leaked",
      detailText: "hidden-token",
      withheld: true,
    };
    const html = renderToStaticMarkup(<Orb projectionState={unsafeState} />);

    expect(html).toContain('data-orb-mode="degraded"');
    expect(html).toContain('data-governance-posture="gated_active"');
    expect(html).toContain('data-heartbeat="unavailable"');
    expect(html).toContain('data-withheld="true"');
    expect(html).toContain("State withheld until signals are safe.");
    expect(html).not.toContain("sk-secret-label");
    expect(html).not.toContain("hidden-token");
  });

  it("keeps kill switch metadata visual-only and non-authoritative", () => {
    const html = renderToStaticMarkup(
      <Orb
        projectionTokens={{
          mode: "kill_switch",
          load_band: "idle",
          last_event_class: "error",
          governance_posture: "kill_switch_on",
          heartbeat: "unavailable",
        }}
      />,
    );

    expect(html).toContain('data-orb-mode="kill_switch"');
    expect(html).toContain('data-governance-posture="kill_switch_on"');
    expect(html).toContain('data-authority="none"');
    expect(html).toContain("JARVIS Room OS - Kill Switch Signal");
    expect(html).toContain("Authority remains unavailable.");
  });

  it("renders no buttons, forms, action links, or authority affordances", () => {
    const html = renderToStaticMarkup(
      <Orb
        projectionTokens={{
          mode: "working",
          load_band: "active",
          last_event_class: "approval_pending",
          governance_posture: "gated_active",
          heartbeat: "stable",
        }}
      />,
    );

    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(/\b(approve|run|retry|execute)\b/i);
  });

  it("does not add fetch, IPC, store, provider, room execution, capture, or action imports", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|createObservabilityApi|queryOrbStateMetadata/i,
    );
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db/i,
    );
    expect(sourceText()).not.toMatch(
      /provider runtime|model runtime|openai|anthropic|ollama|room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
    expect(sourceText()).not.toMatch(
      /getUserMedia|getDisplayMedia|mediaDevices|AudioContext|microphone|camera|screen capture|global-hotkey|onClick|onSubmit/i,
    );
  });
});
