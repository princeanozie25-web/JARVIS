import { z } from "zod";
import {
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

export const BUILD_MONITOR_AGENT_PREVIEW_VERSION =
  "phase21h.build-monitor-preview.v1" as const;

export const BUILD_MONITOR_HIGHLIGHT_USES = [
  "portfolio",
  "linkedin",
  "readme",
  "none",
] as const;

export const BUILD_MONITOR_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_live_github_calls",
  "no_raw_diffs",
  "no_full_logs",
  "no_model_calls",
  "no_inbox_write",
] as const;

const BuildMonitorIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const BuildMonitorTextSchema = z.string().trim().min(1).max(360);
const CommitShaSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{7,64}$/)
  .nullable();

export const BuildMonitorHighlightUseSchema = z.enum(
  BUILD_MONITOR_HIGHLIGHT_USES,
);
export const BuildMonitorPreviewCaveatSchema = z.enum(
  BUILD_MONITOR_PREVIEW_CAVEATS,
);

export const BuildMonitorNotableChangeSchema = z.strictObject({
  change_id: BuildMonitorIdSchema,
  title: BuildMonitorTextSchema,
  area: z.enum([
    "architecture",
    "tests",
    "ui",
    "docs",
    "runtime",
    "governance",
  ]),
  impact: z.enum(["low", "medium", "high"]),
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const BuildMonitorRiskSchema = z.strictObject({
  risk_id: BuildMonitorIdSchema,
  title: BuildMonitorTextSchema,
  severity: AgentOutputPrioritySchema,
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const BuildMonitorGitNexusRefSchema = z.strictObject({
  ref_id: BuildMonitorIdSchema,
  artifact_type: z.enum([
    "repo_graph",
    "dependency_cluster",
    "call_chain",
    "execution_flow",
    "code_wiki_page",
    "blast_radius_report",
    "stale_index_report",
  ]),
  artifact_hash: BuildMonitorIdSchema.nullable().default(null),
  raw_graph_included: z.literal(false),
  raw_diff_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const BuildMonitorMetadataSchema = z.strictObject({
  build_metadata_id: BuildMonitorIdSchema,
  changed_files_count: z.number().int().nonnegative(),
  tests_passed: z.number().int().nonnegative(),
  tests_failed: z.number().int().nonnegative(),
  test_files_count: z.number().int().nonnegative(),
  latest_commit_sha: CommitShaSchema,
  current_phase_or_slice: BuildMonitorTextSchema,
  notable_changes: z.array(BuildMonitorNotableChangeSchema).default([]),
  risks: z.array(BuildMonitorRiskSchema).default([]),
  gitnexus_refs: z.array(BuildMonitorGitNexusRefSchema).default([]),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const BuildMonitorVerificationMetadataSchema = z.strictObject({
  verification_ref_id: BuildMonitorIdSchema,
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

export const BuildMonitorPreviewInputSchema = z.strictObject({
  preview_version: z.literal(BUILD_MONITOR_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  build_metadata: BuildMonitorMetadataSchema,
  verification_metadata:
    BuildMonitorVerificationMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  raw_diffs_included: z.literal(false),
  full_logs_included: z.literal(false),
  model_call_requested: z.literal(false),
  github_call_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
  git_mutation_requested: z.literal(false),
});

export const BuildMonitorPhaseSummarySchema = z.strictObject({
  current_phase_or_slice: BuildMonitorTextSchema,
  changed_files_count: z.number().int().nonnegative(),
  latest_commit_sha: CommitShaSchema,
  notable_change_count: z.number().int().nonnegative(),
  gitnexus_ref_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const BuildMonitorTestStatusSummarySchema = z.strictObject({
  tests_passed: z.number().int().nonnegative(),
  tests_failed: z.number().int().nonnegative(),
  test_files_count: z.number().int().nonnegative(),
  status: z.enum(["passing", "failing", "unknown"]),
  metadata_only: z.literal(true),
  full_log_included: z.literal(false),
});

export const BuildMonitorRiskCaveatSummarySchema = z.strictObject({
  risk_count: z.number().int().nonnegative(),
  highest_severity: AgentOutputPrioritySchema,
  caveats: z.array(BuildMonitorPreviewCaveatSchema),
  metadata_only: z.literal(true),
});

export const BuildMonitorHighlightSchema = z.strictObject({
  title: BuildMonitorTextSchema,
  reason: BuildMonitorTextSchema,
  evidence_refs: z.array(AgentOutputSourceReferenceSchema),
  priority: AgentOutputPrioritySchema,
  suggested_use: BuildMonitorHighlightUseSchema,
  metadata_only: z.literal(true),
  raw_diff_included: z.literal(false),
  full_log_included: z.literal(false),
});

export const BuildMonitorPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  github_call_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  git_commit_attempted: z.literal(false),
  git_push_attempted: z.literal(false),
  project_file_mutation_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  raw_diffs_included: z.literal(false),
  full_logs_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const BuildMonitorAgentPreviewSchema = z.strictObject({
  kind: z.literal("build_monitor.progress_digest_preview"),
  preview_version: z.literal(BUILD_MONITOR_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("build_monitor"),
  build_progress_digest_preview: z.strictObject({
    title: BuildMonitorTextSchema,
    summary: BuildMonitorTextSchema,
    phase_slice_summary: BuildMonitorPhaseSummarySchema,
    test_status_summary: BuildMonitorTestStatusSummarySchema,
    risk_caveat_summary: BuildMonitorRiskCaveatSummarySchema,
    highlights: z.array(BuildMonitorHighlightSchema),
    source_refs: z.array(AgentOutputSourceReferenceSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  verification_metadata: BuildMonitorVerificationMetadataSchema.nullable(),
  governance: BuildMonitorPreviewGovernanceSchema,
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type BuildMonitorHighlightUse = z.infer<
  typeof BuildMonitorHighlightUseSchema
>;
export type BuildMonitorMetadata = z.infer<typeof BuildMonitorMetadataSchema>;
export type BuildMonitorHighlight = z.infer<typeof BuildMonitorHighlightSchema>;
export type BuildMonitorAgentPreview = z.infer<
  typeof BuildMonitorAgentPreviewSchema
>;
export type BuildMonitorPreviewInput = z.infer<
  typeof BuildMonitorPreviewInputSchema
>;

export function previewBuildMonitorAgent(
  input: unknown,
): BuildMonitorAgentPreview {
  const parsed = BuildMonitorPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "build_monitor") {
    throw new Error(
      "Build Monitor preview requires the build_monitor registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "build_monitor") {
    throw new Error("Build Monitor preview requires a build_monitor dry-run.");
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Build Monitor preview requires a planned dry-run.");
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
  const highlights = buildHighlights(parsed.build_metadata);
  const sourceRefs = uniqueSources([
    ...outputPreview.source_refs,
    ...highlights.flatMap((highlight) => highlight.evidence_refs),
  ]);

  return BuildMonitorAgentPreviewSchema.parse({
    kind: "build_monitor.progress_digest_preview",
    preview_version: BUILD_MONITOR_AGENT_PREVIEW_VERSION,
    agent_id: "build_monitor",
    build_progress_digest_preview: {
      title: "Build Monitor progress digest preview",
      summary: summaryFor(parsed.build_metadata),
      phase_slice_summary: phaseSummaryFor(parsed.build_metadata),
      test_status_summary: testSummaryFor(parsed.build_metadata),
      risk_caveat_summary: riskSummaryFor(parsed.build_metadata),
      highlights,
      source_refs: sourceRefs,
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    verification_metadata: parsed.verification_metadata,
    governance: governanceSummary(),
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function phaseSummaryFor(metadata: BuildMonitorMetadata) {
  return BuildMonitorPhaseSummarySchema.parse({
    current_phase_or_slice: metadata.current_phase_or_slice,
    changed_files_count: metadata.changed_files_count,
    latest_commit_sha: metadata.latest_commit_sha,
    notable_change_count: metadata.notable_changes.length,
    gitnexus_ref_count: metadata.gitnexus_refs.length,
    metadata_only: true,
  });
}

function testSummaryFor(metadata: BuildMonitorMetadata) {
  return BuildMonitorTestStatusSummarySchema.parse({
    tests_passed: metadata.tests_passed,
    tests_failed: metadata.tests_failed,
    test_files_count: metadata.test_files_count,
    status:
      metadata.test_files_count === 0
        ? "unknown"
        : metadata.tests_failed > 0
          ? "failing"
          : "passing",
    metadata_only: true,
    full_log_included: false,
  });
}

function riskSummaryFor(metadata: BuildMonitorMetadata) {
  return BuildMonitorRiskCaveatSummarySchema.parse({
    risk_count: metadata.risks.length,
    highest_severity: metadata.risks.length
      ? highestPriority(metadata.risks.map((risk) => risk.severity))
      : "low",
    caveats: [
      "metadata_only",
      "fixture_metadata_only",
      "no_live_github_calls",
      "no_raw_diffs",
      "no_full_logs",
      "no_model_calls",
      "no_inbox_write",
    ],
    metadata_only: true,
  });
}

function buildHighlights(
  metadata: BuildMonitorMetadata,
): BuildMonitorHighlight[] {
  const notable = metadata.notable_changes
    .filter((change) => change.impact !== "low")
    .sort((a, b) => impactRank(b.impact) - impactRank(a.impact))
    .map((change) =>
      BuildMonitorHighlightSchema.parse({
        title: change.title,
        reason: `${change.area} change with ${change.impact} implementation signal.`,
        evidence_refs: change.evidence_refs,
        priority: change.impact === "high" ? "high" : "medium",
        suggested_use: suggestedUseFor(change.area),
        metadata_only: true,
        raw_diff_included: false,
        full_log_included: false,
      }),
    );
  if (metadata.tests_failed === 0 && metadata.test_files_count > 0) {
    notable.push(
      BuildMonitorHighlightSchema.parse({
        title: "Validation suite passing",
        reason: `${metadata.tests_passed} tests passed across ${metadata.test_files_count} test files.`,
        evidence_refs: [],
        priority: "medium",
        suggested_use: "readme",
        metadata_only: true,
        raw_diff_included: false,
        full_log_included: false,
      }),
    );
  }
  if (notable.length === 0) {
    notable.push(
      BuildMonitorHighlightSchema.parse({
        title: "Build metadata captured",
        reason: "Metadata-only build progress preview is available.",
        evidence_refs: [],
        priority: "low",
        suggested_use: "none",
        metadata_only: true,
        raw_diff_included: false,
        full_log_included: false,
      }),
    );
  }
  return notable.slice(0, 4);
}

function summaryFor(metadata: BuildMonitorMetadata): string {
  const testStatus =
    metadata.test_files_count === 0
      ? "unknown test status"
      : metadata.tests_failed > 0
        ? `${metadata.tests_failed} failing tests`
        : `${metadata.tests_passed} passing tests`;
  return `${metadata.current_phase_or_slice} metadata preview with ${metadata.changed_files_count} changed files and ${testStatus}.`;
}

function suggestedUseFor(
  area: z.infer<typeof BuildMonitorNotableChangeSchema>["area"],
): BuildMonitorHighlightUse {
  if (area === "architecture" || area === "runtime") return "portfolio";
  if (area === "governance" || area === "tests") return "linkedin";
  if (area === "docs" || area === "ui") return "readme";
  return "none";
}

function highestPriority(
  priorities: readonly z.infer<typeof AgentOutputPrioritySchema>[],
) {
  return priorities.reduce((highest, priority) =>
    priorityRank(priority) > priorityRank(highest) ? priority : highest,
  );
}

function priorityRank(priority: z.infer<typeof AgentOutputPrioritySchema>) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

function impactRank(
  impact: z.infer<typeof BuildMonitorNotableChangeSchema>["impact"],
) {
  return { low: 0, medium: 1, high: 2 }[impact];
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
  return BuildMonitorPreviewGovernanceSchema.parse({
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    github_call_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    scheduling_attempted: false,
    git_commit_attempted: false,
    git_push_attempted: false,
    project_file_mutation_attempted: false,
    obsidian_write_attempted: false,
    raw_diffs_included: false,
    full_logs_included: false,
    metadata_only: true,
  });
}
