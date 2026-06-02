import { z } from "zod";
import {
  AgentApprovalIntegrationSchema,
  AgentOutputSourceReferenceSchema,
  AgentSuggestionInboxTargetSchema,
} from "./contract";
import { AgentDryRunEnvelopeSchema } from "./dry-run-executor";
import {
  AGENT_OUTPUT_FACTORY_VERSION,
  AgentOutputPreviewSchema,
  AgentOutputPrioritySchema,
  createAgentOutputPreview,
} from "./output-factory";
import { AgentRegistryEntrySchema } from "./registry";

export const CV_MAINTENANCE_AGENT_PREVIEW_VERSION =
  "phase21h.cv-maintenance-preview.v1" as const;

export const CV_MAINTENANCE_SECTIONS = [
  "projects",
  "technical_skills",
  "experience",
  "achievements",
  "portfolio",
] as const;

export const CV_MAINTENANCE_IMPACT_LEVELS = [
  "low",
  "medium",
  "high",
  "portfolio_grade",
] as const;

export const CV_MAINTENANCE_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_model_calls",
  "no_live_github_calls",
  "no_raw_diffs",
  "no_full_logs",
  "no_cv_write",
  "no_vault_write",
  "no_inbox_write",
  "approval_required_for_future_write",
] as const;

const CvIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const CvTextSchema = z.string().trim().min(1).max(360);

export const CvMaintenanceSectionSchema = z.enum(CV_MAINTENANCE_SECTIONS);
export const CvMaintenanceImpactLevelSchema = z.enum(
  CV_MAINTENANCE_IMPACT_LEVELS,
);
export const CvMaintenancePreviewCaveatSchema = z.enum(
  CV_MAINTENANCE_PREVIEW_CAVEATS,
);

