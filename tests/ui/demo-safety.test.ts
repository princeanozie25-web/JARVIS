import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditPage from "../../src/app/audit/page";
import RestPage from "../../src/app/rest/page";
import WorkingPage from "../../src/app/working/page";
import {
  REQUIRED_DEMO_MARKER,
  createDemoSafetyEnvelope,
  validateDemoSafety,
  type DemoSafetyEnvelope,
} from "../../src/lib/observability/demo-safety";
import {
  SYNTHETIC_OBSERVABILITY_MARKER,
  SYNTHETIC_REST_ORB_DATASET,
  syntheticAuditPanels,
  syntheticWorkingPanels,
  validateSyntheticDataset,
} from "../../src/lib/observability/synthetic-data";

const DEMO_SAFETY_SOURCE_FILES = [
  "src/lib/observability/demo-safety.ts",
  "src/lib/observability/synthetic-data.ts",
] as const;

function sourceText() {
  return DEMO_SAFETY_SOURCE_FILES.map((file) =>
    readFileSync(file, "utf8"),
  ).join("\n");
}

function validEnvelope(): DemoSafetyEnvelope<unknown> {
  return createDemoSafetyEnvelope({
    marker: "demo row",
    values: ["synthetic", "metadata only"],
  });
}

describe("Phase 12F.2 synthetic demo safety guardrails", () => {
  it("accepts valid synthetic datasets with required guardrail metadata", () => {
    const validation = validateDemoSafety(validEnvelope());

    expect(validation).toEqual({
      ok: true,
      data: {
        marker: "demo row",
        values: ["synthetic", "metadata only"],
      },
      errors: [],
    });
    expect(SYNTHETIC_REST_ORB_DATASET).toMatchObject({
      marker: REQUIRED_DEMO_MARKER,
      source: "synthetic",
      live_data_access: false,
      persistence_access: false,
      authority: "read_only",
      classification: "metadata_only",
    });
    expect(syntheticWorkingPanels()[0]).toMatchObject({
      data_classification: "metadata_only",
      authority: "read_only",
    });
    expect(syntheticAuditPanels()[0]).toMatchObject({
      data_classification: "metadata_only",
      authority: "read_only",
    });
  });

  it("fails closed when the demo marker is missing", () => {
    const envelope = { ...validEnvelope(), marker: "" };

    expect(validateDemoSafety(envelope)).toMatchObject({
      ok: false,
      data: null,
      errors: ["missing_demo_marker"],
    });
  });

  it("fails closed when source is not synthetic", () => {
    expect(
      validateDemoSafety({ ...validEnvelope(), source: "live" as never }),
    ).toMatchObject({
      ok: false,
      data: null,
      errors: ["invalid_demo_source"],
    });
  });

  it("fails closed when live or persistence access is enabled", () => {
    expect(
      validateDemoSafety({
        ...validEnvelope(),
        live_data_access: true as never,
      }),
    ).toMatchObject({
      ok: false,
      data: null,
      errors: ["live_data_access_not_false"],
    });
    expect(
      validateDemoSafety({
        ...validEnvelope(),
        persistence_access: true as never,
      }),
    ).toMatchObject({
      ok: false,
      data: null,
      errors: ["persistence_access_not_false"],
    });
  });

  it("fails closed for non-read-only authority or non-metadata classification", () => {
    expect(
      validateDemoSafety({ ...validEnvelope(), authority: "write" as never }),
    ).toMatchObject({
      ok: false,
      data: null,
      errors: ["invalid_demo_authority"],
    });
    expect(
      validateDemoSafety({
        ...validEnvelope(),
        classification: "raw_payload" as never,
      }),
    ).toMatchObject({
      ok: false,
      data: null,
      errors: ["invalid_demo_classification"],
    });
  });

  it("fails closed for raw, secret-looking, prompt, OCR, frame, voice, project, and command payloads", () => {
    const unsafeFields = [
      { payload_json: "anything" },
      { secret: "anything" },
      { prompt: "anything" },
      { model_output: "anything" },
      { ocr_text: "anything" },
      { frame: "anything" },
      { voice: "anything" },
      { project_body: "anything" },
      { command_value: "anything" },
      { value: "sk-secret" },
    ];

    for (const data of unsafeFields) {
      expect(validateDemoSafety(createDemoSafetyEnvelope(data))).toMatchObject({
        ok: false,
        data: null,
        errors: ["unsafe_demo_payload"],
      });
    }
  });

  it("keeps route synthetic markers visible", () => {
    const html = [
      renderToStaticMarkup(createElement(RestPage)),
      renderToStaticMarkup(createElement(WorkingPage)),
      renderToStaticMarkup(createElement(AuditPage)),
    ].join("\n");

    expect(SYNTHETIC_OBSERVABILITY_MARKER).toBe(REQUIRED_DEMO_MARKER);
    expect(html).toContain(REQUIRED_DEMO_MARKER);
    expect(html).toContain("METADATA-ONLY");
  });

  it("exposes synthetic-data validation and fails closed through that helper", () => {
    expect(
      validateSyntheticDataset({
        ...validEnvelope(),
        data: { prompt: "should fail" },
      }),
    ).toMatchObject({
      ok: false,
      data: null,
      errors: ["unsafe_demo_payload"],
    });
  });

  it("does not import DB, store, HTTP, network, timers, IPC, providers, or room execution APIs", () => {
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|db\./i,
    );
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|ReadableStream|setInterval|setTimeout|poll|node:http|node:https|createServer|listen\(/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider runtime|model runtime|openai|anthropic|ollama/i,
    );
    expect(sourceText()).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
  });
});
