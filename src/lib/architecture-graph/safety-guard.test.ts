import { describe, expect, it } from "vitest";

import * as architectureGraph from "./index";
import {
  assertArchitectureGraphProjectionSafe,
  assertArchitectureGraphSafe,
  buildArchitectureGraphProjection,
  getArchitectureNodeDependencies,
  getStaticArchitectureGraph,
  listArchitectureGraphForbiddenAffordanceNames,
  listArchitectureGraphForbiddenFieldNames,
  scanArchitectureGraphProjectionSafety,
  scanArchitectureGraphSafety,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "callTool",
] as const;

describe("Phase 19A.5 architecture graph safety guard", () => {
  it("current static graph passes safety scan", () => {
    expect(
      scanArchitectureGraphSafety(
        getStaticArchitectureGraph(),
        "static_registry_output",
      ),
    ).toMatchObject({
      valid: true,
      violation_count: 0,
      violations: [],
      metadata_only: true,
      read_only: true,
      deterministic: true,
      diagnostics_only: true,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      action_executed: false,
      dispatch_performed: false,
      mutation_performed: false,
      authority_surface_created: false,
    });
    expect(() =>
      assertArchitectureGraphSafe(getStaticArchitectureGraph()),
    ).not.toThrow();
  });

  it("current projection passes safety scan", () => {
    const projection = buildArchitectureGraphProjection();

    expect(scanArchitectureGraphProjectionSafety(projection)).toMatchObject({
      target_kind: "projection_output",
      valid: true,
      violation_count: 0,
      metadata_only: true,
      read_only: true,
    });
    expect(() =>
      assertArchitectureGraphProjectionSafe(projection),
    ).not.toThrow();
  });

  it("current query helper output passes safety scan", () => {
    expect(
      scanArchitectureGraphSafety(
        getArchitectureNodeDependencies("arch-node:command-center"),
        "query_output",
      ),
    ).toMatchObject({
      target_kind: "query_output",
      valid: true,
      violation_count: 0,
    });
  });

  it("intentionally injected raw prompt is rejected", () => {
    expect(
      scanArchitectureGraphSafety({
        raw_prompt: "The forbidden system prompt should not leak.",
      }),
    ).toMatchObject({
      valid: false,
      violations: [
        expect.objectContaining({
          violation_id: "arch-safety-violation:0000",
          kind: "raw_prompt",
          path: "$.raw_prompt",
          field_name: "raw_prompt",
          raw_value_included: false,
        }),
      ],
    });
  });

  it("intentionally injected tool arguments are rejected", () => {
    expect(
      scanArchitectureGraphSafety({
        tool_args: { command: "touch unsafe.txt" },
      }),
    ).toMatchObject({
      valid: false,
      violations: [
        expect.objectContaining({
          kind: "raw_tool_arguments",
          path: "$.tool_args",
          field_name: "tool_args",
        }),
      ],
    });
  });

  it("intentionally injected token/API key is rejected", () => {
    const rawSecret = "sk-test-secret-value-1234567890";
    const result = scanArchitectureGraphSafety({
      api_key: rawSecret,
    });

    expect(result).toMatchObject({
      valid: false,
      violations: [
        expect.objectContaining({
          kind: "secret_material",
          path: "$.api_key",
          field_name: "api_key",
          redacted_sample: "[redacted:string:secret_material]",
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
  });

  it("voice transcript, OCR, and frame fields are rejected", () => {
    const result = scanArchitectureGraphSafety({
      raw_voice_transcript: "turn on the lights",
      raw_ocr_text: "private screen text",
      raw_frame: "base64-image-data",
    });

    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "raw_voice_transcript",
      "raw_ocr_text",
      "raw_camera_frame",
    ]);
    expect(result.violations.map((violation) => violation.path)).toEqual([
      "$.raw_voice_transcript",
      "$.raw_ocr_text",
      "$.raw_frame",
    ]);
  });

  it("executable, function, and shell-looking payloads are rejected", () => {
    const result = scanArchitectureGraphSafety({
      executable_payload: { plan: "unsafe" },
      safe_label: "function doThing() { return true; }",
      shell_like: "rm -rf /",
    });

    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "executable_payload",
      "function_body",
      "shell_command",
    ]);
  });

  it("action and graph-driven affordance names are rejected", () => {
    const result = scanArchitectureGraphSafety({
      execute: true,
      graph_execute: true,
      callTool: "room.light.on",
    });

    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "action_affordance",
      "graph_driven_execution_affordance",
      "action_affordance",
    ]);
  });

  it("violation output does not leak forbidden raw value", () => {
    const rawValue = "Bearer super-secret-token-1234567890";
    const result = scanArchitectureGraphSafety({
      nested: {
        unsafe: rawValue,
      },
    });

    expect(result).toMatchObject({
      valid: false,
      violations: [
        expect.objectContaining({
          kind: "secret_material",
          path: "$.nested.unsafe",
          redacted_sample: "[redacted:string:secret_material]",
          raw_value_included: false,
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain(rawValue);
  });

  it("violation order and IDs are deterministic", () => {
    const unsafe = {
      raw_prompt: "first forbidden value",
      raw_model_output: "second forbidden value",
      execute: true,
    };

    expect(scanArchitectureGraphSafety(unsafe)).toEqual(
      scanArchitectureGraphSafety(unsafe),
    );
    expect(
      scanArchitectureGraphSafety(unsafe).violations.map((violation) => [
        violation.violation_id,
        violation.kind,
        violation.path,
      ]),
    ).toEqual([
      ["arch-safety-violation:0000", "raw_prompt", "$.raw_prompt"],
      ["arch-safety-violation:0001", "raw_model_output", "$.raw_model_output"],
      ["arch-safety-violation:0002", "action_affordance", "$.execute"],
    ]);
  });

  it("lists forbidden field and affordance names as metadata", () => {
    expect(listArchitectureGraphForbiddenFieldNames()).toEqual(
      expect.arrayContaining([
        "raw_prompt",
        "raw_model_output",
        "tool_args",
        "approval_token",
        "raw_voice_transcript",
        "raw_audio_reference",
        "raw_ocr_text",
        "raw_screenshot",
        "raw_frame",
        "api_key",
        "executable_payload",
        "shell_command",
        "graph_execute",
      ]),
    );
    expect(listArchitectureGraphForbiddenAffordanceNames()).toEqual(
      expect.arrayContaining([
        "execute",
        "retry",
        "approve",
        "run",
        "mutate",
        "dispatch",
        "calltool",
      ]),
    );
  });

  it("exported API contains no execution affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
