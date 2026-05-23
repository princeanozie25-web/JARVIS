import { z } from "zod";

import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const COMMAND_CENTER_RENDER_SAFE_METADATA_FIELDS = [
  "heartbeat_status",
  "load_band",
  "last_event_class",
  "governance_posture",
  "kill_switch_display_state",
  "slot_id",
  "slot_status",
  "count_band",
  "redaction_status",
  "mode",
] as const;

export const COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS = [
  "raw_prompt",
  "prompt",
  "raw_model_output",
  "model_output",
  "raw_tool_arguments",
  "tool_arguments",
  "raw_ocr_text",
  "ocr_text",
  "raw_screenshot",
  "screenshot",
  "raw_frame",
  "frame",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_audio",
  "audio",
  "project_file_body",
  "file_body",
  "memory_content",
  "memory_contents",
  "secret",
  "api_key",
  "token",
  "exact_pii",
] as const;

export const COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS = [
  "on_execute",
  "execute",
  "run",
  "retry",
  "replay",
  "on_retry",
  "on_replay",
  "tool_call_hook",
  "approval_hook",
  "routine_hook",
  "on_approve",
  "on_schedule_routine",
  "on_tool_call",
] as const;

export const COMMAND_CENTER_WORKING_PANEL_SLOTS = [
  "router",
  "tool_calls",
  "approvals",
  "costs",
  "safety",
  "vision",
  "environment",
  "projects",
  "routines",
  "suggestions",
] as const;

export const COMMAND_CENTER_AUDIT_VIEWER_SLOTS = [
  "trace_timeline",
  "replay_viewer",
  "governance_boundary_viewer",
  "runtime_dependency_viewer",
] as const;

export const COMMAND_CENTER_SCREEN_CONTRACT_VIOLATIONS = [
  "raw_payload_field_present",
  "mutating_hook_field_present",
  "schema_rejected",
  "not_serializable",
] as const;

export const CommandCenterRenderSafeMetadataFieldSchema = z.enum(
  COMMAND_CENTER_RENDER_SAFE_METADATA_FIELDS,
);
export const CommandCenterForbiddenRenderPayloadFieldSchema = z.enum(
  COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
);
export const CommandCenterForbiddenScreenHookFieldSchema = z.enum(
  COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
);
export const CommandCenterWorkingPanelSlotSchema = z.enum(
  COMMAND_CENTER_WORKING_PANEL_SLOTS,
);
export const CommandCenterAuditViewerSlotSchema = z.enum(
  COMMAND_CENTER_AUDIT_VIEWER_SLOTS,
);
export const CommandCenterScreenContractViolationSchema = z.enum(
  COMMAND_CENTER_SCREEN_CONTRACT_VIOLATIONS,
);

export const CommandCenterRenderSafeMetadataAllowlistSchema = z.strictObject({
  kind: z.literal("command_center.render_safe_metadata_allowlist"),
  version: z.literal(1),
  allowed_fields: z.array(CommandCenterRenderSafeMetadataFieldSchema),
  forbidden_payload_fields: z.array(
    CommandCenterForbiddenRenderPayloadFieldSchema,
  ),
  metadata_only: z.literal(true),
  raw_payloads_allowed: z.literal(false),
  exact_pii_allowed: z.literal(false),
});

export const RestScreenViewModelSchema = z.strictObject({
  kind: z.literal("command_center.rest_screen_view_model"),
  heartbeat_status: z.enum(["unknown", "quiet", "alive", "degraded"]),
  load_band: z.enum(["unknown", "low", "medium", "high"]),
  last_event_class: z.enum([
    "none",
    "user_input",
    "system_metadata",
    "policy_status",
    "safety_status",
  ]),
  governance_posture: z.enum(["unknown", "normal", "guarded", "locked"]),
  kill_switch_display_state: z.enum(["unknown", "available", "engaged"]),
  metadata_only: z.literal(true),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
});

export const CommandCenterPanelSlotDescriptorSchema = z.strictObject({
  slot_id: CommandCenterWorkingPanelSlotSchema,
  slot_status: z.enum(["placeholder", "empty", "unavailable"]),
  label: z.string().trim().min(1).max(80),
  implementation_wired: z.literal(false),
  executable: z.literal(false),
  can_call_tool: z.literal(false),
  can_request_approval: z.literal(false),
  can_schedule_routine: z.literal(false),
  metadata_only: z.literal(true),
});

export const WorkingScreenViewModelSchema = z.strictObject({
  kind: z.literal("command_center.working_screen_view_model"),
  panel_slots: z
    .array(CommandCenterPanelSlotDescriptorSchema)
    .length(COMMAND_CENTER_WORKING_PANEL_SLOTS.length),
  panel_implementation_wired: z.literal(false),
  metadata_only: z.literal(true),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
});

export const CommandCenterAuditViewerSlotDescriptorSchema = z.strictObject({
  slot_id: CommandCenterAuditViewerSlotSchema,
  slot_status: z.enum(["placeholder", "empty", "unavailable"]),
  label: z.string().trim().min(1).max(80),
  renderer_wired: z.literal(false),
  executable: z.literal(false),
  can_retry: z.literal(false),
  can_replay_execute: z.literal(false),
  can_call_tool: z.literal(false),
  metadata_only: z.literal(true),
});

