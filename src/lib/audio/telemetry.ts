import type { AudioTelemetryEvent } from "./types";

export async function recordAudioTelemetry(
  event: AudioTelemetryEvent,
): Promise<void> {
  await fetch("/api/audio/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
