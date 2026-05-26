import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAPTURE_DEVICE_KINDS,
  CAPTURE_PERMISSION_STATES,
  isCaptureDevice,
  isCapturePermissionState,
  validateCaptureDeviceSelection,
  type CaptureDevice,
  type CaptureDeviceSelection,
} from "../../../src/lib/voice-runtime";

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
      checked_at_ms: 1,
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
    selected_device_id: null,
    devices: [healthyDevice()],
    permission_state: "granted",
    metadata_only: true,
    ...overrides,
  };
}

function captureDeviceSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/capture/device.ts"),
    "utf8",
  );
}

describe("Phase 14D.2 capture device scaffold", () => {
  it("defines metadata-only capture device kinds and permission states", () => {
    expect(CAPTURE_DEVICE_KINDS).toEqual(["audioinput"]);
    expect(CAPTURE_PERMISSION_STATES).toEqual([
      "unknown",
      "granted",
      "denied",
      "unavailable",
    ]);
    expect(isCapturePermissionState("granted")).toBe(true);
    expect(isCapturePermissionState("prompt")).toBe(false);
  });

  it("accepts metadata-only devices without raw handles or labels", () => {
    const device = healthyDevice();

    expect(isCaptureDevice(device)).toBe(true);
    expect(Object.keys(device)).toEqual([
      "device_id",
      "label_redacted",
      "kind",
      "is_default",
      "permission_state",
      "health",
      "metadata_only",
    ]);
    expect(JSON.stringify(device)).not.toMatch(
      /raw_handle|os_device_handle|native_handle|label":|microphone/i,
    );
  });

  it("rejects raw handles, unredacted labels, and malformed devices", () => {
    expect(
      isCaptureDevice({
        ...healthyDevice(),
        label: "Built-in Microphone",
      }),
    ).toBe(false);
    expect(
      isCaptureDevice({
        ...healthyDevice(),
        os_device_handle: {},
      }),
    ).toBe(false);
    expect(
      isCaptureDevice({
        ...healthyDevice(),
        label_redacted: false,
      }),
    ).toBe(false);
  });

  it("selects explicit or default healthy devices", () => {
    const defaultDevice = healthyDevice({ device_id: "default" });
    const selectedDevice = healthyDevice({
      device_id: "selected",
      is_default: false,
    });

    expect(
      validateCaptureDeviceSelection(
        selection({
          selected_device_id: "selected",
          devices: [defaultDevice, selectedDevice],
        }),
      ),
    ).toEqual({
      ok: true,
      device: selectedDevice,
      reasons: [],
      metadata_only: true,
    });
    expect(
      validateCaptureDeviceSelection(
        selection({
          selected_device_id: null,
          devices: [defaultDevice, selectedDevice],
        }),
      ),
    ).toMatchObject({
      ok: true,
      device: { device_id: "default" },
    });
  });

  it("fails closed on denied, unavailable, missing, or unhealthy device selection", () => {
    expect(
      validateCaptureDeviceSelection(selection({ permission_state: "denied" })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["permission_denied"]),
    });
    expect(
      validateCaptureDeviceSelection(
        selection({ permission_state: "unavailable" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["permission_unavailable"]),
    });
    expect(
      validateCaptureDeviceSelection(selection({ devices: [] })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["device_missing"]),
    });
    expect(
      validateCaptureDeviceSelection(
        selection({ selected_device_id: "missing" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["selected_device_missing"]),
    });
    expect(
      validateCaptureDeviceSelection(
        selection({
          devices: [
            healthyDevice({
              health: {
                ok: false,
                degraded: true,
                error_class: "unavailable",
                metadata_only: true,
              },
            }),
          ],
        }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["device_unhealthy"]),
    });
  });

  it("does not introduce mic capture APIs, audio libraries, Tauri, runtime, persistence, cloud, or UI wiring", () => {
    const source = captureDeviceSource();

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
