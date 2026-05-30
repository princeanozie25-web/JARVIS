import { describe, expect, it } from "vitest";

import * as governanceVisualizer from "./index";
import {
  assertGovernanceBoundarySafe,
  buildGovernanceBoundaryProjection,
  getGovernanceBoundaryEdgesForNode,
  getGovernanceBoundaryInboundEdges,
  getGovernanceBoundaryNodeById,
  getGovernanceBoundaryOutboundEdges,
  listGovernanceBoundaryEdges,
  listGovernanceBoundaryEdgesByGate,
  listGovernanceBoundaryEdgesByPolicy,
  listGovernanceBoundaryEdgesByTrustClass,
  listGovernanceBoundaryForbiddenAffordanceNames,
  listGovernanceBoundaryForbiddenFieldNames,
  listGovernanceBoundaryNodes,
  listGovernanceBoundaryTripwiresForNode,
  scanGovernanceBoundarySafety,
  summarizeGovernanceBoundaryNode,
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

describe("Phase 19C.2 governance boundary queries and safety guard", () => {
  it("query helpers return expected nodes and edges deterministically", () => {
    expect(listGovernanceBoundaryNodes().map((node) => node.label)).toContain(
      "Approval Runtime",
    );
    expect(listGovernanceBoundaryEdges()[0]).toMatchObject({
      edge_id: "governance-edge:command-center-observes-observability-api",
      policy: "allowed",
      metadata_only: true,
      read_only: true,
    });
    expect(
      getGovernanceBoundaryNodeById("governance-node:voice-runtime"),
    ).toMatchObject({
      label: "Voice Runtime",
      trust_class: "observe_only",
    });
    expect(JSON.stringify(listGovernanceBoundaryEdges())).toBe(
      JSON.stringify(listGovernanceBoundaryEdges()),
    );
  });

  it("allowed, gated, and forbidden edge filters work", () => {
    expect(listGovernanceBoundaryEdgesByPolicy("allowed")).toHaveLength(4);
    expect(listGovernanceBoundaryEdgesByPolicy("gated")).toHaveLength(5);
    expect(listGovernanceBoundaryEdgesByPolicy("forbidden")).toHaveLength(8);
    expect(listGovernanceBoundaryEdgesByPolicy("unknown")).toEqual([]);
    expect(
      listGovernanceBoundaryEdgesByPolicy("forbidden").every(
        (edge) =>
          edge.forbidden_tripwire_only &&
          edge.policy === "forbidden" &&
          !edge.executable_action_enabled &&
          !edge.dispatch_enabled &&
          !edge.mutation_enabled &&
          !edge.authority_grant_enabled,
      ),
    ).toBe(true);
  });

  it("gate and trust-class filters work", () => {
    expect(
      listGovernanceBoundaryEdgesByGate("approval").map((edge) => edge.label),
    ).toEqual([
      "Approval Runtime gates Tool Runtime",
      "Memory Bridge mutations require approval metadata",
    ]);
    expect(listGovernanceBoundaryEdgesByGate("disabled_feature")).toHaveLength(
      8,
    );
    expect(listGovernanceBoundaryEdgesByGate("bad_gate")).toEqual([]);
    expect(
      listGovernanceBoundaryEdgesByTrustClass("observe_only"),
    ).toHaveLength(4);
    expect(
      listGovernanceBoundaryEdgesByTrustClass("restricted_mutate"),
    ).toHaveLength(4);
    expect(listGovernanceBoundaryEdgesByTrustClass("forbidden")).toHaveLength(
      8,
    );
    expect(listGovernanceBoundaryEdgesByTrustClass("unknown")).toEqual([]);
  });

  it("inbound, outbound, and node edge helpers fail closed for unknown IDs", () => {
    expect(
      getGovernanceBoundaryOutboundEdges("governance-node:voice-runtime").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "governance-edge:voice-runtime-local-providers",
      "governance-edge:voice-approval-grant-forbidden",
      "governance-edge:voice-tool-execution-forbidden",
    ]);
    expect(
      getGovernanceBoundaryInboundEdges("governance-node:tool-runtime").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "governance-edge:approval-runtime-gates-tool-runtime",
      "governance-edge:voice-tool-execution-forbidden",
      "governance-edge:scheduler-tool-execution-forbidden",
      "governance-edge:architecture-graph-execution-forbidden",
      "governance-edge:telemetry-cockpit-mutation-forbidden",
    ]);
    expect(
      getGovernanceBoundaryEdgesForNode("governance-node:not-real"),
    ).toEqual([]);
    expect(getGovernanceBoundaryInboundEdges("not-a-node")).toEqual([]);
    expect(getGovernanceBoundaryOutboundEdges("not-a-node")).toEqual([]);
    expect(getGovernanceBoundaryNodeById("not-a-node")).toBeNull();
  });

  it("tripwires are visible but inert and summaries never infer execution", () => {
    const tripwires = listGovernanceBoundaryTripwiresForNode(
      "governance-node:scheduler",
    );
    const summary = summarizeGovernanceBoundaryNode(
      "governance-node:scheduler",
    );

    expect(tripwires.map((tripwire) => tripwire.tripwire_id)).toEqual([
      "governance-tripwire:scheduler-tool-execution",
      "governance-tripwire:scheduler-approval-decision",
    ]);
    expect(
      tripwires.every(
        (tripwire) =>
          tripwire.metadata_only &&
          tripwire.read_only &&
          !tripwire.observed &&
          !tripwire.creates_runtime_observer &&
          !tripwire.executes_response,
      ),
    ).toBe(true);
    expect(summary).toMatchObject({
      node_id: "governance-node:scheduler",
      label: "Scheduler",
      forbidden_edge_count: 2,
      tripwire_count: 2,
      disabled_capabilities_visible: true,
      execution_inferred: false,
      authority_surface_created: false,
      metadata_only: true,
      read_only: true,
    });
    expect(summarizeGovernanceBoundaryNode("not-a-node")).toBeNull();
  });

  it("returned query data is defensive-copy-safe", () => {
    const node = getGovernanceBoundaryNodeById("governance-node:voice-runtime");
    const edge = listGovernanceBoundaryEdges()[0];
    const tripwire = listGovernanceBoundaryTripwiresForNode(
      "governance-node:voice-runtime",
    )[0];

    if (node) node.label = "Mutated Node";
    edge.label = "Mutated Edge";
    tripwire.label = "Mutated Tripwire";

    expect(
      getGovernanceBoundaryNodeById("governance-node:voice-runtime")?.label,
    ).toBe("Voice Runtime");
    expect(listGovernanceBoundaryEdges()[0].label).toBe(
      "Command Center observes Observability API metadata",
    );
    expect(
      listGovernanceBoundaryTripwiresForNode("governance-node:voice-runtime")[0]
        .label,
    ).toBe("Voice path must never grant approval authority");
  });

  it("current projection and query outputs pass the dedicated safety scan", () => {
    expect(
      scanGovernanceBoundarySafety(
        buildGovernanceBoundaryProjection(),
        "projection",
      ),
    ).toMatchObject({
      passed: true,
      violation_count: 0,
      metadata_only: true,
      read_only: true,
      diagnostics_only: true,
      raw_value_included: false,
    });
    expect(() =>
      assertGovernanceBoundarySafe(
        summarizeGovernanceBoundaryNode("governance-node:voice-runtime"),
      ),
    ).not.toThrow();
  });

  it("rejects raw, executable, and secret payloads without leaking values", () => {
    const unsafePrompt = {
      panel: "governance",
      raw_prompt: "do not leak this private prompt",
    };
    const unsafeShell = {
      note: "rm -rf C:/Users/princ/Documents/jarvis",
    };
    const unsafeSecret = {
      token_label: "Bearer abcdefghijklmnopqrstuvwxyz",
    };

    for (const target of [unsafePrompt, unsafeShell, unsafeSecret]) {
      const result = scanGovernanceBoundarySafety(target, "query_result");
      expect(result.passed).toBe(false);
      expect(result.raw_value_included).toBe(false);
      expect(JSON.stringify(result)).not.toContain("do not leak");
      expect(JSON.stringify(result)).not.toContain("rm -rf");
      expect(JSON.stringify(result)).not.toContain(
        "abcdefghijklmnopqrstuvwxyz",
      );
      expect(
        result.violations.every((violation) => violation.redacted_sample),
      ).toBe(true);
    }
  });

  it("rejects action, authority creation, and policy mutation affordances", () => {
    const result = scanGovernanceBoundarySafety(
      {
        execute: false,
        grant_authority: false,
        update_policy: false,
      },
      "query_result",
    );

    expect(result).toMatchObject({
      passed: false,
      violation_count: 3,
      raw_value_included: false,
    });
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "action_affordance",
      "authority_creation_affordance",
      "policy_mutation_affordance",
    ]);
  });

  it("violation order is deterministic", () => {
    const target = {
      z_payload: "rm -rf workspace",
      approval_token: "secret-token",
      grant_authority: false,
    };

    expect(JSON.stringify(scanGovernanceBoundarySafety(target))).toBe(
      JSON.stringify(scanGovernanceBoundarySafety(target)),
    );
    expect(
      scanGovernanceBoundarySafety(target).violations.map(
        (violation) => violation.path,
      ),
    ).toEqual(["$.approval_token", "$.grant_authority", "$.z_payload"]);
  });

  it("lists forbidden fields and affordance names", () => {
    expect(listGovernanceBoundaryForbiddenFieldNames()).toEqual(
      expect.arrayContaining([
        "raw_prompt",
        "tool_arguments",
        "approval_token",
        "raw_model_output",
        "raw_voice",
        "raw_ocr_text",
        "raw_frame",
        "secret",
      ]),
    );
    expect(listGovernanceBoundaryForbiddenAffordanceNames()).toEqual(
      expect.arrayContaining([
        "run",
        "retry",
        "execute",
        "approve",
        "mutate",
        "dispatch",
        "grant_authority",
        "update_policy",
      ]),
    );
  });

  it("exports no forbidden execution or authority affordance names", () => {
    const exportedFunctionNames = Object.entries(governanceVisualizer)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
