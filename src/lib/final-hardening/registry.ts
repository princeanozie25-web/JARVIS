import {
  FINAL_HARDENING_CONTRACT_VERSION,
  HARDENING_DIMENSION_IDS,
  HARDENING_EXPECTATION_IDS,
  FinalHardeningContractSchema,
  FinalHardeningSummarySchema,
  HardeningDimensionSchema,
  HardeningExpectationSchema,
  HardeningFailureModeSchema,
  HardeningSurfaceSchema,
  type FinalHardeningContract,
  type FinalHardeningPosture,
  type FinalHardeningSummary,
  type HardeningDimension,
  type HardeningDimensionId,
  type HardeningExpectation,
  type HardeningExpectationId,
  type HardeningFailureMode,
  type HardeningFailureModeId,
  type HardeningRecoveryPosture,
  type HardeningSeverity,
  type HardeningSurface,
  type HardeningSurfaceId,
} from "./contracts";

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

function dimension(
  dimensionId: HardeningDimensionId,
  label: string,
  severity: HardeningSeverity,
  hardeningGoal: string,
  expectationId: HardeningExpectationId,
): HardeningDimension {
  return HardeningDimensionSchema.parse({
    dimension_id: dimensionId,
    label,
    severity,
    hardening_goal: hardeningGoal,
    expectation_id: expectationId,
    posture: POSTURE,
  });
}

function expectation(
  expectationId: HardeningExpectationId,
  dimensionId: HardeningDimensionId,
  severity: HardeningSeverity,
  expectationText: string,
  verificationGuidance: readonly string[],
): HardeningExpectation {
  return HardeningExpectationSchema.parse({
    expectation_id: expectationId,
    dimension_id: dimensionId,
    severity,
    expectation: expectationText,
    verification_guidance: [...verificationGuidance],
    future_hardening_only: true,
    posture: POSTURE,
  });
}

function failureMode(
  failureModeId: HardeningFailureModeId,
  surfaceId: HardeningSurfaceId,
  label: string,
  description: string,
  severity: HardeningSeverity,
  recoveryPosture: HardeningRecoveryPosture,
): HardeningFailureMode {
  return HardeningFailureModeSchema.parse({
    failure_mode_id: failureModeId,
    surface_id: surfaceId,
    label,
    description,
    severity,
    expected_recovery_posture: recoveryPosture,
    posture: POSTURE,
  });
}

function surface(
  surfaceId: HardeningSurfaceId,
  failureModeId: HardeningFailureModeId,
  label: string,
  severity: HardeningSeverity,
  recoveryPosture: HardeningRecoveryPosture,
  fallbackBehavior: string,
  userVisibleErrorPosture: string,
  safeDefault: string,
  disabledDeferredPosture: string,
  recoveryGuidance: readonly string[],
): HardeningSurface {
  return HardeningSurfaceSchema.parse({
    surface_id: surfaceId,
    label,
    failure_mode_id: failureModeId,
    dimension_ids: [...HARDENING_DIMENSION_IDS],
    expectation_ids: [...HARDENING_EXPECTATION_IDS],
    fallback_behavior: fallbackBehavior,
    user_visible_error_posture: userVisibleErrorPosture,
    audit_log_posture:
      "Record metadata-only failure category, severity, and recovery posture without source material or raw payload exposure.",
    safe_default: safeDefault,
    disabled_deferred_posture: disabledDeferredPosture,
    recovery_guidance: [...recoveryGuidance],
    blocking_severity: severity,
    recovery_posture: recoveryPosture,
    posture: POSTURE,
  });
}

