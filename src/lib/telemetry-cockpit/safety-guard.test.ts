import { describe, expect, it } from "vitest";

import * as telemetryCockpit from "./index";
import {
  assertTelemetryCockpitSafe,
  buildTelemetryCockpitProjection,
  listTelemetryCockpitForbiddenAffordanceNames,
  listTelemetryCockpitForbiddenFieldNames,
  scanTelemetryCockpitSafety,
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
] as const;

describe("Phase 19B.2 telemetry cockpit safety guard", () => {
  it("passes the current telemetry cockpit projection", () => {
    const projection = buildTelemetryCockpitProjection();

    expect(scanTelemetryCockpitSafety(projection, "projection")).toMatchObject({
      policy_version: "19B.2",
      target_kind: "projection",
      passed: true,
      violation_count: 0,
      violations: [],
      metadata_only: true,
      read_only: true,
      deterministic: true,
      diagnostics_only: true,
      raw_value_included: false,
    });
    expect(() => assertTelemetryCockpitSafe(projection)).not.toThrow();
  });

  it("lists forbidden field and affordance names", () => {
    expect(listTelemetryCockpitForbiddenFieldNames()).toEqual(
      expect.arrayContaining([
        "raw_prompt",
        "raw_model_output",
        "tool_arguments",
        "approval_token",
        "voice_transcript",
        "audio",
        "ocr_text",
        "screenshot",
        "frame",
        "project_file_body",
        "api_key",
      ]),
    );
    expect(listTelemetryCockpitForbiddenAffordanceNames()).toEqual(
      expect.arrayContaining([
        "retry",
        "run",
        "execute",
        "approve",
        "mutate",
        "dispatch",
        "tool_call",
        "websocket",
        "polling",
        "runtime_observer",
      ]),
    );
  });

  it("rejects injected raw prompts, tool args, tokens, transcripts, OCR, and frames", () => {
    const unsafe = {
      raw_prompt: "do not expose this",
      tool_arguments: { path: "secret" },
      approval_token: "approval-token-secret",
      voice_transcript: "private utterance",
      ocr_text: "private text",
      frame: "base64-frame",
    };
    const result = scanTelemetryCockpitSafety(unsafe, "unknown_metadata");

    expect(result.passed).toBe(false);
    expect(result.violations.map((item) => item.kind)).toEqual([
      "raw_approval_token",
      "raw_screenshot_or_frame",
      "raw_ocr_text",
      "raw_prompt",
      "raw_tool_arguments",
      "raw_voice_transcript",
    ]);
    expect(JSON.stringify(result)).not.toContain("private utterance");
    expect(JSON.stringify(result)).not.toContain("approval-token-secret");
  });

  it("rejects raw audio, screenshots, project file bodies, and secrets", () => {
    const result = scanTelemetryCockpitSafety({
      audio: "private audio",
      screenshot: "private screenshot",
      project_file_body: "private source file",
      api_key: "api_key=sk-thisshouldnotappear",
    });

    expect(result.passed).toBe(false);
    expect(result.violations.map((item) => item.kind)).toEqual([
      "secret_material",
      "raw_audio",
      "project_file_body",
      "raw_screenshot_or_frame",
    ]);
    expect(JSON.stringify(result)).not.toContain("sk-thisshouldnotappear");
    expect(result.violations.every((item) => !item.raw_value_included)).toBe(
      true,
    );
  });

  it("rejects executable, shell, and function-like payloads", () => {
    const result = scanTelemetryCockpitSafety({
      display_value: "rm -rf workspace",
      handler_body: "() => fetch('/api/live')",
      callback: () => "unsafe",
    });

    expect(result.passed).toBe(false);
    expect(result.violations.map((item) => item.kind)).toEqual([
      "function_body",
      "shell_command",
      "function_body",
    ]);
  });

  it("rejects action and live-observer affordance names", () => {
    const result = scanTelemetryCockpitSafety({
      execute: false,
      approve: false,
      dispatch: false,
      websocket: false,
      polling: false,
      runtime_observer: false,
    });

    expect(result.passed).toBe(false);
    expect(result.violations.map((item) => item.kind)).toEqual([
      "action_affordance",
      "action_affordance",
      "action_affordance",
      "live_observer_affordance",
      "live_observer_affordance",
      "live_observer_affordance",
    ]);
  });

  it("keeps violation diagnostics deterministic and redacted", () => {
    const unsafe = {
      z_secret: "bearer abcdefghijklmnop",
      a_prompt: "private prompt",
      m_command: "curl https://example.test",
    };
    const first = scanTelemetryCockpitSafety(unsafe);
    const second = scanTelemetryCockpitSafety(unsafe);

    expect(first).toEqual(second);
    expect(first.violations.map((item) => item.path)).toEqual([
      "$.m_command",
      "$.z_secret",
    ]);
    expect(first.violations.map((item) => item.violation_id)).toEqual([
      "telemetry-cockpit-violation:0000",
      "telemetry-cockpit-violation:0001",
    ]);
    expect(JSON.stringify(first)).not.toContain("abcdefghijklmnop");
    expect(JSON.stringify(first)).not.toContain("private prompt");
  });

  it("exports no forbidden execution affordance functions", () => {
    const exportedFunctionNames = Object.entries(telemetryCockpit)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
