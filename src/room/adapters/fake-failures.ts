import type { RoomAdapterFailureClass } from "./contract";
import type { DeviceState, SensorState } from "../types";

export const FAKE_DEVICE_FAILURE_MODES = [
  "offline",
  "stale",
  "timeout",
  "auth_error",
  "partial_success",
] as const;

export type FakeDeviceFailureMode = (typeof FAKE_DEVICE_FAILURE_MODES)[number];

export type BlockingFakeFailureMode = Exclude<
  FakeDeviceFailureMode,
  "stale" | "partial_success"
>;

export const FAKE_FAILURE_MODE_CLASSES = {
  offline: "adapter_unavailable",
  timeout: "timeout",
  auth_error: "auth_error",
  partial_success: "partial_success",
} as const satisfies Record<
  Exclude<FakeDeviceFailureMode, "stale">,
  RoomAdapterFailureClass
>;

export interface FakeFailureSeed {
  readonly mode: FakeDeviceFailureMode;
  readonly targetId?: string;
}

export interface FakeFailureSnapshot {
  readonly mode: FakeDeviceFailureMode;
  readonly targetId: string | null;
}

const GLOBAL_TARGET = "*";
const BLOCKING_PRIORITY: readonly BlockingFakeFailureMode[] = [
  "offline",
  "timeout",
  "auth_error",
];

export class FakeFailureController {
  private readonly modesByTarget = new Map<
    string,
    Set<FakeDeviceFailureMode>
  >();

  constructor(seeds: readonly FakeFailureSeed[] = []) {
    for (const seed of seeds) this.enable(seed.mode, seed.targetId);
  }

  enable(mode: FakeDeviceFailureMode, targetId?: string): void {
    const key = targetId ?? GLOBAL_TARGET;
    const modes =
      this.modesByTarget.get(key) ?? new Set<FakeDeviceFailureMode>();
    modes.add(mode);
    this.modesByTarget.set(key, modes);
  }

  clear(mode?: FakeDeviceFailureMode, targetId?: string): void {
    const key = targetId ?? GLOBAL_TARGET;
    if (!mode) {
      this.modesByTarget.delete(key);
      return;
    }
    const modes = this.modesByTarget.get(key);
    if (!modes) return;
    modes.delete(mode);
    if (modes.size === 0) this.modesByTarget.delete(key);
  }

  clearAll(): void {
    this.modesByTarget.clear();
  }

  firstBlockingFailure(targetId?: string): BlockingFakeFailureMode | null {
    const active = this.activeModeSet(targetId);
    return BLOCKING_PRIORITY.find((mode) => active.has(mode)) ?? null;
  }

  isStale(targetId?: string): boolean {
    return this.activeModeSet(targetId).has("stale");
  }

  allowsPartialSuccess(targetId?: string): boolean {
    return this.activeModeSet(targetId).has("partial_success");
  }

  snapshot(): FakeFailureSnapshot[] {
    return [...this.modesByTarget.entries()]
      .flatMap(([target, modes]) =>
        [...modes].map((mode) => ({
          mode,
          targetId: target === GLOBAL_TARGET ? null : target,
        })),
      )
      .sort((a, b) =>
        `${a.targetId ?? ""}:${a.mode}`.localeCompare(
          `${b.targetId ?? ""}:${b.mode}`,
        ),
      );
  }

  private activeModeSet(targetId?: string): Set<FakeDeviceFailureMode> {
    return new Set([
      ...(this.modesByTarget.get(GLOBAL_TARGET) ?? []),
      ...(targetId ? (this.modesByTarget.get(targetId) ?? []) : []),
    ]);
  }
}

export function fakeFailureClassFor(
  mode: Exclude<FakeDeviceFailureMode, "stale">,
): RoomAdapterFailureClass {
  return FAKE_FAILURE_MODE_CLASSES[mode];
}

export function fakeBlockingFailureClassFor(
  mode: BlockingFakeFailureMode,
): "adapter_unavailable" | "timeout" | "auth_error" {
  return FAKE_FAILURE_MODE_CLASSES[mode];
}

export function markFakeStateStale<T extends DeviceState | SensorState>(
  state: T,
): T {
  return {
    ...clone(state),
    freshness: {
      ...state.freshness,
      observed_at_ms: 0,
      stale_after_ms: 1,
      expires_at_ms: 1,
      source: "mock",
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