const DIMENSIONS = [
  dimension(
    "hardening-dimension:failure-mode",
    "Failure mode",
    "critical",
    "Describe the expected failure class without executing checks or inspecting runtime state.",
    "hardening-expectation:failure-mode",
  ),
  dimension(
    "hardening-dimension:fallback-behavior",
    "Fallback behavior",
    "critical",
    "Define the safe behavior JARVIS should present when a final hardening surface is unavailable.",
    "hardening-expectation:fallback-behavior",
  ),
  dimension(
    "hardening-dimension:user-visible-error-posture",
    "User-visible error posture",
    "high",
    "Ensure future UX can show clear failure states without raw payloads or hidden side effects.",
    "hardening-expectation:user-visible-error-posture",
  ),
  dimension(
    "hardening-dimension:audit-log-posture",
    "Audit/log posture",
    "high",
    "Ensure future logging remains metadata-only, redaction-aware, and non-mutating.",
    "hardening-expectation:audit-log-posture",
  ),
  dimension(
    "hardening-dimension:safe-default",
    "Safe default",
    "critical",
    "Define the default deny, disable, defer, or read-only state for each hardening failure.",
    "hardening-expectation:safe-default",
  ),
  dimension(
    "hardening-dimension:disabled-deferred-posture",
    "Disabled/deferred posture",
    "high",
    "Preserve prior disabled-feature and deferred-feature boundaries during hardening.",
    "hardening-expectation:disabled-deferred-posture",
  ),
  dimension(
    "hardening-dimension:recovery-guidance",
    "Recovery guidance",
    "medium",
    "Describe future remediation guidance without installer automation or auto-fix behavior.",
    "hardening-expectation:recovery-guidance",
  ),
  dimension(
    "hardening-dimension:blocking-severity",
    "Blocking severity",
    "high",
    "Classify whether the failure should block startup, block specific features, warn, or defer.",
    "hardening-expectation:blocking-severity",
  ),
] satisfies readonly HardeningDimension[];

const EXPECTATIONS = [
  expectation(
    "hardening-expectation:failure-mode",
    "hardening-dimension:failure-mode",
    "critical",
    "Every final hardening surface must declare the failure mode that later hardening checks may evaluate.",
    ["failure-mode metadata", "surface coverage metadata"],
  ),
  expectation(
    "hardening-expectation:fallback-behavior",
    "hardening-dimension:fallback-behavior",
    "critical",
    "Each failure must define fallback behavior that avoids execution, provider calls, device action, and approval bypass.",
    ["fallback behavior text", "safe-default metadata"],
  ),
  expectation(
    "hardening-expectation:user-visible-error-posture",
    "hardening-dimension:user-visible-error-posture",
    "high",
    "User-visible errors must be explainable, bounded, and free of raw/source material.",
    ["error posture metadata", "source-material-safe posture"],
  ),
  expectation(
    "hardening-expectation:audit-log-posture",
    "hardening-dimension:audit-log-posture",
    "high",
    "Audit and log posture must remain metadata-only and future-check oriented.",
    ["audit/log posture text", "metadata-only posture"],
  ),
  expectation(
    "hardening-expectation:safe-default",
    "hardening-dimension:safe-default",
    "critical",
    "Safe defaults must prefer deny, disable, defer, local-only, or read-only posture.",
    ["safe default text", "disabled/deferred posture"],
  ),
  expectation(
    "hardening-expectation:disabled-deferred-posture",
    "hardening-dimension:disabled-deferred-posture",
    "high",
    "Disabled and deferred surfaces must stay disabled or deferred until a later approved architecture update.",
    ["Phase 20A disabled-feature matrix", "Phase 20E audit closeout"],
  ),
  expectation(
    "hardening-expectation:recovery-guidance",
    "hardening-dimension:recovery-guidance",
    "medium",
    "Recovery guidance must be descriptive only and must not install, mutate, execute, or auto-fix.",
    ["recovery guidance metadata", "doctor/bootstrap metadata"],
  ),
  expectation(
    "hardening-expectation:blocking-severity",
    "hardening-dimension:blocking-severity",
    "high",
    "Blocking severity must be explicit so future hardening can distinguish blockers from warnings and deferred items.",
    ["blocking severity metadata", "failure-mode severity metadata"],
  ),
] satisfies readonly HardeningExpectation[];

