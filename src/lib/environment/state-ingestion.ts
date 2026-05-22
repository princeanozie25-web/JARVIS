import {
  PassiveEnvironmentStateRecordSchema,
  validatePassiveEnvironmentStateRecord,
  type PassiveEnvironmentStateRecord,
  type PassiveEnvironmentStateValidationResult,
} from "./state";
import type { EnvironmentRegistry } from "./types";

export const PASSIVE_ENVIRONMENT_ADAPTER_KINDS = ["fake_local_test"] as const;

export const PASSIVE_ENVIRONMENT_INGEST_STATUSES = [
  "accepted",
  "rejected",
  "ignored",
  "unknown",
] as const;

export type PassiveEnvironmentAdapterKind =
  (typeof PASSIVE_ENVIRONMENT_ADAPTER_KINDS)[number];
export type PassiveEnvironmentIngestStatus =
  (typeof PASSIVE_ENVIRONMENT_INGEST_STATUSES)[number];

export interface PassiveEnvironmentStateAdapterReadResult {
  adapterId: string;
  adapterKind: PassiveEnvironmentAdapterKind;
  enabled: boolean;
  metadataOnly: true;
  localOnly: true;
  testOnly: true;
  physicalSideEffects: false;
  commandsIssued: 0;
  policyMutations: 0;
  presenceInference: false;
  telemetryEmitted: false;
  readings: unknown[];
}

export interface PassiveEnvironmentStateAdapter {
  id: string;
  kind: PassiveEnvironmentAdapterKind;
  enabled: boolean;
  metadataOnly: true;
  localOnly: true;
  testOnly: true;
  read(): PassiveEnvironmentStateAdapterReadResult;
}

export type PassiveEnvironmentIngestItemResult =
  | {
      status: "accepted";
      record: PassiveEnvironmentStateRecord;
      metadataOnly: true;
      physicalSideEffects: false;
    }
  | {
      status: "rejected";
      reason: Exclude<
        NonNullable<PassiveEnvironmentStateValidationResult["reason"]>,
        never
      >;
      metadataOnly: true;
      physicalSideEffects: false;
    }
  | {
      status: "ignored";
      reason: "adapter_disabled";
      metadataOnly: true;
      physicalSideEffects: false;
    }
  | {
      status: "unknown";
      reason: "no_readings";
      metadataOnly: true;
      physicalSideEffects: false;
    };

export interface PassiveEnvironmentIngestResult {
  adapterId: string;
  adapterKind: PassiveEnvironmentAdapterKind;
  adapterEnabled: boolean;
  status: PassiveEnvironmentIngestStatus;
  accepted: PassiveEnvironmentStateRecord[];
  itemResults: PassiveEnvironmentIngestItemResult[];
  metadataOnly: true;
  localOnly: true;
  testOnly: true;
  physicalSideEffects: false;
  commandsIssued: 0;
  policyMutations: 0;
  presenceInference: false;
  telemetryEmitted: false;
}

export interface FakePassiveEnvironmentStateAdapterInput {
  id?: string;
  enabled?: boolean;
  readings?: unknown[];
}

function adapterReadResult(input: {
  adapterId: string;
  enabled: boolean;
  readings: unknown[];
}): PassiveEnvironmentStateAdapterReadResult {
  return {
    adapterId: input.adapterId,
    adapterKind: "fake_local_test",
    enabled: input.enabled,
    metadataOnly: true,
    localOnly: true,
    testOnly: true,
    physicalSideEffects: false,
    commandsIssued: 0,
    policyMutations: 0,
    presenceInference: false,
    telemetryEmitted: false,
    readings: input.enabled ? input.readings : [],
  };
}

export function createFakePassiveEnvironmentStateAdapter(
  input: FakePassiveEnvironmentStateAdapterInput = {},
): PassiveEnvironmentStateAdapter {
  const adapterId = input.id?.trim() || "fake-local-passive-state";
  const enabled = input.enabled === true;
  const readings = input.readings ?? [];

  return {
    id: adapterId,
    kind: "fake_local_test",
    enabled,
    metadataOnly: true,
    localOnly: true,
    testOnly: true,
    read() {
      return adapterReadResult({
        adapterId,
        enabled,
        readings,
      });
    },
  };
}

function acceptedResult(
  record: PassiveEnvironmentStateRecord,
): PassiveEnvironmentIngestItemResult {
  return {
    status: "accepted",
    record,
    metadataOnly: true,
    physicalSideEffects: false,
  };
}

function rejectedResult(
  reason: NonNullable<PassiveEnvironmentStateValidationResult["reason"]>,
): PassiveEnvironmentIngestItemResult {
  return {
    status: "rejected",
    reason,
    metadataOnly: true,
    physicalSideEffects: false,
  };
}

function ignoredResult(): PassiveEnvironmentIngestItemResult {
  return {
    status: "ignored",
    reason: "adapter_disabled",
    metadataOnly: true,
    physicalSideEffects: false,
  };
}

function unknownResult(): PassiveEnvironmentIngestItemResult {
  return {
    status: "unknown",
    reason: "no_readings",
    metadataOnly: true,
    physicalSideEffects: false,
  };
}

function aggregateStatus(
  itemResults: PassiveEnvironmentIngestItemResult[],
): PassiveEnvironmentIngestStatus {
  if (itemResults.some((item) => item.status === "accepted")) {
    return "accepted";
  }
  if (itemResults.some((item) => item.status === "rejected")) {
    return "rejected";
  }
  if (itemResults.some((item) => item.status === "ignored")) {
    return "ignored";
  }
  return "unknown";
}

export function ingestPassiveEnvironmentState(input: {
  registry: EnvironmentRegistry;
  adapter: PassiveEnvironmentStateAdapter;
}): PassiveEnvironmentIngestResult {
  const adapterOutput = input.adapter.read();
  let itemResults: PassiveEnvironmentIngestItemResult[];

  if (!adapterOutput.enabled) {
    itemResults = [ignoredResult()];
  } else if (adapterOutput.readings.length === 0) {
    itemResults = [unknownResult()];
  } else {
    itemResults = adapterOutput.readings.map((reading) => {
      const parsed = PassiveEnvironmentStateRecordSchema.safeParse(reading);
      if (!parsed.success) return rejectedResult("invalid_shape");

      const validation = validatePassiveEnvironmentStateRecord(
        input.registry,
        parsed.data,
      );
      if (!validation.ok || !validation.record) {
        return rejectedResult(validation.reason ?? "invalid_shape");
      }

      return acceptedResult(validation.record);
    });
  }

  return {
    adapterId: adapterOutput.adapterId,
    adapterKind: adapterOutput.adapterKind,
    adapterEnabled: adapterOutput.enabled,
    status: aggregateStatus(itemResults),
    accepted: itemResults.flatMap((item) =>
      item.status === "accepted" ? [item.record] : [],
    ),
    itemResults,
    metadataOnly: true,
    localOnly: true,
    testOnly: true,
    physicalSideEffects: false,
    commandsIssued: 0,
    policyMutations: 0,
    presenceInference: false,
    telemetryEmitted: false,
  };
}
