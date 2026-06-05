/**
 * Mock event stream — DD.1.
 *
 * Pure factory that replays a fixture sequence to subscribers without
 * touching any real telemetry source. No `setInterval`, no `fetch`,
 * no `WebSocket`, no `EventSource`. The stream advances when the
 * consumer calls `step()` or `play()` — tests pin every transition
 * explicitly.
 */

import type { GauntletEvent } from "./events";

export interface MockGauntletEventStream {
  /** All events the stream will ever emit, in order. */
  readonly events: readonly GauntletEvent[];
  /** True after every event has been emitted. */
  isComplete(): boolean;
  /** Returns the index of the next pending event, or -1 when complete. */
  pendingIndex(): number;
  /** Subscribe to subsequent events. Returns an unsubscribe handle. */
  subscribe(listener: (event: GauntletEvent) => void): () => void;
  /** Emit the next event to all subscribers. */
  step(): GauntletEvent | null;
  /** Emit every remaining event in order. */
  play(): readonly GauntletEvent[];
  /** Reset the cursor so the stream can be replayed. */
  reset(): void;
}

export function createMockGauntletEventStream(
  events: readonly GauntletEvent[],
): MockGauntletEventStream {
  const listeners = new Set<(event: GauntletEvent) => void>();
  let cursor = 0;

  function notify(event: GauntletEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        /* swallow — one bad listener must not block the stream */
      }
    }
  }

  return {
    events,
    isComplete() {
      return cursor >= events.length;
    },
    pendingIndex() {
      return cursor >= events.length ? -1 : cursor;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    step() {
      if (cursor >= events.length) return null;
      const event = events[cursor];
      cursor += 1;
      notify(event);
      return event;
    },
    play() {
      const emitted: GauntletEvent[] = [];
      while (cursor < events.length) {
        const event = events[cursor];
        cursor += 1;
        emitted.push(event);
        notify(event);
      }
      return emitted;
    },
    reset() {
      cursor = 0;
    },
  };
}
