import { expect } from "vitest";

import { FakeRoomAdapter } from "../../../src/room/adapters/fake-room-adapter";
import { loadDefaultRoomRegistry } from "../../../src/room/registry";
import type { FakeDeviceFailureMode } from "../../../src/room/adapters/fake-failures";
import type {
  RoomAdapterCommand,
  RoomAdapterCommandMode,
  RoomAdapterContract,
  RoomAdapterExecutionContext,
} from "../../../src/room/adapters/contract";
import type { Capability } from "../../../src/room/types";

export interface AdapterConformanceSubject {
  readonly name: string;
  readonly create: () => RoomAdapterContract & {
    enableFailure?: (mode: FakeDeviceFailureMode, targetId?: string) => void;
    clearAllFailures?: () => void;
    getEvents?: () => readonly {
      readonly result_status: string;
      readonly failure_class: string | null;
      readonly network_called: false;
      readonly hardware_io_performed: false;
      readonly persisted: false;
      readonly metadata_only: true;
      readonly compensation_available: boolean;
      readonly compensation_requires_future_approval: boolean;
      readonly compensation_executed: false;
    }[];
  };
  readonly devices: {
    readonly power: string;
    readonly dim: string;
    readonly color: string;
    readonly temperature: string;
  };
}

export const fakeRoomAdapterSubject: AdapterConformanceSubject = {
  name: "FakeRoomAdapter",
  create: () =>
    new FakeRoomAdapter({ profile: loadDefaultRoomRegistry().getProfile() }),
  devices: {
    power: "desk_lamp",
    dim: "desk_lamp",
    color: "led_strip",
    temperature: "desk_lamp",
  },
};

export const conformanceSubjects = [fakeRoomAdapterSubject] as const;

export function readContext(): RoomAdapterExecutionContext {
  return { mode: "read_only", timeoutMs: 5_000 };
}

export function dryRunContext(): RoomAdapterExecutionContext {
  return { mode: "dry_run", timeoutMs: 5_000 };
}

export function approvedContext(
  approvalId = "approval-conformance-1",
): RoomAdapterExecutionContext {
  return {
    mode: "approved_execution",
    timeoutMs: 5_000,
    approvalId,
  };
}

export function approval(required = true) {
  return {
    required,
    policy_id: required ? "fake-room-approval-policy" : null,
    reason: required
      ? "Fake mutating command requires approval metadata."
      : null,
    dry_run_required: true,
    auto_approval_allowed: false,
    voice_only_approval_allowed: false,
  } as const;
}

export function roomCommand(input: {
  readonly commandId?: string;
  readonly mode?: RoomAdapterCommandMode;
  readonly deviceId: string;
  readonly capability: Capability;
  readonly value: boolean | number | string | null;
}): RoomAdapterCommand {
  return {
    command_id: input.commandId ?? `command-${input.deviceId}`,
    mode: input.mode ?? "dry_run",
    device_id: input.deviceId,
    capability: input.capability,
    action: actionForCapability(input.capability),
    value: input.value,
    one_command_one_action: true,
    approval: approval(true),
    timeout_ms: 5_000,
    cancellation_supported: true,
  };
}

export async function readState(
  adapter: RoomAdapterContract,
  deviceId: string,
  capability: Capability = "power.observe",
) {
  return adapter.readState({
    deviceId,
    capability,
    context: readContext(),
  });
}

export async function executeApproved(
  adapter: RoomAdapterContract,
  command: RoomAdapterCommand,
) {
  return adapter.executeCommand({
    command: { ...command, mode: "approved_execution" },
    context: approvedContext(),
  });
}

export async function planDryRun(
  adapter: RoomAdapterContract,
  command: RoomAdapterCommand,
) {
  return adapter.planCommand({
    command: { ...command, mode: "dry_run" },
    context: dryRunContext(),
  });
}

export function expectNoSideEffects(result: {
  readonly hardware_io_performed: false;
  readonly network_called: false;
  readonly persisted: false;
  readonly ui_rendered?: false;
}) {
  expect(result).toMatchObject({
    hardware_io_performed: false,
    network_called: false,
    persisted: false,
  });
  if ("ui_rendered" in result) expect(result.ui_rendered).toBe(false);
}

export function enableFailure(
  subject: ReturnType<AdapterConformanceSubject["create"]>,
  mode: "offline" | "stale" | "timeout" | "auth_error" | "partial_success",
  targetId: string,
) {
  if (!subject.enableFailure) {
    throw new Error("Conformance subject does not expose fake failures.");
  }
  subject.enableFailure(mode, targetId);
}

function actionForCapability(
  capability: Capability,
): RoomAdapterCommand["action"] {
  switch (capability) {
    case "power.switch":
      return "set_power";
    case "light.dimmer":
      return "set_brightness";
    case "light.color":
      return "set_color";
    case "light.temperature":
      return "set_temperature";
    default:
      return "read";
  }
}