export const AuditScreenViewModelSchema = z.strictObject({
  kind: z.literal("command_center.audit_screen_view_model"),
  viewer_slots: z
    .array(CommandCenterAuditViewerSlotDescriptorSchema)
    .length(COMMAND_CENTER_AUDIT_VIEWER_SLOTS.length),
  viewer_rendering_wired: z.literal(false),
  replay_execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
});

const ScreenDescriptorBaseSchema = CommandCenterSideEffectSnapshotSchema.extend(
  {
    phase: z.literal("9A2"),
    presentation_only: z.literal(true),
    render_contract_only: z.literal(true),
    authority_surface: z.literal(false),
    mutating_callbacks_allowed: z.literal(false),
    tool_call_hooks_allowed: z.literal(false),
    approval_hooks_allowed: z.literal(false),
    routine_hooks_allowed: z.literal(false),
    raw_payloads_allowed: z.literal(false),
    exact_pii_allowed: z.literal(false),
  },
);

export const RestScreenDescriptorSchema = ScreenDescriptorBaseSchema.extend({
  kind: z.literal("command_center.rest_screen_descriptor"),
  mode: z.literal("rest"),
  view_model: RestScreenViewModelSchema,
});

export const WorkingScreenDescriptorSchema = ScreenDescriptorBaseSchema.extend({
  kind: z.literal("command_center.working_screen_descriptor"),
  mode: z.literal("working"),
  view_model: WorkingScreenViewModelSchema,
});

export const AuditScreenDescriptorSchema = ScreenDescriptorBaseSchema.extend({
  kind: z.literal("command_center.audit_screen_descriptor"),
  mode: z.literal("audit"),
  view_model: AuditScreenViewModelSchema,
});

export const CommandCenterScreenDescriptorSchema = z.discriminatedUnion(
  "mode",
  [
    RestScreenDescriptorSchema,
    WorkingScreenDescriptorSchema,
    AuditScreenDescriptorSchema,
  ],
);

export const CommandCenterScreenContractValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    violations: z.array(CommandCenterScreenContractViolationSchema),
    metadata_only: z.literal(true),
    render_contract_only: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutating_callbacks_allowed: z.literal(false),
    tool_call_hooks_allowed: z.literal(false),
    approval_hooks_allowed: z.literal(false),
    routine_hooks_allowed: z.literal(false),
  });

export type CommandCenterRenderSafeMetadataField = z.infer<
  typeof CommandCenterRenderSafeMetadataFieldSchema
>;
export type CommandCenterForbiddenRenderPayloadField = z.infer<
  typeof CommandCenterForbiddenRenderPayloadFieldSchema
>;
export type CommandCenterForbiddenScreenHookField = z.infer<
  typeof CommandCenterForbiddenScreenHookFieldSchema
>;
export type CommandCenterWorkingPanelSlot = z.infer<
  typeof CommandCenterWorkingPanelSlotSchema
>;
export type CommandCenterAuditViewerSlot = z.infer<
  typeof CommandCenterAuditViewerSlotSchema
>;
export type CommandCenterScreenContractViolation = z.infer<
  typeof CommandCenterScreenContractViolationSchema
>;
export type CommandCenterRenderSafeMetadataAllowlist = z.infer<
  typeof CommandCenterRenderSafeMetadataAllowlistSchema
>;
export type RestScreenViewModel = z.infer<typeof RestScreenViewModelSchema>;
export type WorkingScreenViewModel = z.infer<
  typeof WorkingScreenViewModelSchema
>;
export type AuditScreenViewModel = z.infer<typeof AuditScreenViewModelSchema>;
export type CommandCenterPanelSlotDescriptor = z.infer<
  typeof CommandCenterPanelSlotDescriptorSchema
>;
export type CommandCenterAuditViewerSlotDescriptor = z.infer<
  typeof CommandCenterAuditViewerSlotDescriptorSchema
>;
export type RestScreenDescriptor = z.infer<typeof RestScreenDescriptorSchema>;
export type WorkingScreenDescriptor = z.infer<
  typeof WorkingScreenDescriptorSchema
>;
export type AuditScreenDescriptor = z.infer<typeof AuditScreenDescriptorSchema>;
export type CommandCenterScreenDescriptor = z.infer<
  typeof CommandCenterScreenDescriptorSchema
>;
export type CommandCenterScreenContractValidation = z.infer<
  typeof CommandCenterScreenContractValidationSchema
>;

export const DEFAULT_COMMAND_CENTER_RENDER_SAFE_METADATA_ALLOWLIST: CommandCenterRenderSafeMetadataAllowlist =
  CommandCenterRenderSafeMetadataAllowlistSchema.parse({
    kind: "command_center.render_safe_metadata_allowlist",
    version: 1,
    allowed_fields: [...COMMAND_CENTER_RENDER_SAFE_METADATA_FIELDS],
    forbidden_payload_fields: [
      ...COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
    ],
    metadata_only: true,
    raw_payloads_allowed: false,
    exact_pii_allowed: false,
  });

