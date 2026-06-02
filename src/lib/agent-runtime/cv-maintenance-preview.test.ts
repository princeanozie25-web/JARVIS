import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  CV_MAINTENANCE_AGENT_PREVIEW_VERSION,
  CV_MAINTENANCE_SECTIONS,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewCvMaintenanceAgent,
  type CvProjectBuildMetadata,
} from ".";

const HASH = `sha256:${"f".repeat(64)}`;

describe("CV Maintenance agent preview", () => {
  it("creates a metadata-only CV update suggestion preview", () => {
    const preview = previewCvMaintenanceAgent(baseInput());

    expect(preview.kind).toBe("cv_maintenance.update_suggestion_preview");
    expect(preview.agent_id).toBe("cv_maintenance");
    expect(preview.cv_update_suggestion_preview.summary).toContain(
      "Metadata-only CV update preview",
    );
    expect(
      preview.cv_update_suggestion_preview.candidate_achievements.length,
    ).toBeGreaterThanOrEqual(3);
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.preview_only).toBe(true);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    expect(preview.inbox_write_attempted).toBe(false);
  });

  it("models candidate achievements with evidence and CV wording metadata", () => {
    const preview = previewCvMaintenanceAgent(baseInput());
    const [first] = preview.cv_update_suggestion_preview.candidate_achievements;

    expect(first.project_name).toBe("JARVIS");
    expect(first.impact_level).toBe("portfolio_grade");
    expect(first.actionability).toBe("proposal_required");
    expect(first.approval_required).toBe(true);
    expect(first.suggested_cv_wording_metadata_only).toContain("JARVIS");
    expect(first.evidence_refs.length).toBeGreaterThan(0);
    for (const achievement of preview.cv_update_suggestion_preview
      .candidate_achievements) {
      expect(achievement.raw_diff_included).toBe(false);
      expect(achievement.full_log_included).toBe(false);
      expect(achievement.metadata_only).toBe(true);
    }
  });

  it("suggests approved CV sections from achievement metadata", () => {
    const preview = previewCvMaintenanceAgent(baseInput());
    const sections =
      preview.cv_update_suggestion_preview.suggested_cv_sections.map(
        (section) => section.section,
      );

    expect(sections).toEqual(
      expect.arrayContaining([...CV_MAINTENANCE_SECTIONS]),
    );
    for (const section of preview.cv_update_suggestion_preview
      .suggested_cv_sections) {
      expect(section.approval_required).toBe(true);
      expect(section.achievement_count).toBeGreaterThan(0);
      expect(section.metadata_only).toBe(true);
    }
  });

  it("marks CV updates as proposal-required with approval metadata", () => {
    const preview = previewCvMaintenanceAgent(baseInput());

    expect(preview.approval_metadata).toMatchObject({
      phase18_lifecycle_required: true,
      requires_approval: true,
      approval_status: "not_requested",
      approval_bypass_allowed: false,
      approval_created: false,
      execution_enabled: false,
      metadata_only: true,
    });
    expect(preview.runtime_output_preview.approval_metadata).toMatchObject(
      preview.approval_metadata,
    );
  });

  it("integrates through registry, planner, dry-run executor, and output factory", () => {
    const preview = previewCvMaintenanceAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("cv_maintenance");
    expect(preview.runtime_output_preview.output_type).toBe("draft");
    expect(preview.runtime_output_preview.risk_class).toBe("high");
    expect(preview.runtime_output_preview.preview_only).toBe(true);
    expect(
      preview.runtime_output_preview.verification_metadata
        .verification_required,
    ).toBe(true);
    expect(
      preview.runtime_output_preview.approval_metadata.requires_approval,
    ).toBe(true);
  });

  it("keeps source refs declared and metadata-only", () => {
    const preview = previewCvMaintenanceAgent(baseInput());

    expect(preview.cv_update_suggestion_preview.evidence_refs.length).toBe(3);
    for (const source of preview.cv_update_suggestion_preview.evidence_refs) {
      expect(source.declared_in_contract).toBe(true);
      expect(source.raw_body_included).toBe(false);
      expect(source.metadata_only).toBe(true);
    }
  });

  it("carries optional Build Monitor, Librarian, and Verification metadata", () => {
    const preview = previewCvMaintenanceAgent(baseInput());

    expect(preview.build_monitor_metadata).toMatchObject({
      build_monitor_ref_id: "build-monitor:phase21h",
      highlight_count: 3,
      raw_diff_included: false,
      full_log_included: false,
      metadata_only: true,
    });
    expect(preview.librarian_metadata).toMatchObject({
      librarian_ref_id: "librarian:career",
      durable_write_attempted: false,
      metadata_only: true,
    });
    expect(preview.verification_metadata).toMatchObject({
      verification_ref_id: "verification:cv",
      raw_verifier_response_included: false,
      metadata_only: true,
    });
  });

  it("rejects non-CV registry entries and dry-runs", () => {
    expect(() =>
      previewCvMaintenanceAgent({
        ...baseInput(),
        registry_entry: getAgentRegistryEntry("build_monitor"),
      }),
    ).toThrow("cv_maintenance registry entry");

    expect(() =>
      previewCvMaintenanceAgent({
        ...baseInput(),
        dry_run: executeAgentDryRun({
          executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
          plan: planAgentRun({
            planner_version: AGENT_PLANNER_VERSION,
            agent_id: "build_monitor",
            registry_entry: getAgentRegistryEntry("build_monitor"),
            run_context: "manual",
            available_metadata_sources: availableSources(
              getAgentRegistryEntry("build_monitor"),
            ),
            requested_source_ids: [],
            requested_output_type: "report",
            trigger_metadata: null,
            metadata_only: true,
            execution_requested: false,
            scheduling_requested: false,
            write_requested: false,
          }),
          registry_entry: getAgentRegistryEntry("build_monitor"),
          fixture_metadata: null,
          metadata_only: true,
          execute_real_agent_requested: false,
          source_reads_requested: false,
          suggestion_inbox_write_requested: false,
        }),
      }),
    ).toThrow("cv_maintenance dry-run");
  });

  it("rejects model, GitHub, raw diff/log, write, inbox, scheduling, and approval bypass requests", () => {
    for (const patch of [
      { model_call_requested: true },
      { github_call_requested: true },
      { raw_diffs_included: true },
      { full_logs_included: true },
      { cv_write_requested: true },
      { vault_write_requested: true },
      { inbox_write_requested: true },
      { scheduling_requested: true },
      { approval_bypass_requested: true },
    ]) {
      expect(() =>
        previewCvMaintenanceAgent({
          ...baseInput(),
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("reports governance as preview-only with no side effects", () => {
    const preview = previewCvMaintenanceAgent(baseInput());

    expect(preview.governance.preview_only).toBe(true);
    expect(preview.governance.execution_attempted).toBe(false);
    expect(preview.governance.write_attempted).toBe(false);
    expect(preview.governance.inbox_write_attempted).toBe(false);
    expect(preview.governance.model_call_attempted).toBe(false);
    expect(preview.governance.github_call_attempted).toBe(false);
    expect(preview.governance.network_call_attempted).toBe(false);
    expect(preview.governance.scheduling_attempted).toBe(false);
    expect(preview.governance.cv_write_attempted).toBe(false);
    expect(preview.governance.vault_write_attempted).toBe(false);
    expect(preview.governance.obsidian_write_attempted).toBe(false);
    expect(preview.governance.approval_bypass_attempted).toBe(false);
    expect(preview.governance.raw_diffs_included).toBe(false);
    expect(preview.governance.full_logs_included).toBe(false);
  });

  it("has no model, GitHub, raw file, CV write, vault write, inbox, scheduling, or network imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/cv-maintenance-preview.ts"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/index.ts"),
      "utf8",
    );

    for (const text of [source, index]) {
      expect(text).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
      expect(text).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
      expect(text).not.toMatch(
        /fetch\s*\(|googleapis|octokit|readGmail|readCalendar|readDrive/i,
      );
      expect(text).not.toMatch(
        /createDeepSeek|createOllama|OpenAI|Anthropic|createModelRuntime|modelRuntime/i,
      );
      expect(text).not.toMatch(/readVault|obsidian:index/i);
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});

function baseInput() {
  return {
    preview_version: CV_MAINTENANCE_AGENT_PREVIEW_VERSION,
    dry_run: cvMaintenanceDryRun(),
    registry_entry: getAgentRegistryEntry("cv_maintenance"),
    project_build_metadata: cvFixture(),
    build_monitor_metadata: {
      build_monitor_ref_id: "build-monitor:phase21h",
      highlight_count: 3,
      risk_count: 1,
      portfolio_highlight_count: 2,
      raw_diff_included: false,
      full_log_included: false,
      metadata_only: true,
    },
    librarian_metadata: {
      librarian_ref_id: "librarian:career",
      career_source_count: 4,
      envelope_ids: ["librarian:career.cv"],
      durable_write_attempted: false,
      metadata_only: true,
    },
    verification_metadata: {
      verification_ref_id: "verification:cv",
      verification_status: "completed_metadata_only",
      risk_flag_count: 1,
      raw_verifier_response_included: false,
      metadata_only: true,
    },
    metadata_only: true,
    model_call_requested: false,
    github_call_requested: false,
    raw_diffs_included: false,
    full_logs_included: false,
    cv_write_requested: false,
    vault_write_requested: false,
    inbox_write_requested: false,
    scheduling_requested: false,
    approval_bypass_requested: false,
  };
}

function cvMaintenanceDryRun() {
  const entry = getAgentRegistryEntry("cv_maintenance");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "cv_maintenance",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "draft",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    }),
    registry_entry: entry,
    fixture_metadata: {
      fixture_id: "fixture:cv.maintenance.preview",
      fixture_hash: HASH,
      metadata_record_count: 4,
      metadata_only: true,
      raw_body_included: false,
      model_prompt_included: false,
    },
    metadata_only: true,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    suggestion_inbox_write_requested: false,
  });
}

function cvFixture(): CvProjectBuildMetadata[] {
  const refs = getAgentRegistryEntry("cv_maintenance").declared_sources.map(
    (source) =>
      sourceRef(source.source_kind, source.source_id) satisfies {
        readonly source_kind: typeof source.source_kind;
        readonly source_id: string;
        readonly content_hash: null;
        readonly declared_in_contract: true;
        readonly raw_body_included: false;
        readonly metadata_only: true;
      },
  );
  return [
    projectBuild(
      "project:jarvis.phase21h",
      "JARVIS",
      "Phase 21H Agent Runtime",
      "Agent runtime previews with approval-gated output contracts",
      12,
      4667,
      0,
      "portfolio_grade",
      ["agent-runtime", "governance", "typescript"],
      [refs[0], refs[1]],
    ),
    projectBuild(
      "project:jarvis.deepseek",
      "JARVIS",
      "Phase 21 DeepSeek Live Verification",
      "DeepSeek V4 live verification and local override governance",
      8,
      4667,
      0,
      "high",
      ["deepseek", "model-runtime", "verification"],
      [refs[1], refs[2]],
    ),
    projectBuild(
      "project:jarvis.obsidian",
      "JARVIS",
      "Phase 21 Obsidian Knowledge Pipeline",
      "Obsidian metadata pipeline and wiki drafting preview",
      10,
      4643,
      0,
      "medium",
      ["obsidian", "knowledge-systems"],
      [refs[0], refs[2]],
    ),
  ];
}

function projectBuild(
  projectMetadataId: string,
  projectName: string,
  phaseOrSlice: string,
  buildSignalTitle: string,
  changedFilesCount: number,
  testsPassed: number,
  testsFailed: number,
  impactSignal: CvProjectBuildMetadata["impact_signal"],
  technicalSkillTags: readonly string[],
  evidenceRefs: CvProjectBuildMetadata["evidence_refs"],
): CvProjectBuildMetadata {
  return {
    project_metadata_id: projectMetadataId,
    project_name: projectName,
    phase_or_slice: phaseOrSlice,
    build_signal_title: buildSignalTitle,
    changed_files_count: changedFilesCount,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    validation_status: testsFailed > 0 ? "failing" : "passing",
    impact_signal: impactSignal,
    technical_skill_tags: [...technicalSkillTags],
    evidence_refs: evidenceRefs,
    raw_diff_included: false,
    full_log_included: false,
    metadata_only: true,
  };
}

function sourceRef(
  sourceKind: ReturnType<
    typeof getAgentRegistryEntry
  >["declared_sources"][number]["source_kind"],
  sourceId: string,
) {
  return {
    source_kind: sourceKind,
    source_id: sourceId,
    content_hash: null,
    declared_in_contract: true,
    raw_body_included: false,
    metadata_only: true,
  } as const;
}

function availableSources(entry: ReturnType<typeof getAgentRegistryEntry>) {
  return entry.declared_sources.map((source) => ({
    source_kind: source.source_kind,
    source_id: source.source_id,
    available: true,
    metadata_only: true,
    raw_body_included: false,
  }));
}
