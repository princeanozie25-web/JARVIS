import { InMemoryTelemetryStore } from "./memory";
import type { TelemetryEvent, TelemetryStore } from "./types";

export const telemetry: TelemetryStore = new InMemoryTelemetryStore();

export function recordEvent(
  event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
): void {
  telemetry.record({
    timestamp: event.timestamp ?? Date.now(),
    ...event,
  });
}

export { InMemoryTelemetryStore } from "./memory";
export type {
  TelemetryEvent,
  TelemetryEventType,
  TelemetryStore,
} from "./types";
