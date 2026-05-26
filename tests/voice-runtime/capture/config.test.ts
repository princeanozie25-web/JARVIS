import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAPTURE_CONFIG_LIMITS,
  DEFAULT_CAPTURE_RUNTIME_CONFIG,
  canArmCapture,
  createDefaultCaptureRuntimeConfig,
  validateCaptureConfig,
  type CaptureDevice,
  type CaptureDeviceSelection,
  type CaptureRuntimeConfig,
} from "../../../src/lib/voice-runtime";

function validConfig(
  overrides: Partial<CaptureRuntimeConfig> = {},
): CaptureRuntimeConfig {
  return {
    ...createDefaultCaptureRuntimeConfig(),
    selected_device_id: "default-input",
    ...overrides,
  };
}

function healthyDevice(overrides: Partial<CaptureDevice> = {}): CaptureDevice {
  return {
    device_id: "default-input",
    label_redacted: true,
    kind: "audioinput",
    is_default: true,
    permission_state: "granted",
    health: {
      ok: true,
      degraded: false,
      metadata_only: true,
    },
    metadata_only: true,
    ...overrides,
  };
}

function selection(
  overrides: Partial<CaptureDeviceSelection> = {},
): CaptureDeviceSelection {
  return {
    selected_device_id: "default-input",
    devices: [healthyDevice()],
    permission_state: "granted",
    metadata_only: true,
    ...overrides,
  };
}

function captureConfigSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/capture/config.ts"),
    "utf8",
  );
}

describe("Phase 14D.2 capture config scaffold", () => {
  it("defines fail-closed push-to-talk capture defaults", () => {
    expect(DEFAULT_CAPTURE_RUNTIME_CONFIG).toEqual({
      push_to_talk_enabled: true,
      selected_device_id: null,
      max_capture_ms: 30000,
      endpoint_timeout_ms: 1000,
      silence_timeout_ms: 750,
      sample_rate_hz: 16000,
      channel_count: 1,
      permission_required: true,
      mic_active_indicator_required: true,
      metadata_only: true,
    });
    expect(CAPTURE_CONFIG_LIMITS).toMatchObject({
      minMaxCaptureMs: 100,
      maxMaxCaptureMs: 120000,
      minSampleRateHz: 8000,
      maxSampleRateHz: 192000,
    });
  });

  it("validates good config and fails closed on malformed config", () => {
    expect(validateCaptureConfig(validConfig())).toEqual({
      ok: true,
      config: validConfig(),
      reasons: [],
      metadata_only: true,
    });
    expect(validateCaptureConfig(null)).toMatchObject({
      ok: false,
      reasons: ["malformed_config"],
    });
    expect(
      validateCaptureConfig({ ...validConfig(), unexpected: true }),
    ).toMatchObject({
      ok: false,
      reasons: ["malformed_config"],
    });
  });

  it("enforces bounded capture limits", () => {
    for (const patch of [
      { max_capture_ms: 99 },
      { endpoint_timeout_ms: 49 },
      { silence_timeout_ms: 10001 },
      { sample_rate_hz: 7999 },
      { channel_count: 3 },
    ] satisfies Partial<CaptureRuntimeConfig>[]) {
      expect(validateCaptureConfig(validConfig(patch))).toMatchObject({
        ok: false,
        reasons: expect.arrayContaining(["invalid_limit"]),
      });
    }
  });

  it("denies arming when permission is denied or unavailable", () => {
    expect(
      canArmCapture({
        config: validConfig(),
        selection: selection({ permission_state: "denied" }),
      }),
    ).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["permission_denied"]),
    });
    expect(
      canArmCapture({
        config: validConfig(),
        selection: selection({ permission_state: "unavailable" }),
      }),
    ).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["permission_unavailable"]),
    });
  });

  it("requires mic-active indicator and push-to-talk", () => {
    expect(
      canArmCapture({
        config: validConfig({ mic_active_indicator_required: false }),
        selection: selection(),
      }),
    ).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["mic_indicator_disabled"]),
    });
    expect(
      canArmCapture({
        config: validConfig({ push_to_talk_enabled: false }),
        selection: selection(),
      }),
    ).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["push_to_talk_disabled"]),
    });
  });

  it("requires a selected or default healthy device", () => {
    expect(
      canArmCapture({
        config: validConfig({ selected_device_id: null }),
        selection: selection({
          selected_device_id: null,
          devices: [healthyDevice({ device_id: "default-input" })],
        }),
      }),
    ).toEqual({
      allowed: true,
      device_id: "default-input",
      reasons: [],
      metadata_only: true,
    });
    expect(
      canArmCapture({
        config: validConfig({ selected_device_id: "selected-input" }),
        selection: selection({
          selected_device_id: "selected-input",
          devices: [
            healthyDevice({ device_id: "default-input" }),
            healthyDevice({ device_id: "selected-input", is_default: false }),
          ],
        }),
      }),
    ).toMatchObject({
      allowed: true,
      device_id: "selected-input",
    });
    expect(
      canArmCapture({
        config: validConfig({ selected_device_id: "missing-input" }),
        selection: selection(),
      }),
    ).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["device_selection_mismatch"]),
    });
    expect(
      canArmCapture({
        config: validConfig({ selected_device_id: null }),
        selection: selection({ selected_device_id: null, devices: [] }),
      }),
    ).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["device_missing"]),
    });
  });

  it("does not introduce mic capture APIs, audio libraries, Tauri, runtime, persistence, cloud, or UI wiring", () => {
    const source = captureConfigSource();

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone|micCapture/i,
    );
    expect(source).not.toMatch(
      /from\s+["'](?:mic|node-record-lpcm16|naudiodon|speaker|wav|node-wav)["']|require\s*\(\s*["'](?:mic|node-record-lpcm16|naudiodon|speaker|wav|node-wav)["']\s*\)/i,
    );
    expect(source).not.toMatch(
      /tauri|invoke\s*\(|global-hotkey|globalShortcut|hotkey/i,
    );
    expect(source).not.toMatch(
      /createFasterWhisperSttProvider|transcribe\s*\(|createPiperTtsProvider|synthesize\s*\(|faster_whisper|piper/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(/tsx|jsx|React|useEffect|useState|app\/api/i);
  });
});