const FAILURE_MODES = [
  failureMode(
    "hardening-failure-mode:model-runtime-unavailable",
    "hardening-surface:model-runtime-unavailable",
    "Model runtime unavailable",
    "Local model runtime cannot be reached or cannot provide local inference readiness.",
    "high",
    "degrade_to_local_safe_mode",
  ),
  failureMode(
    "hardening-failure-mode:provider-disabled-misconfigured",
    "hardening-surface:provider-disabled-misconfigured",
    "Provider disabled or misconfigured",
    "Provider configuration is missing, disabled, or not allowed by local-first policy.",
    "high",
    "keep_cloud_disabled",
  ),
  failureMode(
    "hardening-failure-mode:sqlite-event-store-unavailable",
    "hardening-surface:sqlite-event-store-unavailable",
    "SQLite/event store unavailable",
    "Persistence substrate is unavailable for event storage or replay-safe state.",
    "critical",
    "block_startup_with_guidance",
  ),
  failureMode(
    "hardening-failure-mode:projection-read-failure",
    "hardening-surface:projection-read-failure",
    "Projection read failure",
    "Read projections cannot be loaded or summarized for command surfaces.",
    "high",
    "surface_read_only_warning",
  ),
  failureMode(
    "hardening-failure-mode:tauri-command-center-startup-failure",
    "hardening-surface:tauri-command-center-startup-failure",
    "Tauri/Command Center startup failure",
    "Desktop or Command Center startup readiness is unavailable.",
    "critical",
    "block_startup_with_guidance",
  ),
  failureMode(
    "hardening-failure-mode:doctor-bootstrap-failure",
    "hardening-surface:doctor-bootstrap-failure",
    "Doctor/bootstrap failure",
    "Bootstrap or doctor readiness metadata indicates setup blockers.",
    "critical",
    "block_startup_with_guidance",
  ),
  failureMode(
    "hardening-failure-mode:onboarding-demo-readiness-failure",
    "hardening-surface:onboarding-demo-readiness-failure",
    "Onboarding/demo readiness failure",
    "Onboarding, demo, or move-in readiness is blocked or incomplete.",
    "medium",
    "surface_read_only_warning",
  ),
  failureMode(
    "hardening-failure-mode:voice-runtime-unavailable",
    "hardening-surface:voice-runtime-unavailable",
    "Voice runtime unavailable",
    "Voice runtime prerequisites or runtime readiness are unavailable.",
    "medium",
    "defer_capability_with_notice",
  ),
  failureMode(
    "hardening-failure-mode:vision-runtime-unavailable",
    "hardening-surface:vision-runtime-unavailable",
    "Vision runtime unavailable",
    "Vision runtime prerequisites or runtime readiness are unavailable.",
    "medium",
    "defer_capability_with_notice",
  ),
  failureMode(
    "hardening-failure-mode:room-adapter-unavailable",
    "hardening-surface:room-adapter-unavailable",
    "Room adapter unavailable",
    "Room adapter runtime is unavailable or cannot expose safe adapter posture.",
    "high",
    "defer_capability_with_notice",
  ),
  failureMode(
    "hardening-failure-mode:fake-room-failure",
    "hardening-surface:fake-room-failure",
    "Fake room failure",
    "Demo-safe fake room readiness is unavailable.",
    "medium",
    "surface_read_only_warning",
  ),
  failureMode(
    "hardening-failure-mode:scheduler-stalled-disabled",
    "hardening-surface:scheduler-stalled-disabled",
    "Scheduler stalled or disabled",
    "Scheduled assistance runtime is stalled, disabled, or unavailable.",
    "medium",
    "defer_capability_with_notice",
  ),
  failureMode(
    "hardening-failure-mode:approval-runtime-unavailable",
    "hardening-surface:approval-runtime-unavailable",
    "Approval runtime unavailable",
    "Approval-gated execution layer is unavailable or cannot provide governance posture.",
    "critical",
    "block_startup_with_guidance",
  ),
  failureMode(
    "hardening-failure-mode:red-team-sandbox-disabled-misconfigured",
    "hardening-surface:red-team-sandbox-disabled-misconfigured",
    "Red-team sandbox disabled or misconfigured",
    "Red-team sandbox or CAI posture is missing, disabled, or outside whitelist posture.",
    "medium",
    "defer_capability_with_notice",
  ),
  failureMode(
    "hardening-failure-mode:telemetry-audit-report-unavailable",
    "hardening-surface:telemetry-audit-report-unavailable",
    "Telemetry/audit report unavailable",
    "Telemetry cockpit, audit report, or read-only observability metadata is unavailable.",
    "medium",
    "surface_read_only_warning",
  ),
  failureMode(
    "hardening-failure-mode:packaging-build-failure",
    "hardening-surface:packaging-build-failure",
    "Packaging/build failure",
    "Packaging or build readiness fails during future final packaging verification.",
    "critical",
    "block_startup_with_guidance",
  ),
  failureMode(
    "hardening-failure-mode:configuration-missing-invalid",
    "hardening-surface:configuration-missing-invalid",
    "Configuration missing or invalid",
    "Required configuration or environment metadata is missing, invalid, or unsafe.",
    "critical",
    "require_user_configuration",
  ),
  failureMode(
    "hardening-failure-mode:environment-unsupported",
    "hardening-surface:environment-unsupported",
    "Environment unsupported",
    "Host platform, runtime, or prerequisite posture is unsupported.",
    "critical",
    "block_startup_with_guidance",
  ),
  failureMode(
    "hardening-failure-mode:disk-memory-constraints",
    "hardening-surface:disk-memory-constraints",
    "Disk or memory constraints",
    "Host resource posture is insufficient for stable local-first operation.",
    "high",
    "surface_read_only_warning",
  ),
  failureMode(
    "hardening-failure-mode:local-first-fallback-posture",
    "hardening-surface:local-first-fallback-posture",
    "Local-first fallback posture",
    "Local-first fallback posture is unclear or missing when optional services are unavailable.",
    "high",
    "degrade_to_local_safe_mode",
  ),
  failureMode(
    "hardening-failure-mode:cloud-provider-opt-in-gated",
    "hardening-surface:cloud-provider-opt-in-gated",
    "Cloud provider remains opt-in/gated",
    "Cloud provider posture must remain disabled, opt-in, and governed by explicit gate metadata.",
    "critical",
    "keep_cloud_disabled",
  ),
] satisfies readonly HardeningFailureMode[];

