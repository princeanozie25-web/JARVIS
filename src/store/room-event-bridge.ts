import type { FakeDeviceEvent } from "../room/adapters/fake-events";
import type { EventStore } from "./event-store";

export interface RoomEventBridgeResult {
  readonly appended: true;
  readonly event_id: string;
  readonly room_event_id: string;
  readonly source_event_id: string;
  readonly metadata_only: true;
  readonly raw_payload_included: false;
  readonly fake_only: true;
  readonly local_only: true;
  readonly mutation_authority_added: false;
}

export function appendFakeRoomEventToStore(input: {
  readonly store: Pick<EventStore, "appendRoomEvent">;
  readonly event: FakeDeviceEvent;
}): RoomEventBridgeResult {
  const event = sanitizeAndValidateFakeEvent(input.event);
  const eventId = `room-${event.event_id}`;
  const roomEventId = `room-event-${event.event_id}`;

  input.store.appendRoomEvent({
    eventId,
    eventType: event.event_type,
    occurredAtMs: event.timestamp,
    source: "fake_room_event_bridge",
    aggregateId: event.device_id ?? event.sensor_id ?? event.room_id,
    metadataJson: JSON.stringify({
      source_event_id: event.event_id,
      result_status: event.result_status,
      command_id: event.command_id,
      plan_id: event.plan_id,
      fake_only: true,
      local_only: true,
      metadata_only: true,
      redacted: true,
      provenance: sanitizeMetadata(event.provenance),
    }),
    roomEventId,
    roomId: event.room_id,
    profileId: event.profile_id,
    adapterId: event.adapter_id,
    deviceId: event.device_id,
    sensorId: event.sensor_id,
    capability: event.capability,
    failureClass: event.failure_class,
  });

  return {
    appended: true,
    event_id: eventId,
    room_event_id: roomEventId,
    source_event_id: event.event_id,
    metadata_only: true,
    raw_payload_included: false,
    fake_only: true,
    local_only: true,
    mutation_authority_added: false,
  };
}

function sanitizeAndValidateFakeEvent(event: FakeDeviceEvent): FakeDeviceEvent {
  const unsafe =
    event.fake_only !== true ||
    event.local_only !== true ||
    event.metadata_only !== true ||
    event.redacted !== true ||
    event.raw_payload_included !== false ||
    event.secrets_included !== false ||
    event.network_called !== false ||
    event.hardware_io_performed !== false ||
    event.ui_rendered !== false ||
    event.provider_called !== false;

  if (unsafe) {
    throw new Error("Fake room event bridge rejected unsafe event metadata.");
  }
  if (!event.event_id.trim() || !event.adapter_id.trim()) {
    throw new Error("Fake room event bridge rejected malformed event.");
  }
  if (!Number.isInteger(event.timestamp) || event.timestamp < 0) {
    throw new Error("Fake room event bridge rejected malformed event time.");
  }

  return structuredClone(event);
}

function sanitizeMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeMetadata(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        redactText(key),
        isSecretKey(key) ? "[redacted]" : sanitizeMetadata(entry),
      ]),
    );
  }
  return null;
}

function redactText(value: string): string {
  return isSecretText(value) ? "[redacted]" : value;
}

function isSecretKey(value: string): boolean {
  return /(api[_-]?key|password|secret|token)/i.test(value);
}

function isSecretText(value: string): boolean {
  return /(sk-[a-z0-9_-]+|api[_-]?key|password|secret|token)/i.test(value);
}
