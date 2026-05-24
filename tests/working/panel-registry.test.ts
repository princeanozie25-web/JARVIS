import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  WORKING_DISABLED_AFFORDANCES,
  WORKING_PANEL_IDS,
  getWorkingPanel,
  listWorkingPanels,
} from "../../src/components/working/panel-registry";

const REGISTRY_SOURCE_FILES = [
  "src/components/working/panel-registry.ts",
  "src/components/working/types.ts",
] as const;

function sourceText() {
  return REGISTRY_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

describe("Phase 12B.2 Working panel registry", () => {
  it("includes all required panels in deterministic order", () => {
    expect(WORKING_PANEL_IDS).toEqual([
      "system_status",
      "room_state",
      "recent_activity",
      "model_router",
      "suggestions_inbox",
      "cost_usage",
      "safety_governance",
    ]);
    expect(listWorkingPanels().map((panel) => panel.panel_id)).toEqual(
      WORKING_PANEL_IDS,
    );
  });

  it("marks every panel metadata-only and read-only", () => {
    for (const panel of listWorkingPanels()) {
      expect(panel).toMatchObject({
        source_phase: "12B.2",
        data_classification: "metadata_only",
        authority: "read_only",
        metadataOnly: true,
        localOnly: true,
        shellAuthority: "none",
      });
    }
  });

  it("uses static placeholder refresh policy for every panel", () => {
    expect(
      listWorkingPanels().every(
        (panel) => panel.refresh_policy === "static_placeholder",
      ),
    ).toBe(true);
  });

  it("declares all disabled affordances on every panel without rendering actions", () => {
    expect(WORKING_DISABLED_AFFORDANCES).toEqual([
      "run",
      "retry",
      "approve",
      "execute",
      "mutate",
      "schedule",
    ]);
    for (const panel of listWorkingPanels()) {
      expect(panel.disabled_affordances).toEqual(WORKING_DISABLED_AFFORDANCES);
    }
  });

  it("returns deterministic placeholder rows and defensive registry snapshots", () => {
    const first = listWorkingPanels();
    const second = listWorkingPanels();
    const firstPanel = first[0];

    expect(first).toEqual(second);
    expect(firstPanel?.placeholder_rows.length).toBeGreaterThan(0);
    expect(firstPanel?.placeholder_rows[0]).toMatchObject({
      label: expect.any(String),
      value: expect.any(String),
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(firstPanel?.placeholder_rows)).toBe(true);
  });

  it("fails closed for unknown panel id", () => {
    expect(getWorkingPanel("not_registered")).toMatchObject({
      title: "Unknown panel",
      status: "withheld",
      data_classification: "metadata_only",
      authority: "read_only",
      refresh_policy: "static_placeholder",
      shellAuthority: "none",
      withheld: true,
    });
  });

  it("does not import network, provider, persistence, room execution, or Tauri IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider|openai|anthropic|ollama|model runtime/i,
    );
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
  });
});
