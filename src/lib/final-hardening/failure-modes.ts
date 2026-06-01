import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  HardeningSeveritySchema,
  HardeningSurfaceIdSchema,
  type FinalHardeningPosture,
  type HardeningSeverity,
  type HardeningSurfaceId,
} from "./contracts";
import { getHardeningSurfaces } from "./registry";

export const FINAL_FAILURE_MODE_REGISTRY_VERSION = "20F.2" as const;

export const FINAL_FAILURE_MODE_IDS = [
  "final-failure-mode:model-runtime-unavailable",
  "final-failure-mode:local-model-missing",
  "final-failure-mode:provider-disabled-misconfigured",
  "final-failure-mode:cloud-provider-requested-but-disabled",
  "final-failure-mode:sqlite-event-store-unavailable",
  "final-failure-mode:projection-read-failure",
  "final-failure-mode:command-center-startup-failure",
  "final-failure-mode:tauri-binding-startup-failure",
  "final-failure-mode:doctor-bootstrap-failure",
  "final-failure-mode:onboarding-demo-readiness-failure",
  "final-failure-mode:voice-runtime-unavailable",
  "final-failure-mode:vision-runtime-unavailable",
  "final-failure-mode:room-adapter-unavailable",
  "final-failure-mode:fake-room-failure",
  "final-failure-mode:scheduler-disabled-stalled",
  "final-failure-mode:approval-runtime-unavailable",
  "final-failure-mode:red-team-sandbox-disabled-misconfigured",
  "final-failure-mode:telemetry-audit-report-unavailable",
  "final-failure-mode:packaging-build-failure",
  "final-failure-mode:configuration-missing-invalid",
  "final-failure-mode:unsupported-environment-platform",
  "final-failure-mode:disk-memory-constraints",
  "final-failure-mode:local-first-fallback-unavailable",
  "final-failure-mode:unsafe-cloud-fallback-request",
] as const;

export const FAILURE_MODE_CATEGORIES = [
  "model",
  "provider",
  "persistence",
  "command_center",
  "bootstrap",
  "onboarding",
  "voice",
  "vision",
  "room",
  "scheduler",
  "approval",
  "red_team",
  "observability",
  "packaging",
  "configuration",
  "environment",
  "resources",
  "local_first",
] as const;

export const FAILURE_MODE_BLOCKING_POSTURES = [
  "blocks_startup",
  "blocks_surface",
  "warning_only",
  "deferred",
] as const;

export type FinalFailureModeId = (typeof FINAL_FAILURE_MODE_IDS)[number];
export type FailureModeCategory = (typeof FAILURE_MODE_CATEGORIES)[number];
export type FailureModeBlockingPosture =
  (typeof FAILURE_MODE_BLOCKING_POSTURES)[number];

export const FinalFailureModeIdSchema = z.enum(FINAL_FAILURE_MODE_IDS);
export const FailureModeCategorySchema = z.enum(FAILURE_MODE_CATEGORIES);
export const FailureModeBlockingPostureSchema = z.enum(
  FAILURE_MODE_BLOCKING_POSTURES,
);

export const FinalFailureModeRecordSchema = z.strictObject({
  failure_id: FinalFailureModeIdSchema,
  title: z.string().trim().min(1).max(180),
  category: FailureModeCategorySchema,
  hardening_surface_id: HardeningSurfaceIdSchema,
  severity: HardeningSeveritySchema,
  expected_fallback_behavior: z.string().trim().min(1).max(560),
  safe_default: z.string().trim().min(1).max(560),
  user_visible_error_posture: z.string().trim().min(1).max(560),
  audit_log_posture: z.string().trim().min(1).max(560),
  recovery_guidance: z.array(z.string().trim().min(1).max(260)).min(1),
  blocking_posture: FailureModeBlockingPostureSchema,
  deferred_limitation_posture: z.string().trim().min(1).max(560),
  posture: FinalHardeningPostureSchema,
});

export const FinalFailureModeRegistrySchema = z.array(
  FinalFailureModeRecordSchema,
);

