import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AUDIT_DISABLED_AFFORDANCES,
  AUDIT_PANEL_IDS,
  getAuditPanel,
  listAuditPanels,
} from "../../src/components/audit/panel-registry";

const REGISTRY_SOURCE_FILES = [
  "src/components/audit/panel-registry.ts",
  "src/components/audit/types.ts",
] as const;

function sourceText() {
  return REGISTRY_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

describe("Phase 12C.2 Audit panel registry", () => {
  it("includes all required audit panels in deterministic order", () => {
    expect(AUDIT_PANEL_IDS).toEqual([
      "replay_timeline",
      "trace_viewer",
      "governance_boundary",
      "runtime_dependency",
      "redaction_status",
      "disabled_feature_matrix",
    ]);
    expect(listAuditPanels().map((panel) => panel.panel_id)).toEqual(
      AUDIT_PANEL_IDS,
    );
  });

  it("marks every panel metadata-only and read-only", () => {
    for (const panel of listAuditPanels()) {
      expect(panel).toMatchObject({
        source_phase: "12C.2",
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
      listAuditPanels().every(
        (panel) => panel.refresh_policy === "static_placeholder",
      ),
    ).toBe(true);
  });

  it("declares all disabled affordances on every panel without rendering actions", () => {
    expect(AUDIT_DISABLED_AFFORDANCES).toEqual([
      "run",
      "retry",
      "approve",
      "execute",
      "mutate",
      "schedule",
      "replay_execute",
      "graph_execute",
    ]);
    for (const panel of listAuditPanels()) {
      expect(panel.disabled_affordances).toEqual(AUDIT_DISABLED_AFFORDANCES);
    }
  });

  it("returns deterministic placeholder rows and defensive registry snapshots", () => {
    const first = listAuditPanels();
    const second = listAuditPanels();
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
    expect(getAuditPanel("not_registered")).toMatchObject({
      title: "Unknown audit panel",
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
