import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isWakeWordProviderDetectionResult,
  type WakeWordProvider,
} from "../../../src/lib/voice-runtime/wake-word";

const sourceRoot = join(process.cwd(), "src/lib/voice-runtime/wake-word");

describe("wake-word provider contract scaffold", () => {
  it("defines a metadata-only provider contract without real implementation", async () => {
    const provider: WakeWordProvider = {
      id: "local-wake-contract",
      kind: "local",
      metadata_only: true,
      async arm() {
        return {
          provider_id: "local-wake-contract",
          ok: true,
          degraded: false,
          metadata_only: true,
        };
      },
      async disarm() {
        return {
          provider_id: "local-wake-contract",
          ok: true,
          degraded: false,
          metadata_only: true,
        };
      },
      async detect() {
        return {
          provider_id: "local-wake-contract",
          wake_detected: false,
          confidence_band: "low",
          latency_ms: 0,
          degraded: false,
          metadata_only: true,
        };
      },
      async cancel() {
        return undefined;
      },
      async health() {
        return {
          provider_id: "local-wake-contract",
          ok: true,
          degraded: false,
          metadata_only: true,
        };
      },
    };

    expect(await provider.arm()).toMatchObject({
      provider_id: "local-wake-contract",
      metadata_only: true,
    });
    expect(isWakeWordProviderDetectionResult(await provider.detect())).toBe(
      true,
    );
  });

  it("accepts only metadata-only detection results", () => {
    expect(
      isWakeWordProviderDetectionResult({
        provider_id: "wake-local",
        wake_detected: true,
        confidence_band: "high",
        latency_ms: 12,
        degraded: false,
        metadata_only: true,
      }),
    ).toBe(true);

    expect(
      isWakeWordProviderDetectionResult({
        provider_id: "wake-local",
        wake_detected: true,
        confidence_band: "certain",
        latency_ms: 12,
        degraded: false,
        metadata_only: true,
      }),
    ).toBe(false);
  });

  it.each([
    "audio",
    "raw_audio",
    "audio_bytes",
    "waveform",
    "pcm",
    "transcript",
    "raw_transcript",
    "text",
    "speaker_embedding",
    "voiceprint",
    "biometric_identifier",
    "prompt",
    "response",
    "tool_output",
  ])("rejects forbidden provider detection field %s", (field) => {
    expect(
      isWakeWordProviderDetectionResult({
        provider_id: "wake-local",
        wake_detected: false,
        confidence_band: "medium",
        latency_ms: 5,
        degraded: false,
        metadata_only: true,
        [field]: "forbidden",
      }),
    ).toBe(false);
  });

  it("does not introduce wake-word engine, mic loop, runtime, persistence, cloud, or UI wiring", () => {
    const source = ["provider.ts", "index.ts"]
      .map((fileName) => readFileSync(join(sourceRoot, fileName), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/openwakeword|Porcupine|Picovoice|snowboy/i);
    expect(source).not.toMatch(
      /getUserMedia|MediaRecorder|AudioContext|navigator\.mediaDevices|MediaStream/i,
    );
    expect(source).not.toMatch(/setInterval|while\s*\(true\)/i);
    expect(source).not.toMatch(/createModelRuntime|executeVoiceRequest/i);
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|writeFile|appendFile|database/i,
    );
    expect(source).not.toMatch(/fetch\s*\(|WebSocket|EventSource/i);
    expect(source).not.toMatch(/React|useEffect|tauri|invoke\s*\(/i);
  });
});