export function createRestScreenViewModel(
  input: Partial<RestScreenViewModel> = {},
): RestScreenViewModel {
  return RestScreenViewModelSchema.parse({
    kind: "command_center.rest_screen_view_model",
    heartbeat_status: "unknown",
    load_band: "unknown",
    last_event_class: "none",
    governance_posture: "unknown",
    kill_switch_display_state: "unknown",
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    ...input,
  });
}

export function createWorkingScreenViewModel(): WorkingScreenViewModel {
  return WorkingScreenViewModelSchema.parse({
    kind: "command_center.working_screen_view_model",
    panel_slots: COMMAND_CENTER_WORKING_PANEL_SLOTS.map((slotId) => ({
      slot_id: slotId,
      slot_status: "placeholder",
      label: labelForSlot(slotId),
      implementation_wired: false,
      executable: false,
      can_call_tool: false,
      can_request_approval: false,
      can_schedule_routine: false,
      metadata_only: true,
    })),
    panel_implementation_wired: false,
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
  });
}

export function createAuditScreenViewModel(): AuditScreenViewModel {
  return AuditScreenViewModelSchema.parse({
    kind: "command_center.audit_screen_view_model",
    viewer_slots: COMMAND_CENTER_AUDIT_VIEWER_SLOTS.map((slotId) => ({
      slot_id: slotId,
      slot_status: "placeholder",
      label: labelForSlot(slotId),
      renderer_wired: false,
      executable: false,
      can_retry: false,
      can_replay_execute: false,
      can_call_tool: false,
      metadata_only: true,
    })),
    viewer_rendering_wired: false,
    replay_execution_enabled: false,
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
  });
}

export function createRestScreenDescriptor(
  viewModel: RestScreenViewModel = createRestScreenViewModel(),
): RestScreenDescriptor {
  return RestScreenDescriptorSchema.parse({
    kind: "command_center.rest_screen_descriptor",
    phase: "9A2",
    mode: "rest",
    view_model: viewModel,
    ...screenContractFlags(),
  });
}

export function createWorkingScreenDescriptor(
  viewModel: WorkingScreenViewModel = createWorkingScreenViewModel(),
): WorkingScreenDescriptor {
  return WorkingScreenDescriptorSchema.parse({
    kind: "command_center.working_screen_descriptor",
    phase: "9A2",
    mode: "working",
    view_model: viewModel,
    ...screenContractFlags(),
  });
}

export function createAuditScreenDescriptor(
  viewModel: AuditScreenViewModel = createAuditScreenViewModel(),
): AuditScreenDescriptor {
  return AuditScreenDescriptorSchema.parse({
    kind: "command_center.audit_screen_descriptor",
    phase: "9A2",
    mode: "audit",
    view_model: viewModel,
    ...screenContractFlags(),
  });
}

export function validateCommandCenterScreenDescriptor(
  input: unknown,
): CommandCenterScreenContractValidation {
  const violations = new Set<CommandCenterScreenContractViolation>();

  if (
    containsForbiddenKey(input, COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS)
  ) {
    violations.add("raw_payload_field_present");
  }
  if (
    containsForbiddenKey(input, COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS)
  ) {
    violations.add("mutating_hook_field_present");
  }
  if (containsFunction(input)) {
    violations.add("not_serializable");
  }

  const parsed = CommandCenterScreenDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    violations.add("schema_rejected");
  }

  return CommandCenterScreenContractValidationSchema.parse({
    passed: violations.size === 0,
    violations: [...violations],
    metadata_only: true,
    render_contract_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutating_callbacks_allowed: false,
    tool_call_hooks_allowed: false,
    approval_hooks_allowed: false,
    routine_hooks_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function screenContractFlags(): Omit<
  RestScreenDescriptor,
  "kind" | "phase" | "mode" | "view_model"
> {
  return {
    presentation_only: true,
    render_contract_only: true,
    authority_surface: false,
    mutating_callbacks_allowed: false,
    tool_call_hooks_allowed: false,
    approval_hooks_allowed: false,
    routine_hooks_allowed: false,
    raw_payloads_allowed: false,
    exact_pii_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  };
}

function labelForSlot(
  slotId: CommandCenterWorkingPanelSlot | CommandCenterAuditViewerSlot,
): string {
  return slotId
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function containsForbiddenKey(
  input: unknown,
  forbiddenKeys: readonly string[],
): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  if (Array.isArray(input)) {
    return input.some((item) => containsForbiddenKey(item, forbiddenKeys));
  }

  for (const [key, value] of Object.entries(input)) {
    if (forbiddenKeys.includes(key)) {
      return true;
    }
    if (containsForbiddenKey(value, forbiddenKeys)) {
      return true;
    }
  }

  return false;
}

function containsFunction(input: unknown): boolean {
  if (typeof input === "function") {
    return true;
  }
  if (!input || typeof input !== "object") {
    return false;
  }
  if (Array.isArray(input)) {
    return input.some((item) => containsFunction(item));
  }
  return Object.values(input).some((value) => containsFunction(value));
}