const SURFACES = [
  surface(
    "hardening-surface:model-runtime-unavailable",
    "hardening-failure-mode:model-runtime-unavailable",
    "Model runtime unavailable",
    "high",
    "degrade_to_local_safe_mode",
    "Disable model-dependent actions and preserve local metadata-only readiness reporting.",
    "Show model runtime unavailable with local setup guidance and no provider escalation.",
    "Keep model execution disabled until local readiness is restored.",
    "Cloud model escalation remains disabled unless explicitly opted in and approved later.",
    ["Review local model readiness metadata", "Use doctor report guidance"],
  ),
  surface(
    "hardening-surface:provider-disabled-misconfigured",
    "hardening-failure-mode:provider-disabled-misconfigured",
    "Provider disabled or misconfigured",
    "high",
    "keep_cloud_disabled",
    "Keep provider access disabled and preserve local-first fallback posture.",
    "Show provider disabled or misconfigured without attempting connection.",
    "Deny provider calls by default.",
    "Cloud/provider functionality remains opt-in and cloud-gated.",
    [
      "Review provider configuration posture",
      "Keep disabled until explicitly configured",
    ],
  ),
  surface(
    "hardening-surface:sqlite-event-store-unavailable",
    "hardening-failure-mode:sqlite-event-store-unavailable",
    "SQLite/event store unavailable",
    "critical",
    "block_startup_with_guidance",
    "Block stateful runtime startup and preserve read-only diagnostics.",
    "Show event store unavailable with persistence recovery guidance.",
    "Do not write events or project state.",
    "Stateful execution remains blocked until persistence is available.",
    ["Verify SQLite readiness", "Review persistence configuration"],
  ),
  surface(
    "hardening-surface:projection-read-failure",
    "hardening-failure-mode:projection-read-failure",
    "Projection read failure",
    "high",
    "surface_read_only_warning",
    "Degrade projections to unavailable metadata while keeping source stores untouched.",
    "Show projection unavailable and invite review of persistence health.",
    "Do not synthesize or mutate derived state.",
    "Projection-backed UI remains read-only or unavailable.",
    ["Review projection health", "Use source event metadata for diagnostics"],
  ),
  surface(
    "hardening-surface:tauri-command-center-startup-failure",
    "hardening-failure-mode:tauri-command-center-startup-failure",
    "Tauri/Command Center startup failure",
    "critical",
    "block_startup_with_guidance",
    "Block desktop/Command Center runtime startup and preserve CLI/report diagnostics.",
    "Show startup failure with environment and build readiness guidance.",
    "Do not start partial authority-bearing UI surfaces.",
    "Command Center remains unavailable until startup prerequisites pass.",
    ["Review platform support", "Review build and Tauri readiness metadata"],
  ),
  surface(
    "hardening-surface:doctor-bootstrap-failure",
    "hardening-failure-mode:doctor-bootstrap-failure",
    "Doctor/bootstrap failure",
    "critical",
    "block_startup_with_guidance",
    "Treat bootstrap blockers as setup blockers and avoid runtime startup.",
    "Show doctor/bootstrap failure with blocking readiness categories.",
    "Do not install, auto-fix, or mutate environment.",
    "Bootstrap remains descriptive until a user performs setup.",
    [
      "Review doctor report",
      "Resolve blocking bootstrap requirements manually",
    ],
  ),
  surface(
    "hardening-surface:onboarding-demo-readiness-failure",
    "hardening-failure-mode:onboarding-demo-readiness-failure",
    "Onboarding/demo readiness failure",
    "medium",
    "surface_read_only_warning",
    "Keep onboarding/demo output as read-only status and avoid demo execution.",
    "Show onboarding or demo readiness incomplete.",
    "Do not execute onboarding steps or demos.",
    "Real device onboarding and wake-word amendments remain deferred.",
    ["Review onboarding report", "Review move-in checklist"],
  ),
  surface(
    "hardening-surface:voice-runtime-unavailable",
    "hardening-failure-mode:voice-runtime-unavailable",
    "Voice runtime unavailable",
    "medium",
    "defer_capability_with_notice",
    "Defer voice features and preserve typed readiness metadata.",
    "Show voice runtime unavailable without enabling wake word or always-listening.",
    "Keep wake word, always-listening, and voice-only approval disabled.",
    "Voice authorization tiers remain deferred pending architecture update.",
    ["Review voice prerequisites", "Use non-voice control path"],
  ),
  surface(
    "hardening-surface:vision-runtime-unavailable",
    "hardening-failure-mode:vision-runtime-unavailable",
    "Vision runtime unavailable",
    "medium",
    "defer_capability_with_notice",
    "Defer vision features and preserve metadata-only readiness status.",
    "Show vision runtime unavailable without camera activation.",
    "Keep hidden/background capture disabled.",
    "Vision features remain unavailable until prerequisites are met.",
    ["Review vision prerequisites", "Keep camera-dependent surfaces disabled"],
  ),
  surface(
    "hardening-surface:room-adapter-unavailable",
    "hardening-failure-mode:room-adapter-unavailable",
    "Room adapter unavailable",
    "high",
    "defer_capability_with_notice",
    "Defer room/device adapters and preserve fake-room or read-only posture.",
    "Show room adapter unavailable without attempting device action.",
    "Deny room/device actions by default.",
    "Real device onboarding remains deferred until configuration and hardware exist.",
    ["Review room adapter readiness", "Use fake room where available"],
  ),
  surface(
    "hardening-surface:fake-room-failure",
    "hardening-failure-mode:fake-room-failure",
    "Fake room failure",
    "medium",
    "surface_read_only_warning",
    "Keep demo mode unavailable and avoid substituting real device behavior.",
    "Show fake room unavailable with demo readiness guidance.",
    "Do not fall through to real device actions.",
    "Real device paths remain deferred and approval-gated.",
    ["Review fake room readiness", "Review demo-mode metadata"],
  ),
  surface(
    "hardening-surface:scheduler-stalled-disabled",
    "hardening-failure-mode:scheduler-stalled-disabled",
    "Scheduler stalled or disabled",
    "medium",
    "defer_capability_with_notice",
    "Defer scheduled assistance and prevent routine side effects.",
    "Show scheduler unavailable or disabled.",
    "Keep scheduler side effects and routine chaining disabled.",
    "Scheduled assistance remains metadata-only until explicitly healthy.",
    ["Review scheduler readiness", "Use manual approval-gated workflow"],
  ),
  surface(
    "hardening-surface:approval-runtime-unavailable",
    "hardening-failure-mode:approval-runtime-unavailable",
    "Approval runtime unavailable",
    "critical",
    "block_startup_with_guidance",
    "Block any side-effect-capable execution path.",
    "Show approval runtime unavailable and explain that actions are blocked.",
    "Deny all authority-bearing execution.",
    "No approval bypass or auto-approval is allowed.",
    ["Restore approval runtime readiness", "Use read-only diagnostics only"],
  ),
  surface(
    "hardening-surface:red-team-sandbox-disabled-misconfigured",
    "hardening-failure-mode:red-team-sandbox-disabled-misconfigured",
    "Red-team sandbox disabled or misconfigured",
    "medium",
    "defer_capability_with_notice",
    "Defer red-team execution and keep CAI target posture whitelisted or disabled.",
    "Show sandbox unavailable or misconfigured.",
    "Keep non-whitelisted CAI targets disabled.",
    "Red-team posture remains sandboxed and non-authority-bearing.",
    [
      "Review sandbox configuration",
      "Keep targets disabled unless whitelisted",
    ],
  ),
  surface(
    "hardening-surface:telemetry-audit-report-unavailable",
    "hardening-failure-mode:telemetry-audit-report-unavailable",
    "Telemetry/audit report unavailable",
    "medium",
    "surface_read_only_warning",
    "Show observability as unavailable and avoid querying live telemetry.",
    "Show telemetry or audit report unavailable with metadata-only guidance.",
    "Do not expose source material or raw telemetry.",
    "Observability remains read-only and redaction-aware.",
    ["Review audit report metadata", "Review telemetry cockpit readiness"],
  ),
  surface(
    "hardening-surface:packaging-build-failure",
    "hardening-failure-mode:packaging-build-failure",
    "Packaging/build failure",
    "critical",
    "block_startup_with_guidance",
    "Block release readiness and preserve diagnostic metadata.",
    "Show packaging/build failure with verification expectations.",
    "Do not publish or mark release ready.",
    "Packaging remains incomplete until build verification passes.",
    ["Review build output metadata", "Resolve packaging blockers manually"],
  ),
  surface(
    "hardening-surface:configuration-missing-invalid",
    "hardening-failure-mode:configuration-missing-invalid",
    "Configuration missing or invalid",
    "critical",
    "require_user_configuration",
    "Block affected runtime surfaces and require explicit configuration review.",
    "Show missing or invalid configuration without auto-fix.",
    "Do not infer secrets, provider credentials, or device targets.",
    "Cloud and device posture remains disabled until valid configuration exists.",
    [
      "Review env example and config requirements",
      "Provide configuration manually",
    ],
  ),
  surface(
    "hardening-surface:environment-unsupported",
    "hardening-failure-mode:environment-unsupported",
    "Environment unsupported",
    "critical",
    "block_startup_with_guidance",
    "Block unsupported runtime startup and preserve setup guidance.",
    "Show unsupported environment with platform prerequisite guidance.",
    "Do not attempt compatibility workarounds automatically.",
    "Runtime remains unavailable until supported environment is present.",
    [
      "Review platform support contract",
      "Use supported Node/platform prerequisites",
    ],
  ),
  surface(
    "hardening-surface:disk-memory-constraints",
    "hardening-failure-mode:disk-memory-constraints",
    "Disk or memory constraints",
    "high",
    "surface_read_only_warning",
    "Warn and degrade to non-heavy local readiness reporting.",
    "Show resource constraint warning without launching heavy runtimes.",
    "Avoid starting model, vision, or packaging-heavy tasks.",
    "Resource-sensitive features remain deferred until constraints are resolved.",
    [
      "Review local resource requirements",
      "Retry only after manual remediation",
    ],
  ),
  surface(
    "hardening-surface:local-first-fallback-posture",
    "hardening-failure-mode:local-first-fallback-posture",
    "Local-first fallback posture",
    "high",
    "degrade_to_local_safe_mode",
    "Prefer local safe mode and disable optional provider-backed behavior.",
    "Show local-first fallback active.",
    "Keep cloud/provider escalation disabled.",
    "Local-first remains the default for every unavailable optional dependency.",
    ["Review local fallback readiness", "Keep optional cloud paths disabled"],
  ),
  surface(
    "hardening-surface:cloud-provider-opt-in-gated",
    "hardening-failure-mode:cloud-provider-opt-in-gated",
    "Cloud provider remains opt-in/gated",
    "critical",
    "keep_cloud_disabled",
    "Keep cloud providers disabled unless future explicit opt-in and governance gates pass.",
    "Show cloud provider disabled and gated.",
    "Deny cloud calls by default.",
    "Cloud providers remain opt-in, approval-aware, and disabled by default.",
    [
      "Review cloud gate policy",
      "Require explicit opt-in before any future use",
    ],
  ),
] satisfies readonly HardeningSurface[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyContract(
  contract: FinalHardeningContract,
): FinalHardeningContract {
  return FinalHardeningContractSchema.parse(
    JSON.parse(JSON.stringify(contract)),
  );
}

function copySurface(hardeningSurface: HardeningSurface): HardeningSurface {
  return HardeningSurfaceSchema.parse(
    JSON.parse(JSON.stringify(hardeningSurface)),
  );
}

function copyFailureMode(
  hardeningFailureMode: HardeningFailureMode,
): HardeningFailureMode {
  return HardeningFailureModeSchema.parse(
    JSON.parse(JSON.stringify(hardeningFailureMode)),
  );
}

function copyExpectation(
  hardeningExpectation: HardeningExpectation,
): HardeningExpectation {
  return HardeningExpectationSchema.parse(
    JSON.parse(JSON.stringify(hardeningExpectation)),
  );
}

export const FINAL_HARDENING_CONTRACT = deepFreeze(
  FinalHardeningContractSchema.parse({
    contract_version: FINAL_HARDENING_CONTRACT_VERSION,
    contract_id: "phase-20f1-final-hardening-contract",
    phase: "20F.1",
    summary:
      "Metadata-only final hardening contract defining JARVIS OS v1 failure surfaces, fallback behavior, safe defaults, recovery guidance, and blocking severity without executing hardening checks.",
    surfaces: SURFACES,
    failure_modes: FAILURE_MODES,
    dimensions: DIMENSIONS,
    expectations: EXPECTATIONS,
    posture: POSTURE,
  }),
);

export function getFinalHardeningContract(): FinalHardeningContract {
  return copyContract(FINAL_HARDENING_CONTRACT);
}

export function getHardeningSurfaces(): readonly HardeningSurface[] {
  return FINAL_HARDENING_CONTRACT.surfaces.map(copySurface);
}

export function getHardeningFailureModes(): readonly HardeningFailureMode[] {
  return FINAL_HARDENING_CONTRACT.failure_modes.map(copyFailureMode);
}

export function getHardeningExpectations(): readonly HardeningExpectation[] {
  return FINAL_HARDENING_CONTRACT.expectations.map(copyExpectation);
}

export function summarizeFinalHardeningContract(): FinalHardeningSummary {
  const surfaces = FINAL_HARDENING_CONTRACT.surfaces;
  const recoveryPostures = new Set(
    surfaces.map((surfaceRecord) => surfaceRecord.recovery_posture),
  );

  return FinalHardeningSummarySchema.parse({
    contract_version: FINAL_HARDENING_CONTRACT_VERSION,
    surface_count: surfaces.length,
    failure_mode_count: FINAL_HARDENING_CONTRACT.failure_modes.length,
    dimension_count: FINAL_HARDENING_CONTRACT.dimensions.length,
    expectation_count: FINAL_HARDENING_CONTRACT.expectations.length,
    critical_surface_count: surfaces.filter(
      (surfaceRecord) => surfaceRecord.blocking_severity === "critical",
    ).length,
    high_surface_count: surfaces.filter(
      (surfaceRecord) => surfaceRecord.blocking_severity === "high",
    ).length,
    medium_surface_count: surfaces.filter(
      (surfaceRecord) => surfaceRecord.blocking_severity === "medium",
    ).length,
    low_surface_count: surfaces.filter(
      (surfaceRecord) => surfaceRecord.blocking_severity === "low",
    ).length,
    recovery_posture_count: recoveryPostures.size,
    safe_default_surface_count: surfaces.filter(
      (surfaceRecord) => surfaceRecord.safe_default.length > 0,
    ).length,
    fallback_surface_count: surfaces.filter(
      (surfaceRecord) => surfaceRecord.fallback_behavior.length > 0,
    ).length,
    phase20f_contract_only: true,
    phase20f_capability_neutral: true,
    posture: POSTURE,
  });
}
