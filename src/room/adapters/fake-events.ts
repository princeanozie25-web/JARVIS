import type {
  RoomAdapterFailureClass,
  RoomAdapterProvenance,
} from "./contract";
import type { AdapterKind, Capability } from "../types";

export const FAKE_DEVICE_EVENT_TYPES = [
  "state_read",
  "command_planned",
  "command_executed",
  "verification_read",
  "command_rejected",
  "failure_simulated",
  "health_checked",
] as const;

export const FAKE_DEVICE_EVENT_STATUSES = [
  "ok",
  "planned",
  "rejected",
  "partial_success",
  "failed",
  "checked",
] as const;

export type FakeDeviceEventType = (typeof FAKE_DEVICE_EVENT_TYPES)[number];
export type FakeDeviceEventStatus = (typeof FAKE_DEVICE_EVENT_STATUSES)[number];

export interface FakeDeviceEvent {
  readonly event_id: string;
  readonly event_type: FakeDeviceEventType;
  readonly timestamp: number;
  readonly adapter_id: string;
  readonly adapter_kind: AdapterKind;
  readonly room_id: string | null;
  readonly profile_id: string | null;
  readonly device_id: string | null;
  readonly sensor_id: string | null;
  readonly capability: Capability | null;
  readonly command_id: string | null;
  readonly plan_id: string | null;
  readonly result_status: FakeDeviceEventStatus;
  readonly failure_class: RoomAdapterFailureClass | null;
  readonly provenance: RoomAdapterProvenance | null;
  readonly fake_only: true;
  readonly local_only: true;
  readonly metadata_only: true;
  readonly redacted: true;
  readonly raw_payload_included: false;
  readonly secrets_included: false;
  readonly persisted: false;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly ui_rendered: false;
  readonly provider_called: false;
}

export interface FakeDeviceEventInput {
  readonly event_type: FakeDeviceEventType;
  readonly adapter_id: string;
  readonly adapter_kind?: AdapterKind;
  readonly room_id?: string | null;
  readonly profile_id?: string | null;
  readonly device_id?: string | null;
  readonly sensor_id?: string | null;
  readonly capability?: Capability | null;
  readonly command_id?: string | null;
  readonly plan_id?: string | null;
  readonly result_status: FakeDeviceEventStatus;
  readonly failure_class?: RoomAdapterFailureClass | null;
  readonly provenance?: RoomAdapterProvenance | null;
}

export class FakeDeviceEventEmitter {
  private sequence = 0;
  private readonly events: FakeDeviceEvent[] = [];

  emit(input: FakeDeviceEventInput): FakeDeviceEvent {
    this.sequence += 1;
    const event: FakeDeviceEvent = {
      event_id: `fake-event-${this.sequence.toString().padStart(6, "0")}`,
      event_type: input.event_type,
      timestamp: this.sequence,
      adapter_id: input.adapter_id,
      adapter_kind: input.adapter_kind ?? "fake",
      room_id: input.room_id ?? null,
      profile_id: input.profile_id ?? null,
      device_id: input.device_id ?? null,
      sensor_id: input.sensor_id ?? null,
      capability: input.capability ?? null,
      command_id: input.command_id ?? null,
      plan_id: input.plan_id ?? null,
      result_status: input.result_status,
      failure_class: input.failure_class ?? null,
      provenance: input.provenance ? clone(input.provenance) : null,
      fake_only: true,
      local_only: true,
      metadata_only: true,
      redacted: true,
      raw_payload_included: false,
      secrets_included: false,
      persisted: false,
      network_called: false,
      hardware_io_performed: false,
      ui_rendered: false,
      provider_called: false,
    };
    this.events.push(event);
    return clone(event);
  }

  snapshot(): FakeDeviceEvent[] {
    return clone(this.events);
  }

  clear(): void {
    this.events.length = 0;
    this.sequence = 0;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
