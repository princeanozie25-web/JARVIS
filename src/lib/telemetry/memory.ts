import type { TelemetryEvent, TelemetryStore } from "./types";

const MAX_EVENTS = 1000;

export class InMemoryTelemetryStore implements TelemetryStore {
  private events: TelemetryEvent[] = [];

  record(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  list(limit?: number): TelemetryEvent[] {
    if (limit === undefined) return [...this.events];
    return this.events.slice(-limit);
  }

  reset(): void {
    this.events = [];
  }
}
