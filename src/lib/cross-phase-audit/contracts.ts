import { z } from "zod";

export const CROSS_PHASE_AUDIT_CONTRACT_VERSION = "20E.1" as const;

export const AUDIT_SURFACE_IDS = [
  "audit-surface:phase-10-room-os",
  "audit-surface:phase-11-persistence",
  "audit-surface:phase-12-command-center",
  "audit-surface:phase-13-model-runtime",
  "audit-surface:phase-14-voice-runtime",
  "audit-surface:phase-15-vision-runtime",
  "audit-surface:phase-16-room-runtime",
  "audit-surface:phase-17-scheduled-assistance",
  "audit-surface:phase-18-approval-runtime",
  "audit-surface:phase-19-fortress-layer",
  "audit-surface:phase-20a-readiness",
  "audit-surface:phase-20b-bootstrap",
  "audit-surface:phase-20c-onboarding",
  "audit-surface:phase-20d-portfolio",
] as const;

export const AUDIT_PHASE_IDS = [
  "phase-10",
  "phase-11",
  "phase-12",
  "phase-13",
  "phase-14",
  "phase-15",
  "phase-16",
  "phase-17",
  "phase-18",
  "phase-19",
  "phase-20a",
  "phase-20b",
  "phase-20c",
  "phase-20d",
] as const;

export const AUDIT_DIMENSION_IDS = [
  "audit-dimension:governance",
  "audit-dimension:authority-surfaces",
  "audit-dimension:disabled-features",
  "audit-dimension:approval-boundaries",
  "audit-dimension:local-first-posture",
  "audit-dimension:provider-posture",
  "audit-dimension:redaction-posture",
  "audit-dimension:replay-safety",
  "audit-dimension:observability",
  "audit-dimension:auditability",
  "audit-dimension:onboarding-readiness",
  "audit-dimension:portfolio-readiness",
] as const;

export const AUDIT_EXPECTATION_IDS = [
  "audit-expectation:governance",
  "audit-expectation:authority-surfaces",
  "audit-expectation:disabled-features",
  "audit-expectation:approval-boundaries",
  "audit-expectation:local-first-posture",
  "audit-expectation:provider-posture",
  "audit-expectation:redaction-posture",
  "audit-expectation:replay-safety",
  "audit-expectation:observability",
  "audit-expectation:auditability",
  "audit-expectation:onboarding-readiness",
  "audit-expectation:portfolio-readiness",
] as const;

export const AUDIT_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export type AuditSurfaceId = (typeof AUDIT_SURFACE_IDS)[number];
export type AuditPhaseId = (typeof AUDIT_PHASE_IDS)[number];
export type AuditDimensionId = (typeof AUDIT_DIMENSION_IDS)[number];
export type AuditExpectationId = (typeof AUDIT_EXPECTATION_IDS)[number];
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AuditSurfaceIdSchema = z.enum(AUDIT_SURFACE_IDS);
export const AuditPhaseIdSchema = z.enum(AUDIT_PHASE_IDS);
export const AuditDimensionIdSchema = z.enum(AUDIT_DIMENSION_IDS);
export const AuditExpectationIdSchema = z.enum(AUDIT_EXPECTATION_IDS);
export const AuditSeveritySchema = z.enum(AUDIT_SEVERITIES);

export const CrossPhaseAuditPostureSchema = z.strictObject({
  contract_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  audit_execution_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  runtime_execution_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  approval_bypass_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
  source_material_exposure_enabled: z.literal(false),
});

export const AuditDimensionSchema = z.strictObject({
  dimension_id: AuditDimensionIdSchema,
  label: z.string().trim().min(1).max(160),
  audit_goal: z.string().trim().min(1).max(420),
  severity: AuditSeveritySchema,
  expectation_id: AuditExpectationIdSchema,
  posture: CrossPhaseAuditPostureSchema,
});

export const AuditExpectationSchema = z.strictObject({
  expectation_id: AuditExpectationIdSchema,
  dimension_id: AuditDimensionIdSchema,
  severity: AuditSeveritySchema,
  expectation: z.string().trim().min(1).max(520),
  evidence_guidance: z.array(z.string().trim().min(1).max(220)).min(1),
  future_audit_only: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export const AuditSurfaceSchema = z.strictObject({
  surface_id: AuditSurfaceIdSchema,
  phase_id: AuditPhaseIdSchema,
  phase_label: z.string().trim().min(1).max(160),
  audit_scope: z.string().trim().min(1).max(420),
  dimension_ids: z.array(AuditDimensionIdSchema).min(1),
  expectation_ids: z.array(AuditExpectationIdSchema).min(1),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  closeout_source: z.string().trim().min(1).max(220),
  posture: CrossPhaseAuditPostureSchema,
});

export const CrossPhaseAuditContractSchema = z.strictObject({
  contract_version: z.literal(CROSS_PHASE_AUDIT_CONTRACT_VERSION),
  contract_id: z.literal("phase-20e1-cross-phase-audit-contract"),
  phase: z.literal("20E.1"),
  summary: z.string().trim().min(1).max(520),
  surfaces: z.array(AuditSurfaceSchema),
  dimensions: z.array(AuditDimensionSchema),
  expectations: z.array(AuditExpectationSchema),
  posture: CrossPhaseAuditPostureSchema,
});

export const CrossPhaseAuditSummarySchema = z.strictObject({
  contract_version: z.literal(CROSS_PHASE_AUDIT_CONTRACT_VERSION),
  surface_count: z.number().int().positive(),
  dimension_count: z.number().int().positive(),
  expectation_count: z.number().int().positive(),
  represented_phase_count: z.number().int().positive(),
  critical_expectation_count: z.number().int().nonnegative(),
  high_expectation_count: z.number().int().nonnegative(),
  medium_expectation_count: z.number().int().nonnegative(),
  low_expectation_count: z.number().int().nonnegative(),
  phase20e_contract_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export type CrossPhaseAuditPosture = z.infer<
  typeof CrossPhaseAuditPostureSchema
>;
export type AuditDimension = z.infer<typeof AuditDimensionSchema>;
export type AuditExpectation = z.infer<typeof AuditExpectationSchema>;
export type AuditSurface = z.infer<typeof AuditSurfaceSchema>;
export type CrossPhaseAuditContract = z.infer<
  typeof CrossPhaseAuditContractSchema
>;
export type CrossPhaseAuditSummary = z.infer<
  typeof CrossPhaseAuditSummarySchema
>;
