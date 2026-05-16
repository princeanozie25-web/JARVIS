import { InMemoryTelemetryStore } from "./memory";
import { getDb, insertTelemetryEvent } from "../db";
import type { TelemetryEvent, TelemetryStore } from "./types";

export const telemetry: TelemetryStore = new InMemoryTelemetryStore();

export function recordEvent(
  event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
): void {
  const completeEvent = {
    timestamp: event.timestamp ?? Date.now(),
    ...event,
  };
  telemetry.record(completeEvent);

  try {
    insertTelemetryEvent(getDb(), completeEvent);
  } catch (error) {
    console.warn(
      "[telemetry] failed to persist telemetry event",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export { InMemoryTelemetryStore } from "./memory";
export type {
  TelemetryEvent,
  TelemetryEventType,
  TelemetryStore,
} from "./types";
