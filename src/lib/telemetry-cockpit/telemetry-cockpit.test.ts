import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as telemetryCockpit from "./index";
import {
  TELEMETRY_COCKPIT_METRIC_KINDS,
  TELEMETRY_COCKPIT_PANEL_KINDS,
  TelemetryCockpitProjectionSchema,
  buildTelemetryCockpitProjection,
  buildTelemetryCockpitStats,
  listTelemetryCockpitPanels,
  listTelemetryCockpitWarnings,
  validateTelemetryCockpitProjectionSafety,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "createApproval",
  "grantAuthority",
  "callTool",
] as const;

const FORBIDDEN_KEYS = [
  "prompt",
  "raw_prompt",
  "model_output",
  "raw_model_output",
  "tool_args",
  "tool_arguments",
  "raw_tool_arguments",
  "ocr_text",
  "raw_ocr_text",
  "screenshot",
  "raw_screenshot",
  "frame",
  "frames",
  "raw_frame",
  "audio",
  "raw_audio",
  "secret",
  "secrets",
  "api_key",
  "approval_token",
  "raw_approval_token",
  "executable_payload",
  "command",
  "script",
] as const;

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }
  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 19B.1 telemetry cockpit contracts and projections", () => {
  it("builds and validates a metadata-only telemetry cockpit projection", () => {
    const projection = buildTelemetryCockpitProjection();

    expect(TelemetryCockpitProjectionSchema.safeParse(projection).success).toBe(
      true,
    );
    expect(projection).toMatchObject({
      projection_id: "telemetry-cockpit:phase-19b1-projection",
      contract_version: "19B.1",
      generated_from: "deterministic_existing_projection_metadata",
      metadata_only: true,
      read_only: true,
      render_safe: true,
      deterministic: true,
      redaction_safe: true,
      payload_classes_exposed: [],
      disabled_capability_flags: {
        execution_enabled: false,
        retry_enabled: false,
        approval_enabled: false,
        mutation_enabled: false,
        dispatch_enabled: false,
        authority_surface_enabled: false,
        telemetry_ingestion_enabled: false,
        polling_enabled: false,
        websocket_enabled: false,
        runtime_observer_enabled: false,
        filesystem_read_enabled: false,
        database_read_enabled: false,
        network_call_enabled: false,
      },
    });
  });

  it("declares the expected telemetry cockpit panels in deterministic order", () => {
    expect(listTelemetryCockpitPanels().map((panel) => panel.kind)).toEqual([
      "model_runtime",
      "router",
      "costs",
      "approval_runtime",
      "scheduler",
      "vision_runtime",
      "voice_runtime",
      "room_runtime",
      "event_store",
      "architecture_graph",
      "safety_governance",
    ]);
    expect(listTelemetryCockpitPanels().map((panel) => panel.kind)).toEqual([
      ...TELEMETRY_COCKPIT_PANEL_KINDS,
    ]);
  });

  it("declares all required metric kinds across the projection", () => {
    const metricKinds = new Set(
      buildTelemetryCockpitProjection().panels.flatMap((panel) =>
        panel.metrics.map((metric) => metric.kind),
      ),
    );

    for (const kind of TELEMETRY_COCKPIT_METRIC_KINDS) {
      expect(metricKinds.has(kind)).toBe(true);
    }
  });

  it("provides stable stats, alerts, and warnings", () => {
    expect(buildTelemetryCockpitStats()).toEqual({
      panel_count: 11,
      metric_count: 40,
      alert_count: 1,
      warning_count: 2,
      healthy_panel_count: 0,
      degraded_panel_count: 0,
      blocked_panel_count: 0,
      metadata_source_count: 11,
      metadata_only: true,
      read_only: true,
    });
    expect(
      listTelemetryCockpitWarnings().map((item) => item.warning_id),
    ).toEqual([
      "telemetry-warning:global:projection-only",
      "telemetry-warning:event_store:no-direct-store-read",
    ]);
  });

  it("projection output is deterministic", () => {
    expect(JSON.stringify(buildTelemetryCockpitProjection())).toBe(
      JSON.stringify(buildTelemetryCockpitProjection()),
    );
    expect(JSON.stringify(listTelemetryCockpitPanels())).toBe(
      JSON.stringify(listTelemetryCockpitPanels()),
    );
  });

  it("projection output is defensive-copy-safe", () => {
    const projection = buildTelemetryCockpitProjection();
    projection.panels[0].title = "Mutated Telemetry Panel";
    projection.panels[0].metrics[0].label = "Mutated Metric";
    projection.warnings[0].label = "Mutated Warning";

    const freshProjection = buildTelemetryCockpitProjection();
    expect(freshProjection.panels[0]).toMatchObject({
      kind: "model_runtime",
      title: "Model Runtime",
    });
    expect(freshProjection.panels[0].metrics[0]).toMatchObject({
      label: "Activity count band",
    });
    expect(freshProjection.warnings[0]).toMatchObject({
      label: "Phase 19B.1 uses deterministic projection metadata only",
    });
  });

  it("validates metadata-only and redaction-safe guarantees", () => {
    const projection = buildTelemetryCockpitProjection();
    const keys = collectKeys(projection);

    for (const key of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(validateTelemetryCockpitProjectionSafety(projection)).toMatchObject({
      passed: true,
      reasons: ["telemetry_cockpit_projection_safe"],
      violation_paths: [],
      metadata_only: true,
      read_only: true,
      raw_value_included: false,
    });
  });

  it("rejects raw or executable-looking injected fields", () => {
    const unsafe = {
      ...buildTelemetryCockpitProjection(),
      raw_prompt: "show private context",
    };
    const unsafeSecret = {
      ...buildTelemetryCockpitProjection(),
      panels: [
        ...buildTelemetryCockpitProjection().panels,
        {
          api_key: "api_key=sk-thisshouldneverleak",
        },
      ],
    };
    const unsafeAction = {
      ...buildTelemetryCockpitProjection(),
      execute: "rm -rf workspace",
    };

    expect(validateTelemetryCockpitProjectionSafety(unsafe)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["forbidden_field_name"]),
      raw_value_included: false,
    });
    expect(
      validateTelemetryCockpitProjectionSafety(unsafeSecret),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["forbidden_field_name"]),
      raw_value_included: false,
    });
    expect(
      validateTelemetryCockpitProjectionSafety(unsafeAction),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["forbidden_affordance_name"]),
      raw_value_included: false,
    });
  });

  it("exports no execution, approval, retry, mutation, dispatch, or tool-call affordances", () => {
    const exportedFunctionNames = Object.entries(telemetryCockpit)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });

  it("introduces no filesystem, database, telemetry ingestion, polling, streaming, or observer wiring", () => {
    const source = readFileSync(
      "src/lib/telemetry-cockpit/contracts.ts",
      "utf8",
    );

    expect(source).not.toMatch(
      /readFile|writeFile|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|db\.|telemetry table/i,
    );
    expect(source).not.toMatch(
      /setInterval\(|setTimeout\(|new WebSocket|WebSocket\(|new EventSource|EventSource\(|ReadableStream\(|createObserver|runtimeObserver|createCollector|ingestTelemetry/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|method:\s*["'](POST|PUT|PATCH|DELETE)["']|executeCommand|commandRoom/i,
    );
  });
});
