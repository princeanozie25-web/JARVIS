import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as governanceVisualizer from "./index";
import {
  GOVERNANCE_BOUNDARY_EDGE_POLICIES,
  GOVERNANCE_BOUNDARY_GATE_TYPES,
  GOVERNANCE_BOUNDARY_NODE_IDS,
  GOVERNANCE_BOUNDARY_TRUST_CLASSES,
  GovernanceBoundaryProjectionSchema,
  buildGovernanceBoundaryProjection,
  buildGovernanceBoundaryStats,
  listGovernanceBoundaryTripwires,
  listGovernanceBoundaryWarnings,
  validateGovernanceBoundaryProjection,
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

const FORBIDDEN_RAW_KEYS = [
  "prompt",
  "raw_prompt",
  "model_output",
  "raw_model_output",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "raw_voice",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_ocr",
  "raw_ocr_text",
  "ocr_text",
  "raw_frame",
  "frame",
  "secret",
  "secrets",
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

describe("Phase 19C.1 governance boundary contracts and projection", () => {
  it("builds and validates the governance boundary projection", () => {
    const projection = buildGovernanceBoundaryProjection();

    expect(
      GovernanceBoundaryProjectionSchema.safeParse(projection).success,
    ).toBe(true);
    expect(validateGovernanceBoundaryProjection(projection)).toMatchObject({
      valid: true,
      reason: "valid_governance_boundary_projection",
      violation_paths: [],
      metadata_only: true,
      read_only: true,
      raw_value_included: false,
    });
    expect(projection).toMatchObject({
      projection_id: "governance-boundary:phase-19c1-projection",
      contract_version: "19C.1",
      generated_from: "deterministic_governance_boundary_metadata",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      defensive_copy_safe: true,
      payload_classes_exposed: [],
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      authority_surface_created: false,
      side_effects_performed: false,
      phase_18_boundaries_modified: false,
    });
  });

  it("declares expected subsystem nodes in deterministic order", () => {
    const projection = buildGovernanceBoundaryProjection();

    expect(projection.nodes.map((node) => node.node_id)).toEqual([
      ...GOVERNANCE_BOUNDARY_NODE_IDS,
    ]);
    expect(projection.nodes.map((node) => node.label)).toEqual([
      "Voice Runtime",
      "Vision Runtime",
      "Scheduler",
      "Approval Runtime",
      "Tool Runtime",
      "Command Center",
      "Telemetry Cockpit",
      "Architecture Graph",
      "Room Runtime",
      "Room Adapters",
      "Event Store",
      "Observability API",
      "Memory Bridge",
      "Local Providers",
      "Cloud Providers",
    ]);
  });

  it("declares policy, trust, and gate vocabularies", () => {
    expect(GOVERNANCE_BOUNDARY_EDGE_POLICIES).toEqual([
      "allowed",
      "gated",
      "forbidden",
    ]);
    expect(GOVERNANCE_BOUNDARY_GATE_TYPES).toEqual([
      "approval",
      "consent",
      "budget",
      "user_present",
      "kill_switch",
      "local_only",
      "disabled_feature",
    ]);
    expect(GOVERNANCE_BOUNDARY_TRUST_CLASSES).toEqual([
      "observe_only",
      "safe_mutate",
      "restricted_mutate",
      "forbidden",
    ]);
  });

  it("declares expected allowed, gated, and forbidden edges", () => {
    const projection = buildGovernanceBoundaryProjection();
    const edges = new Map(
      projection.edges.map((edge) => [edge.edge_id, edge] as const),
    );

    expect(
      edges.get("governance-edge:command-center-observes-observability-api"),
    ).toMatchObject({
      policy: "allowed",
      metadata_only: true,
      read_only: true,
    });
    expect(
      edges.get("governance-edge:approval-runtime-gates-tool-runtime"),
    ).toMatchObject({
      policy: "gated",
      gate_type: "approval",
      executable_action_enabled: false,
    });
    expect(
      edges.get("governance-edge:voice-tool-execution-forbidden"),
    ).toMatchObject({
      policy: "forbidden",
      gate_type: "disabled_feature",
      forbidden_tripwire_only: true,
      executable_action_enabled: false,
      dispatch_enabled: false,
      authority_grant_enabled: false,
    });
  });

  it("declares all required forbidden tripwire examples", () => {
    const labels = new Set(
      buildGovernanceBoundaryProjection()
        .edges.filter((edge) => edge.policy === "forbidden")
        .map((edge) => edge.label),
    );

    expect(labels).toEqual(
      new Set([
        "Voice to Approval Grant is forbidden",
        "Voice to Tool Execution is forbidden",
        "Vision to Room Action is forbidden",
        "Scheduler to Tool Execution is forbidden",
        "Scheduler to Approval Decision is forbidden",
        "Command Center to Runtime Mutation is forbidden",
        "Architecture Graph to Execution is forbidden",
        "Telemetry Cockpit to Mutation is forbidden",
      ]),
    );
    expect(listGovernanceBoundaryTripwires()).toHaveLength(8);
    expect(
      listGovernanceBoundaryTripwires().every(
        (tripwire) =>
          tripwire.armed_metadata_only &&
          tripwire.read_only &&
          !tripwire.observed &&
          !tripwire.creates_runtime_observer &&
          !tripwire.executes_response,
      ),
    ).toBe(true);
  });

  it("declares disabled-feature boundaries as metadata only", () => {
    const disabledEdges = buildGovernanceBoundaryProjection().edges.filter(
      (edge) => edge.disabled_feature_boundary,
    );

    expect(disabledEdges).toHaveLength(8);
    expect(
      disabledEdges.every(
        (edge) =>
          edge.policy === "forbidden" &&
          edge.gate_type === "disabled_feature" &&
          edge.metadata_only &&
          edge.read_only &&
          edge.forbidden_tripwire_only &&
          !edge.executable_action_enabled &&
          !edge.mutation_enabled &&
          !edge.dispatch_enabled,
      ),
    ).toBe(true);
  });

  it("provides stable stats and warning lists", () => {
    expect(buildGovernanceBoundaryStats()).toEqual({
      node_count: 15,
      edge_count: 17,
      allowed_edge_count: 4,
      gated_edge_count: 5,
      forbidden_edge_count: 8,
      tripwire_count: 8,
      warning_count: 2,
      disabled_feature_boundary_count: 8,
      metadata_only: true,
      read_only: true,
    });
    expect(
      listGovernanceBoundaryWarnings().map((warning) => warning.label),
    ).toEqual([
      "Forbidden paths are represented as metadata tripwires only",
      "Disabled-feature boundaries remain non-operational",
    ]);
  });

  it("projection output is deterministic", () => {
    expect(JSON.stringify(buildGovernanceBoundaryProjection())).toBe(
      JSON.stringify(buildGovernanceBoundaryProjection()),
    );
    expect(JSON.stringify(listGovernanceBoundaryTripwires())).toBe(
      JSON.stringify(listGovernanceBoundaryTripwires()),
    );
  });

  it("projection output is defensive-copy-safe", () => {
    const projection = buildGovernanceBoundaryProjection();
    projection.nodes[0].label = "Mutated Governance Node";
    projection.edges[0].label = "Mutated Governance Edge";
    projection.tripwires[0].label = "Mutated Governance Tripwire";

    const freshProjection = buildGovernanceBoundaryProjection();
    expect(freshProjection.nodes[0].label).toBe("Voice Runtime");
    expect(freshProjection.edges[0].label).toBe(
      "Command Center observes Observability API metadata",
    );
    expect(freshProjection.tripwires[0].label).toBe(
      "Voice path must never grant approval authority",
    );
  });

  it("validates metadata-only and redaction-safe guarantees", () => {
    const projection = buildGovernanceBoundaryProjection();
    const keys = collectKeys(projection);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(
      Object.values(projection.disabled_capability_flags).every(
        (value) => value === false,
      ),
    ).toBe(true);
    expect(
      projection.nodes.every(
        (node) => node.metadata_only && node.read_only && node.deterministic,
      ),
    ).toBe(true);
    expect(
      projection.edges.every(
        (edge) =>
          edge.metadata_only &&
          edge.read_only &&
          !edge.raw_payload_included &&
          !edge.tool_arguments_included &&
          !edge.approval_token_included &&
          !edge.secret_material_included,
      ),
    ).toBe(true);
  });

  it("rejects injected raw fields and executable-looking payloads", () => {
    expect(
      validateGovernanceBoundaryProjection({
        ...buildGovernanceBoundaryProjection(),
        raw_prompt: "private prompt body",
      }),
    ).toMatchObject({
      valid: false,
      reason: "forbidden_field_name",
      raw_value_included: false,
    });
    expect(
      validateGovernanceBoundaryProjection({
        ...buildGovernanceBoundaryProjection(),
        shell_note: "rm -rf workspace",
      }),
    ).toMatchObject({
      valid: false,
      reason: "executable_payload_detected",
      raw_value_included: false,
    });
    expect(
      validateGovernanceBoundaryProjection({
        ...buildGovernanceBoundaryProjection(),
        disabled_capability_flags: {
          ...buildGovernanceBoundaryProjection().disabled_capability_flags,
          execution_enabled: true,
        },
      }),
    ).toMatchObject({
      valid: false,
      reason: "disabled_capability_enabled",
      raw_value_included: false,
    });
  });

  it("exports no execution, retry, approval, mutation, dispatch, or tool-call affordances", () => {
    const exportedFunctionNames = Object.entries(governanceVisualizer)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });

  it("introduces no runtime observer, filesystem, database, telemetry, or authority wiring", () => {
    const source = readFileSync(
      "src/lib/governance-visualizer/contracts.ts",
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
