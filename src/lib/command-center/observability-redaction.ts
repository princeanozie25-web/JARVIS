import { z } from "zod";

import {
  COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES,
  CommandCenterObservabilityQueryRequestSchema,
  createCommandCenterObservabilityResponseEnvelope,
  type CommandCenterObservabilityPayloadItem,
  type CommandCenterObservabilityQueryCategory,
  type CommandCenterObservabilityQueryRequest,
  type CommandCenterObservabilityResponseEnvelope,
} from "./observability-contract";
import { COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS } from "./screens";

export const COMMAND_CENTER_OBSERVABILITY_ALLOWED_METADATA_FIELD_CLASSES = [
  "binned_counts",
  "latency_bands",
  "confidence_bands",
  "cost_bins",
  "status_classes",
  "error_classes",
  "gate_decisions",
  "hashes",
  "redacted_ids",
  "timestamps",
  "schedule_metadata",
  "routine_ids",
  "capability_ids",
  "provider_ids",
  "subsystem_ids",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES = [
  ...COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
  "raw_tool_args",
  "raw_camera_frame",
  "raw_frame_thumbnail",
  "document_body",
  "password",
  "unredacted_suggestion_body",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_PAYLOAD_SAFETY_REASONS = [
  "metadata_only_payload",
  "forbidden_raw_field",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES = [
  "traces",
  "governance_boundaries",
  "runtime_dependencies",
] as const satisfies readonly CommandCenterObservabilityQueryCategory[];

export const CommandCenterObservabilityAllowedMetadataFieldClassSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_ALLOWED_METADATA_FIELD_CLASSES,
);
export const CommandCenterObservabilityForbiddenRawFieldClassSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
);
export const CommandCenterObservabilityPayloadSafetyReasonSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_PAYLOAD_SAFETY_REASONS,
);
export const CommandCenterObservabilityReplayCompatibleCategorySchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES,
);

export const CommandCenterObservabilityPayloadSafetyValidationSchema =
  z.strictObject({
    passed: z.boolean(),
    reason: CommandCenterObservabilityPayloadSafetyReasonSchema,
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    replay_safe_candidate: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type CommandCenterObservabilityAllowedMetadataFieldClass = z.infer<
  typeof CommandCenterObservabilityAllowedMetadataFieldClassSchema
>;
export type CommandCenterObservabilityForbiddenRawFieldClass = z.infer<
  typeof CommandCenterObservabilityForbiddenRawFieldClassSchema
>;
export type CommandCenterObservabilityPayloadSafetyReason = z.infer<
  typeof CommandCenterObservabilityPayloadSafetyReasonSchema
>;
export type CommandCenterObservabilityReplayCompatibleCategory = z.infer<
  typeof CommandCenterObservabilityReplayCompatibleCategorySchema
>;
export type CommandCenterObservabilityPayloadSafetyValidation = z.infer<
  typeof CommandCenterObservabilityPayloadSafetyValidationSchema
>;

export function validateObservabilityPayloadSafety(
  payload: unknown,
): CommandCenterObservabilityPayloadSafetyValidation {
  const withheld = new Set<string>();
  const notes = new Set<string>();
  const scan = scanPayload(payload, [], new WeakSet<object>());

  for (const field of scan.forbiddenFields) {
    withheld.add(field);
  }
  for (const note of scan.notes) {
    notes.add(note);
  }

  const reason: CommandCenterObservabilityPayloadSafetyReason =
    scan.forbiddenFields.length > 0
      ? "forbidden_raw_field"
      : scan.nonSerializable
        ? "non_serializable_value"
        : scan.unsafeShape
          ? "unsafe_payload_shape"
          : "metadata_only_payload";
  const passed = reason === "metadata_only_payload";

  return CommandCenterObservabilityPayloadSafetyValidationSchema.parse({
    passed,
    reason,
    withheld_fields: [...withheld],
    notes: notes.size > 0 ? [...notes] : ["payload_metadata_only"],
    metadata_only: true,
    render_safe: passed,
    replay_safe_candidate: passed,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
  });
}

export function wrapObservabilityResponse(input: {
  request: CommandCenterObservabilityQueryRequest;
  payload: unknown;
  generated_at?: number;
}): CommandCenterObservabilityResponseEnvelope {
  const request = CommandCenterObservabilityQueryRequestSchema.parse(
    input.request,
  );
  const validation = validateObservabilityPayloadSafety(input.payload);
  const replaySafe =
    validation.passed && isReplayCompatibleCategory(request.category);

  return createCommandCenterObservabilityResponseEnvelope({
    query_id: request.query_id,
    category: request.category,
    generated_at: input.generated_at ?? 0,
    redaction_status: validation.passed ? "metadata_only" : "fully_withheld",
    payload: validation.passed
      ? normalizePayloadItems(input.payload, request.category)
      : [],
    withheld_fields: validation.withheld_fields,
    truncated: !validation.passed,
    replay_safe: replaySafe,
    render_safe: validation.passed,
  });
}

function isReplayCompatibleCategory(
  category: CommandCenterObservabilityQueryCategory,
): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES as readonly string[]
  ).includes(category);
}

function normalizePayloadItems(
  payload: unknown,
  category: CommandCenterObservabilityQueryCategory,
): CommandCenterObservabilityPayloadItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    const itemId =
      "item_id" in record && typeof record.item_id === "string"
        ? record.item_id
        : `${category}:item:${index}`;
    const itemClass =
      "item_class" in record && typeof record.item_class === "string"
        ? record.item_class
        : "metadata_summary";
    const status =
      "status" in record && typeof record.status === "string"
        ? record.status
        : undefined;
    const countBand =
      "count_band" in record && isCountBand(record.count_band)
        ? record.count_band
        : undefined;

    return {
      item_id: itemId,
      item_class: itemClass,
      status,
      count_band: countBand,
      redaction_status: "metadata_only",
      metadata_only: true,
      raw_payload_included: false,
    };
  });
}

function isCountBand(
  input: unknown,
): input is CommandCenterObservabilityPayloadItem["count_band"] {
  return (
    input === "none" ||
    input === "low" ||
    input === "medium" ||
    input === "high" ||
    input === "unknown"
  );
}

interface PayloadScanResult {
  forbiddenFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanPayload(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): PayloadScanResult {
  const result: PayloadScanResult = {
    forbiddenFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("payload_missing");
    return result;
  }
  if (
    typeof input === "function" ||
    typeof input === "symbol" ||
    typeof input === "bigint"
  ) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable:${path.join(".") || "root"}`);
    return result;
  }
  if (input === null || typeof input !== "object") {
    return result;
  }
  if (seen.has(input)) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable_cycle:${path.join(".") || "root"}`);
    return result;
  }
  seen.add(input);

  if (input instanceof Date) {
    return result;
  }
  if (
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    result.unsafeShape = true;
    result.notes.push(`unsafe_object:${path.join(".") || "root"}`);
    return result;
  }

  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  for (const [key, value] of entries) {
    if (isForbiddenRawPayloadField(key)) {
      result.forbiddenFields.push([...path, key].join("."));
    }
    const child = scanPayload(value, [...path, key], seen);
    result.forbiddenFields.push(...child.forbiddenFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }

  return result;
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
  ).includes(key);
}

export function listCommandCenterObservabilityReplayCompatibleCategories(): CommandCenterObservabilityReplayCompatibleCategory[] {
  return [...COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES];
}

export function listCommandCenterObservabilityAllowedCategories(): CommandCenterObservabilityQueryCategory[] {
  return [...COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES];
}