export const FinalFailureModeSummarySchema = z.strictObject({
  registry_version: z.literal(FINAL_FAILURE_MODE_REGISTRY_VERSION),
  failure_mode_count: z.number().int().positive(),
  category_count: z.number().int().positive(),
  represented_surface_count: z.number().int().positive(),
  critical_count: z.number().int().nonnegative(),
  high_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  low_count: z.number().int().nonnegative(),
  blocking_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  recovery_guidance_count: z.number().int().nonnegative(),
  phase20f_registry_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export type FinalFailureModeRecord = z.infer<
  typeof FinalFailureModeRecordSchema
>;
export type FinalFailureModeSummary = z.infer<
  typeof FinalFailureModeSummarySchema
>;

const POSTURE: FinalHardeningPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  hardening_execution_enabled: false,
  filesystem_inspection_enabled: false,
  runtime_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  shell_process_execution_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function record(
  failureId: FinalFailureModeId,
  title: string,
  category: FailureModeCategory,
  hardeningSurfaceId: HardeningSurfaceId,
  severity: HardeningSeverity,
  blockingPosture: FailureModeBlockingPosture,
  expectedFallbackBehavior: string,
  safeDefault: string,
  userVisibleErrorPosture: string,
  recoveryGuidance: readonly string[],
  deferredLimitationPosture: string,
): FinalFailureModeRecord {
  return FinalFailureModeRecordSchema.parse({
    failure_id: failureId,
    title,
    category,
    hardening_surface_id: hardeningSurfaceId,
    severity,
    expected_fallback_behavior: expectedFallbackBehavior,
    safe_default: safeDefault,
    user_visible_error_posture: userVisibleErrorPosture,
    audit_log_posture:
      "Record metadata-only failure id, category, severity, blocking posture, and recovery posture without source material or raw payload exposure.",
    recovery_guidance: [...recoveryGuidance],
    blocking_posture: blockingPosture,
    deferred_limitation_posture: deferredLimitationPosture,
    posture: POSTURE,
  });
}

const FINAL_FAILURE_MODE_REGISTRY = [
  record(
    "final-failure-mode:model-runtime-unavailable",
    "Model runtime unavailable",
    "model",
    "hardening-surface:model-runtime-unavailable",
    "high",
    "blocks_surface",
    "Disable model-dependent actions and keep local readiness reporting available.",
    "Keep model execution disabled until local runtime readiness is restored.",
    "Show local model runtime unavailable with setup guidance and no provider escalation.",
    ["Review local model readiness", "Use doctor report metadata"],
    "Cloud model fallback remains disabled unless a later opt-in gate explicitly allows it.",
  ),
  record(
    "final-failure-mode:local-model-missing",
    "Local model missing",
    "model",
    "hardening-surface:model-runtime-unavailable",
    "high",
    "blocks_surface",
    "Defer model-backed features and preserve non-model read-only surfaces.",
    "Do not route to cloud providers as an implicit substitute.",
    "Show local model missing with local installation/configuration guidance.",
    ["Review local model contract", "Resolve model availability manually"],
    "Provider fallback remains opt-in and disabled by default.",
  ),
  record(
    "final-failure-mode:provider-disabled-misconfigured",
    "Provider disabled or misconfigured",
    "provider",
    "hardening-surface:provider-disabled-misconfigured",
    "high",
    "blocks_surface",
    "Keep provider access disabled and preserve local-first fallback posture.",
    "Deny provider calls by default.",
    "Show provider disabled or misconfigured without attempting network access.",
    [
      "Review provider configuration posture",
      "Keep provider disabled until configured",
    ],
    "Cloud/provider behavior remains gated and non-default.",
  ),
  record(
    "final-failure-mode:cloud-provider-requested-but-disabled",
    "Cloud provider requested but disabled",
    "provider",
    "hardening-surface:cloud-provider-opt-in-gated",
    "critical",
    "blocks_surface",
    "Reject the cloud request and keep local-first behavior active.",
    "Keep cloud providers disabled unless explicit future opt-in and governance gates pass.",
    "Show cloud provider disabled and explain opt-in/gated posture.",
    ["Review cloud gate policy", "Use local fallback where available"],
    "Cloud fallback remains deferred until explicit opt-in and governance approval exist.",
  ),
  record(
    "final-failure-mode:sqlite-event-store-unavailable",
    "SQLite/event store unavailable",
    "persistence",
    "hardening-surface:sqlite-event-store-unavailable",
    "critical",
    "blocks_startup",
    "Block stateful runtime startup and preserve read-only diagnostics.",
    "Do not write events, projections, or project state.",
    "Show persistence unavailable with event-store recovery guidance.",
    ["Verify SQLite readiness", "Review persistence configuration"],
    "Stateful execution remains blocked until persistence is available.",
  ),
  record(
    "final-failure-mode:projection-read-failure",
    "Projection read failure",
    "persistence",
    "hardening-surface:projection-read-failure",
    "high",
    "warning_only",
    "Show projections as unavailable and keep source stores untouched.",
    "Do not synthesize, mutate, or repair derived state automatically.",
    "Show projection read failure with persistence health guidance.",
    ["Review projection health", "Use source event metadata for diagnostics"],
    "Projection-backed UI remains read-only or unavailable.",
  ),
  record(
    "final-failure-mode:command-center-startup-failure",
    "Command Center startup failure",
    "command_center",
    "hardening-surface:tauri-command-center-startup-failure",
    "critical",
    "blocks_startup",
    "Block Command Center startup and preserve CLI/report diagnostics.",
    "Do not start partial authority-adjacent UI surfaces.",
    "Show Command Center startup failure with environment and build guidance.",
    ["Review startup readiness", "Review build and platform metadata"],
    "Command Center remains unavailable until startup prerequisites pass.",
  ),
  record(
    "final-failure-mode:tauri-binding-startup-failure",
    "Tauri binding/startup failure",
    "command_center",
    "hardening-surface:tauri-command-center-startup-failure",
    "critical",
    "blocks_startup",
    "Block desktop runtime startup and keep report-only diagnostics available.",
    "Do not bridge to partial desktop bindings.",
    "Show Tauri binding failure with platform and packaging guidance.",
    ["Review Tauri readiness", "Review packaging/build metadata"],
    "Desktop binding posture remains unavailable until prerequisites pass.",
  ),
  record(
    "final-failure-mode:doctor-bootstrap-failure",
    "Doctor/bootstrap failure",
    "bootstrap",
    "hardening-surface:doctor-bootstrap-failure",
    "critical",
    "blocks_startup",
    "Treat doctor/bootstrap blockers as setup blockers.",
    "Do not install, auto-fix, or mutate the environment.",
    "Show doctor/bootstrap failure with blocking readiness categories.",
    [
      "Review doctor report",
      "Resolve blocking bootstrap requirements manually",
    ],
    "Bootstrap remains descriptive until setup is performed by the user.",
  ),
  record(
    "final-failure-mode:onboarding-demo-readiness-failure",
    "Onboarding/demo readiness failure",
    "onboarding",
    "hardening-surface:onboarding-demo-readiness-failure",
    "medium",
    "warning_only",
    "Keep onboarding/demo output as read-only status and avoid demo execution.",
    "Do not execute onboarding steps or demos.",
    "Show onboarding or demo readiness incomplete.",
    ["Review onboarding report", "Review move-in checklist"],
    "Real-device onboarding and wake-word amendments remain deferred.",
  ),
  record(
    "final-failure-mode:voice-runtime-unavailable",
    "Voice runtime unavailable",
    "voice",
    "hardening-surface:voice-runtime-unavailable",
    "medium",
    "deferred",
    "Defer voice features and keep non-voice control paths available.",
    "Keep wake word, always-listening, and voice-only approval disabled.",
    "Show voice runtime unavailable without enabling listening behavior.",
    ["Review voice prerequisites", "Use non-voice control path"],
    "Voice authorization tiers remain deferred pending architecture update.",
  ),
  record(
    "final-failure-mode:vision-runtime-unavailable",
    "Vision runtime unavailable",
    "vision",
    "hardening-surface:vision-runtime-unavailable",
    "medium",
    "deferred",
    "Defer vision features and preserve metadata-only readiness status.",
    "Keep hidden/background capture disabled.",
    "Show vision runtime unavailable without camera activation.",
    ["Review vision prerequisites", "Keep camera-dependent surfaces disabled"],
    "Vision features remain unavailable until prerequisites are met.",
  ),
  record(
    "final-failure-mode:room-adapter-unavailable",
    "Room adapter unavailable",
    "room",
    "hardening-surface:room-adapter-unavailable",
    "high",
    "deferred",
    "Defer room/device adapters and preserve fake-room or read-only posture.",
    "Deny room/device actions by default.",
    "Show room adapter unavailable without attempting device action.",
    ["Review room adapter readiness", "Use fake room where available"],
    "Real device onboarding remains deferred until configuration and hardware exist.",
  ),
  record(
    "final-failure-mode:fake-room-failure",
    "Fake room failure",
    "room",
    "hardening-surface:fake-room-failure",
    "medium",
    "warning_only",
    "Keep demo mode unavailable and avoid substituting real device behavior.",
    "Do not fall through to real device actions.",
    "Show fake room unavailable with demo readiness guidance.",
    ["Review fake room readiness", "Review demo-mode metadata"],
    "Real device paths remain deferred and approval-gated.",
  ),
  record(
    "final-failure-mode:scheduler-disabled-stalled",
    "Scheduler disabled or stalled",
    "scheduler",
    "hardening-surface:scheduler-stalled-disabled",
    "medium",
    "deferred",
    "Defer scheduled assistance and prevent routine side effects.",
    "Keep scheduler side effects and routine chaining disabled.",
    "Show scheduler unavailable, disabled, or stalled.",
    ["Review scheduler readiness", "Use manual approval-gated workflow"],
    "Scheduled assistance remains metadata-only until explicitly healthy.",
  ),
  record(
    "final-failure-mode:approval-runtime-unavailable",
    "Approval runtime unavailable",
    "approval",
    "hardening-surface:approval-runtime-unavailable",
    "critical",
    "blocks_startup",
    "Block every side-effect-capable execution path.",
    "Deny all authority-bearing execution.",
    "Show approval runtime unavailable and explain that actions are blocked.",
    ["Restore approval runtime readiness", "Use read-only diagnostics only"],
    "No approval bypass, auto-approval, or voice-only approval is allowed.",
  ),
  record(
    "final-failure-mode:red-team-sandbox-disabled-misconfigured",
    "Red-team sandbox disabled or misconfigured",
    "red_team",
    "hardening-surface:red-team-sandbox-disabled-misconfigured",
    "medium",
    "deferred",
    "Defer red-team behavior and keep CAI target posture whitelisted or disabled.",
    "Keep non-whitelisted CAI targets disabled.",
    "Show red-team sandbox unavailable or misconfigured.",
    [
      "Review sandbox configuration",
      "Keep targets disabled unless whitelisted",
    ],
    "Red-team posture remains sandboxed and non-authority-bearing.",
  ),
  record(
    "final-failure-mode:telemetry-audit-report-unavailable",
    "Telemetry/audit report unavailable",
    "observability",
    "hardening-surface:telemetry-audit-report-unavailable",
    "medium",
    "warning_only",
    "Show observability as unavailable and avoid live telemetry queries.",
    "Do not expose source material or raw telemetry.",
    "Show telemetry or audit report unavailable with metadata-only guidance.",
    ["Review audit report metadata", "Review telemetry cockpit readiness"],
    "Observability remains read-only and redaction-aware.",
  ),
  record(
    "final-failure-mode:packaging-build-failure",
    "Packaging/build failure",
    "packaging",
    "hardening-surface:packaging-build-failure",
    "critical",
    "blocks_startup",
    "Block release readiness and preserve diagnostic metadata.",
    "Do not publish, package, or mark release ready.",
    "Show packaging/build failure with verification expectations.",
    ["Review build output metadata", "Resolve packaging blockers manually"],
    "Packaging remains incomplete until build verification passes.",
  ),
  record(
    "final-failure-mode:configuration-missing-invalid",
    "Configuration missing or invalid",
    "configuration",
    "hardening-surface:configuration-missing-invalid",
    "critical",
    "blocks_startup",
    "Block affected runtime surfaces and require explicit configuration review.",
    "Do not infer secrets, provider credentials, or device targets.",
    "Show missing or invalid configuration without auto-fix.",
    [
      "Review env example and config requirements",
      "Provide configuration manually",
    ],
    "Cloud and device posture remains disabled until valid configuration exists.",
  ),
  record(
    "final-failure-mode:unsupported-environment-platform",
    "Unsupported environment/platform",
    "environment",
    "hardening-surface:environment-unsupported",
    "critical",
    "blocks_startup",
    "Block unsupported runtime startup and preserve setup guidance.",
    "Do not attempt compatibility workarounds automatically.",
    "Show unsupported environment with platform prerequisite guidance.",
    [
      "Review platform support contract",
      "Use supported Node/platform prerequisites",
    ],
    "Runtime remains unavailable until supported environment is present.",
  ),
  record(
    "final-failure-mode:disk-memory-constraints",
    "Disk or memory constraints",
    "resources",
    "hardening-surface:disk-memory-constraints",
    "high",
    "warning_only",
    "Warn and degrade to non-heavy local readiness reporting.",
    "Avoid starting model, vision, or packaging-heavy tasks.",
    "Show resource constraint warning without launching heavy runtimes.",
    ["Review local resource requirements", "Retry after manual remediation"],
    "Resource-sensitive features remain deferred until constraints are resolved.",
  ),
  record(
    "final-failure-mode:local-first-fallback-unavailable",
    "Local-first fallback unavailable",
    "local_first",
    "hardening-surface:local-first-fallback-posture",
    "high",
    "blocks_surface",
    "Defer affected optional behavior rather than falling through to cloud.",
    "Keep cloud/provider escalation disabled.",
    "Show local-first fallback unavailable and explain that optional behavior is blocked.",
    ["Review local fallback readiness", "Keep optional cloud paths disabled"],
    "Local-first remains required before any optional fallback is considered.",
  ),
  record(
    "final-failure-mode:unsafe-cloud-fallback-request",
    "Unsafe cloud fallback request",
    "local_first",
    "hardening-surface:cloud-provider-opt-in-gated",
    "critical",
    "blocks_surface",
    "Reject unsafe cloud fallback and preserve local-first posture.",
    "Deny cloud calls by default.",
    "Show cloud fallback rejected because opt-in/governance gates are not satisfied.",
    ["Review cloud gate policy", "Use local-safe behavior instead"],
    "Cloud fallback remains disabled until explicit opt-in and governance approval exist.",
  ),
] as const satisfies readonly FinalFailureModeRecord[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyRecord(
  recordToCopy: FinalFailureModeRecord,
): FinalFailureModeRecord {
  return FinalFailureModeRecordSchema.parse(
    JSON.parse(JSON.stringify(recordToCopy)),
  );
}

function assertFailureModesAlignWithHardeningSurfaces(): void {
  const knownSurfaceIds = new Set(
    getHardeningSurfaces().map((surface) => surface.surface_id),
  );

  for (const failureMode of FINAL_FAILURE_MODE_REGISTRY) {
    if (!knownSurfaceIds.has(failureMode.hardening_surface_id)) {
      throw new Error(
        `Failure mode ${failureMode.failure_id} references unknown hardening surface ${failureMode.hardening_surface_id}`,
      );
    }
  }
}

export const FINAL_FAILURE_MODES = deepFreeze(
  FinalFailureModeRegistrySchema.parse(FINAL_FAILURE_MODE_REGISTRY),
);

export function getFinalFailureModeRegistry(): readonly FinalFailureModeRecord[] {
  assertFailureModesAlignWithHardeningSurfaces();
  return FINAL_FAILURE_MODES.map(copyRecord);
}

export function getFailureModesBySurface(
  surfaceId: HardeningSurfaceId,
): readonly FinalFailureModeRecord[] {
  return FINAL_FAILURE_MODES.filter(
    (failureMode) => failureMode.hardening_surface_id === surfaceId,
  ).map(copyRecord);
}

export function getBlockingFailureModes(): readonly FinalFailureModeRecord[] {
  return FINAL_FAILURE_MODES.filter((failureMode) =>
    ["blocks_startup", "blocks_surface"].includes(failureMode.blocking_posture),
  ).map(copyRecord);
}

export function getFailureModesBySeverity(
  severity: HardeningSeverity,
): readonly FinalFailureModeRecord[] {
  return FINAL_FAILURE_MODES.filter(
    (failureMode) => failureMode.severity === severity,
  ).map(copyRecord);
}

export function summarizeFinalFailureModes(): FinalFailureModeSummary {
  const categories = new Set(
    FINAL_FAILURE_MODES.map((failureMode) => failureMode.category),
  );
  const representedSurfaces = new Set(
    FINAL_FAILURE_MODES.map((failureMode) => failureMode.hardening_surface_id),
  );

  return FinalFailureModeSummarySchema.parse({
    registry_version: FINAL_FAILURE_MODE_REGISTRY_VERSION,
    failure_mode_count: FINAL_FAILURE_MODES.length,
    category_count: categories.size,
    represented_surface_count: representedSurfaces.size,
    critical_count: getFailureModesBySeverity("critical").length,
    high_count: getFailureModesBySeverity("high").length,
    medium_count: getFailureModesBySeverity("medium").length,
    low_count: getFailureModesBySeverity("low").length,
    blocking_count: getBlockingFailureModes().length,
    warning_count: FINAL_FAILURE_MODES.filter(
      (failureMode) => failureMode.blocking_posture === "warning_only",
    ).length,
    deferred_count: FINAL_FAILURE_MODES.filter(
      (failureMode) => failureMode.blocking_posture === "deferred",
    ).length,
    recovery_guidance_count: FINAL_FAILURE_MODES.reduce(
      (count, failureMode) => count + failureMode.recovery_guidance.length,
      0,
    ),
    phase20f_registry_only: true,
    phase20f_capability_neutral: true,
    posture: POSTURE,
  });
}