export const CvProjectBuildMetadataSchema = z.strictObject({
  project_metadata_id: CvIdSchema,
  project_name: CvTextSchema,
  phase_or_slice: CvTextSchema,
  build_signal_title: CvTextSchema,
  changed_files_count: z.number().int().nonnegative(),
  tests_passed: z.number().int().nonnegative(),
  tests_failed: z.number().int().nonnegative(),
  validation_status: z.enum(["passing", "failing", "unknown"]),
  impact_signal: CvMaintenanceImpactLevelSchema,
  technical_skill_tags: z.array(CvIdSchema).default([]),
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CvBuildMonitorMetadataSchema = z.strictObject({
  build_monitor_ref_id: CvIdSchema,
  highlight_count: z.number().int().nonnegative(),
  risk_count: z.number().int().nonnegative(),
  portfolio_highlight_count: z.number().int().nonnegative(),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CvLibrarianMetadataSchema = z.strictObject({
  librarian_ref_id: CvIdSchema,
  career_source_count: z.number().int().nonnegative(),
  envelope_ids: z.array(CvIdSchema).default([]),
  durable_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const CvVerificationMetadataSchema = z.strictObject({
  verification_ref_id: CvIdSchema,
  verification_status: z.enum([
    "not_requested",
    "pending",
    "completed_metadata_only",
    "failed_closed",
  ]),
  risk_flag_count: z.number().int().nonnegative(),
  raw_verifier_response_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CvMaintenancePreviewInputSchema = z.strictObject({
  preview_version: z.literal(CV_MAINTENANCE_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  project_build_metadata: z.array(CvProjectBuildMetadataSchema).min(1),
  build_monitor_metadata: CvBuildMonitorMetadataSchema.nullable().default(null),
  librarian_metadata: CvLibrarianMetadataSchema.nullable().default(null),
  verification_metadata: CvVerificationMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  model_call_requested: z.literal(false),
  github_call_requested: z.literal(false),
  raw_diffs_included: z.literal(false),
  full_logs_included: z.literal(false),
  cv_write_requested: z.literal(false),
  vault_write_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  approval_bypass_requested: z.literal(false),
});

export const CvAchievementSchema = z.strictObject({
  project_name: CvTextSchema,
  phase_or_slice: CvTextSchema,
  achievement_title: CvTextSchema,
  evidence_refs: z.array(AgentOutputSourceReferenceSchema),
  impact_level: CvMaintenanceImpactLevelSchema,
  suggested_cv_wording_metadata_only: CvTextSchema,
  actionability: z.literal("proposal_required"),
  approval_required: z.literal(true),
  metadata_only: z.literal(true),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
});

export const CvSectionSuggestionSchema = z.strictObject({
  section: CvMaintenanceSectionSchema,
  reason: CvTextSchema,
  priority: AgentOutputPrioritySchema,
  achievement_count: z.number().int().nonnegative(),
  approval_required: z.literal(true),
  metadata_only: z.literal(true),
});

export const CvMaintenancePreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  github_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  cv_write_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  approval_bypass_attempted: z.literal(false),
  raw_diffs_included: z.literal(false),
  full_logs_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CvMaintenanceAgentPreviewSchema = z.strictObject({
  kind: z.literal("cv_maintenance.update_suggestion_preview"),
  preview_version: z.literal(CV_MAINTENANCE_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("cv_maintenance"),
  cv_update_suggestion_preview: z.strictObject({
    title: CvTextSchema,
    summary: CvTextSchema,
    candidate_achievements: z.array(CvAchievementSchema),
    suggested_cv_sections: z.array(CvSectionSuggestionSchema),
    evidence_refs: z.array(AgentOutputSourceReferenceSchema),
    caveats: z.array(CvMaintenancePreviewCaveatSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  approval_metadata: AgentApprovalIntegrationSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  build_monitor_metadata: CvBuildMonitorMetadataSchema.nullable(),
  librarian_metadata: CvLibrarianMetadataSchema.nullable(),
  verification_metadata: CvVerificationMetadataSchema.nullable(),
  governance: CvMaintenancePreviewGovernanceSchema,
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type CvProjectBuildMetadata = z.infer<
  typeof CvProjectBuildMetadataSchema
>;
export type CvAchievement = z.infer<typeof CvAchievementSchema>;
export type CvSectionSuggestion = z.infer<typeof CvSectionSuggestionSchema>;
export type CvMaintenanceAgentPreview = z.infer<
  typeof CvMaintenanceAgentPreviewSchema
>;
export type CvMaintenancePreviewInput = z.infer<
  typeof CvMaintenancePreviewInputSchema
>;
export type CvMaintenanceSection = z.infer<typeof CvMaintenanceSectionSchema>;
export type CvMaintenanceImpactLevel = z.infer<
  typeof CvMaintenanceImpactLevelSchema
>;

export function previewCvMaintenanceAgent(
  input: unknown,
): CvMaintenanceAgentPreview {
  const parsed = CvMaintenancePreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "cv_maintenance") {
    throw new Error(
      "CV Maintenance preview requires the cv_maintenance registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "cv_maintenance") {
    throw new Error(
      "CV Maintenance preview requires a cv_maintenance dry-run.",
    );
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("CV Maintenance preview requires a planned dry-run.");
  }

  const outputPreview = createAgentOutputPreview({
    factory_version: AGENT_OUTPUT_FACTORY_VERSION,
    dry_run: parsed.dry_run,
    registry_entry: parsed.registry_entry,
    fixture_metadata: parsed.dry_run.fixture_metadata,
    metadata_only: true,
    inbox_write_requested: false,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    model_call_requested: false,
  });
  const achievements = achievementsFor(parsed.project_build_metadata);
  const sections = sectionSuggestionsFor(achievements);
  const evidenceRefs = uniqueSources([
    ...outputPreview.source_refs,
    ...achievements.flatMap((achievement) => achievement.evidence_refs),
  ]);

  return CvMaintenanceAgentPreviewSchema.parse({
    kind: "cv_maintenance.update_suggestion_preview",
    preview_version: CV_MAINTENANCE_AGENT_PREVIEW_VERSION,
    agent_id: "cv_maintenance",
    cv_update_suggestion_preview: {
      title: "CV Maintenance update suggestion preview",
      summary: summaryFor(achievements, sections),
      candidate_achievements: achievements,
      suggested_cv_sections: sections,
      evidence_refs: evidenceRefs,
      caveats: [
        "metadata_only",
        "fixture_metadata_only",
        "no_model_calls",
        "no_live_github_calls",
        "no_raw_diffs",
        "no_full_logs",
        "no_cv_write",
        "no_vault_write",
        "no_inbox_write",
        "approval_required_for_future_write",
      ],
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    approval_metadata: outputPreview.approval_metadata,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    build_monitor_metadata: parsed.build_monitor_metadata,
    librarian_metadata: parsed.librarian_metadata,
    verification_metadata: parsed.verification_metadata,
    governance: governanceSummary(),
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function achievementsFor(
  metadata: readonly CvProjectBuildMetadata[],
): CvAchievement[] {
  return [...metadata]
    .sort(
      (left, right) =>
        impactRank(right.impact_signal) - impactRank(left.impact_signal) ||
        right.tests_passed -
          right.tests_failed -
          (left.tests_passed - left.tests_failed),
    )
    .map((item) =>
      CvAchievementSchema.parse({
        project_name: item.project_name,
        phase_or_slice: item.phase_or_slice,
        achievement_title: item.build_signal_title,
        evidence_refs: item.evidence_refs,
        impact_level: item.impact_signal,
        suggested_cv_wording_metadata_only: wordingFor(item),
        actionability: "proposal_required",
        approval_required: true,
        metadata_only: true,
        raw_diff_included: false,
        full_log_included: false,
      }),
    );
}

function sectionSuggestionsFor(
  achievements: readonly CvAchievement[],
): CvSectionSuggestion[] {
  const sections = new Map<CvMaintenanceSection, CvAchievement[]>();
  for (const achievement of achievements) {
    for (const section of sectionsFor(achievement)) {
      sections.set(section, [...(sections.get(section) ?? []), achievement]);
    }
  }
  return [...sections.entries()]
    .sort(
      ([leftSection, leftItems], [rightSection, rightItems]) =>
        priorityRank(priorityForSection(rightSection, rightItems)) -
          priorityRank(priorityForSection(leftSection, leftItems)) ||
        rightItems.length - leftItems.length,
    )
    .map(([section, items]) =>
      CvSectionSuggestionSchema.parse({
        section,
        reason: reasonForSection(section, items),
        priority: priorityForSection(section, items),
        achievement_count: items.length,
        approval_required: true,
        metadata_only: true,
      }),
    );
}

function sectionsFor(achievement: CvAchievement): CvMaintenanceSection[] {
  const sections: CvMaintenanceSection[] = ["projects", "achievements"];
  if (
    achievement.impact_level === "high" ||
    achievement.impact_level === "portfolio_grade"
  ) {
    sections.push("portfolio");
  }
  if (
    /runtime|agent|verification|governance|deepseek|obsidian|typescript/i.test(
      achievement.achievement_title,
    )
  ) {
    sections.push("technical_skills");
  }
  if (achievement.impact_level !== "low") {
    sections.push("experience");
  }
  return [...new Set(sections)];
}

function wordingFor(item: CvProjectBuildMetadata): string {
  const validation =
    item.validation_status === "passing"
      ? `${item.tests_passed} passing tests`
      : item.validation_status === "failing"
        ? `${item.tests_failed} failing tests noted`
        : "validation status unknown";
  return `${item.project_name}: ${item.build_signal_title} during ${item.phase_or_slice}; ${validation}; ${item.changed_files_count} changed files.`;
}

function reasonForSection(
  section: CvMaintenanceSection,
  achievements: readonly CvAchievement[],
): string {
  const best = achievements[0];
  if (!best) return `${section} has no current metadata-backed suggestions.`;
  return `${section} has ${achievements.length} metadata-backed CV suggestion(s), led by ${best.achievement_title}.`;
}

function priorityForSection(
  section: CvMaintenanceSection,
  achievements: readonly CvAchievement[],
): z.infer<typeof AgentOutputPrioritySchema> {
  if (achievements.some((item) => item.impact_level === "portfolio_grade")) {
    return section === "portfolio" ? "high" : "medium";
  }
  if (achievements.some((item) => item.impact_level === "high")) return "high";
  if (achievements.some((item) => item.impact_level === "medium")) {
    return "medium";
  }
  return "low";
}

function summaryFor(
  achievements: readonly CvAchievement[],
  sections: readonly CvSectionSuggestion[],
): string {
  return `Metadata-only CV update preview with ${achievements.length} candidate achievements across ${sections.length} suggested sections.`;
}

function impactRank(impact: CvMaintenanceImpactLevel) {
  return { low: 0, medium: 1, high: 2, portfolio_grade: 3 }[impact];
}

function priorityRank(priority: z.infer<typeof AgentOutputPrioritySchema>) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

function uniqueSources(
  sources: readonly z.infer<typeof AgentOutputSourceReferenceSchema>[],
) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.source_kind}:${source.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function governanceSummary() {
  return CvMaintenancePreviewGovernanceSchema.parse({
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    model_call_attempted: false,
    github_call_attempted: false,
    network_call_attempted: false,
    scheduling_attempted: false,
    cv_write_attempted: false,
    vault_write_attempted: false,
    obsidian_write_attempted: false,
    approval_bypass_attempted: false,
    raw_diffs_included: false,
    full_logs_included: false,
    metadata_only: true,
  });
}
