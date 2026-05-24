import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuditShell } from "../../src/components/audit/AuditShell";
import {
  AUDIT_DISABLED_AFFORDANCES,
  listAuditPanels,
} from "../../src/components/audit/panel-registry";
import type { AuditPanelViewModel } from "../../src/components/audit/types";
import { Orb } from "../../src/components/orb/Orb";
import {
  IDLE_ORB_STATE,
  restOrbTokensToViewModel,
} from "../../src/components/orb/state-tokens";
import { WorkingShell } from "../../src/components/working/WorkingShell";
import {
  WORKING_DISABLED_AFFORDANCES,
  listWorkingPanels,
} from "../../src/components/working/panel-registry";
import type { WorkingPanelViewModel } from "../../src/components/working/types";

const LIVE_UI_SOURCE_FILES = [
  "src/components/working/WorkingShell.tsx",
  "src/components/audit/AuditShell.tsx",
  "src/components/orb/Orb.tsx",
  "src/components/working/types.ts",
  "src/components/audit/types.ts",
  "src/components/orb/types.ts",
] as const;

function sourceText() {
  return LIVE_UI_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

function workingProjectionPanels(): WorkingPanelViewModel[] {
  return listWorkingPanels().map((panel) => ({
    ...panel,
    status: "placeholder",
    withheld: false,
    projectionBacked: true,
    placeholder_rows:
      panel.panel_id === "room_state"
        ? [{ label: "Room", value: "known" }]
        : [{ label: "Projection", value: panel.panel_id }],
  }));
}

function auditProjectionPanels(): AuditPanelViewModel[] {
  return listAuditPanels().map((panel) => ({
    ...panel,
    status: "placeholder",
    withheld: false,
    projectionBacked: true,
    placeholder_rows:
      panel.panel_id === "replay_timeline"
        ? [{ label: "Traces", value: "3" }]
        : [{ label: "Projection", value: panel.panel_id }],
  }));
}

function assertNoControls(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  expect(html).not.toMatch(/<a\b/i);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(approve|run|retry|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
  );
}

describe("Phase 12E.4 live wiring closeout guards", () => {
  it("defaults WorkingShell, AuditShell, and Orb to static fallback without supplied props", () => {
    const working = renderToStaticMarkup(createElement(WorkingShell));
    const audit = renderToStaticMarkup(createElement(AuditShell));
    const orb = renderToStaticMarkup(createElement(Orb));

    expect(working).toContain("Static placeholder regions only.");
    expect(working).toContain("Room state");
    expect(working).not.toContain("Projection");
    expect(audit).toContain("Static placeholder regions only.");
    expect(audit).toContain("Replay timeline");
    expect(audit).not.toContain("Projection");
    expect(orb).toContain('data-orb-mode="idle"');
    expect(orb).toContain('data-withheld="false"');
    expect(orb).toContain("Rest Mode");
  });

  it("accepts live projection data only through explicit props", () => {
    const defaultWorking = renderToStaticMarkup(createElement(WorkingShell));
    const liveWorking = renderToStaticMarkup(
      createElement(WorkingShell, {
        projectionPanels: workingProjectionPanels(),
      }),
    );
    const defaultAudit = renderToStaticMarkup(createElement(AuditShell));
    const liveAudit = renderToStaticMarkup(
      createElement(AuditShell, { projectionPanels: auditProjectionPanels() }),
    );
    const defaultOrb = renderToStaticMarkup(createElement(Orb));
    const liveOrb = renderToStaticMarkup(
      createElement(Orb, {
        projectionTokens: {
          mode: "working",
          load_band: "active",
          last_event_class: "routine_completed",
          governance_posture: "all_green",
          heartbeat: "stable",
        },
      }),
    );

    expect(defaultWorking).toContain("withheld");
    expect(defaultWorking).not.toContain("known");
    expect(liveWorking).toContain("known");
    expect(defaultAudit).not.toContain("Traces");
    expect(liveAudit).toContain("Traces");
    expect(defaultOrb).toContain('data-orb-mode="idle"');
    expect(liveOrb).toContain('data-orb-mode="working"');
  });

  it("keeps components disconnected from Observability API, DB/store, network, IPC, providers, room execution, capture, and timers", () => {
    const source = sourceText();

    expect(source).not.toMatch(
      /createObservabilityApi|queryRoomState|queryRecentTraces|queryTelemetryRollups|queryOrbStateMetadata/i,
    );
    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|db\./i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|ReadableStream|setInterval|setTimeout|poll/i,
    );
    expect(source).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider runtime|model runtime|openai|anthropic|ollama/i,
    );
    expect(source).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom|getUserMedia|getDisplayMedia|mediaDevices|AudioContext|microphone|camera|screen capture|global-hotkey/i,
    );
  });

  it("renders no buttons, forms, links, execution controls, replay controls, or graph controls", () => {
    const html = [
      renderToStaticMarkup(
        createElement(WorkingShell, {
          projectionPanels: workingProjectionPanels(),
        }),
      ),
      renderToStaticMarkup(
        createElement(AuditShell, {
          projectionPanels: auditProjectionPanels(),
        }),
      ),
      renderToStaticMarkup(
        createElement(Orb, {
          projectionTokens: {
            mode: "working",
            load_band: "active",
            last_event_class: "approval_pending",
            governance_posture: "gated_active",
            heartbeat: "stable",
          },
        }),
      ),
    ].join("\n");

    assertNoControls(html);
    expect(html).not.toMatch(
      /replay execution|start replay|execute replay|graph execution|execute graph|graph-driven execution|dependency action/i,
    );
  });

  it("fails unsafe or withheld projection data closed visually", () => {
    const workingPanels = workingProjectionPanels();
    workingPanels[1] = {
      ...workingPanels[1]!,
      withheld: true,
      status: "withheld",
      placeholder_rows: [{ label: "payload_json", value: "sk-secret" }],
    };
    const auditPanels = auditProjectionPanels();
    auditPanels[0] = {
      ...auditPanels[0]!,
      withheld: true,
      status: "withheld",
      placeholder_rows: [{ label: "payload_json", value: "sk-secret" }],
    };
    const unsafeOrbState = {
      ...IDLE_ORB_STATE,
      label: "sk-secret-label",
      withheld: true,
    };
    const html = [
      renderToStaticMarkup(
        createElement(WorkingShell, { projectionPanels: workingPanels }),
      ),
      renderToStaticMarkup(
        createElement(AuditShell, { projectionPanels: auditPanels }),
      ),
      renderToStaticMarkup(
        createElement(Orb, { projectionState: unsafeOrbState }),
      ),
    ].join("\n");

    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-audit-panel-id="replay_timeline"');
    expect(html).toContain('data-orb-mode="degraded"');
    expect(html).toContain('data-withheld="true"');
    expect(html).not.toContain("sk-secret");
    expect(html).not.toContain("payload_json");
  });

  it("keeps disabled affordances data-only and never rendered as controls", () => {
    const workingPanels = workingProjectionPanels();
    const auditPanels = auditProjectionPanels();
    const html = [
      renderToStaticMarkup(
        createElement(WorkingShell, { projectionPanels: workingPanels }),
      ),
      renderToStaticMarkup(
        createElement(AuditShell, { projectionPanels: auditPanels }),
      ),
      renderToStaticMarkup(
        createElement(Orb, {
          projectionState: restOrbTokensToViewModel({
            mode: "kill_switch",
            load_band: "idle",
            last_event_class: "error",
            governance_posture: "kill_switch_on",
            heartbeat: "unavailable",
          }),
        }),
      ),
    ].join("\n");

    for (const panel of workingPanels) {
      expect(panel.disabled_affordances).toEqual(WORKING_DISABLED_AFFORDANCES);
    }
    for (const panel of auditPanels) {
      expect(panel.disabled_affordances).toEqual(AUDIT_DISABLED_AFFORDANCES);
      expect(panel.disabled_affordances).toEqual(
        expect.arrayContaining(["replay_execute", "graph_execute"]),
      );
    }
    assertNoControls(html);
    expect(html).toContain('data-authority="none"');
    expect(html).toContain('data-orb-mode="kill_switch"');
  });
});
