import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  APPLICATION_TRACKER_AGENT_PREVIEW_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewApplicationTrackerAgent,
  type ApplicationMetadata,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const GENERATED_AT = "2026-06-02T12:00:00.000Z";

describe("Application Tracker agent preview", () => {
  it("creates a metadata-only application follow-up digest preview", () => {
    const preview = previewApplicationTrackerAgent(baseInput());

    expect(preview.kind).toBe("application_tracker.follow_up_digest_preview");
    expect(preview.agent_id).toBe("application_tracker");
    expect(preview.application_tracking_digest_preview.summary).toContain(
      "Metadata-only application tracker preview",
    );
    expect(
      preview.application_tracking_digest_preview.follow_up_candidates.length,
    ).toBeGreaterThanOrEqual(3);
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.preview_only).toBe(true);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    expect(preview.inbox_write_attempted).toBe(false);
  });

  it("models follow-up candidates, stale applications, and reply-needed indicators", () => {
    const preview = previewApplicationTrackerAgent(baseInput());
    const digest = preview.application_tracking_digest_preview;

    expect(
      digest.follow_up_candidates.map(
        (candidate) => candidate.suggested_action,
      ),
    ).toEqual(
      expect.arrayContaining(["prepare_follow_up", "mark_stale", "monitor"]),
    );
    expect(digest.stale_applications).toContain("application:oldco.backend");
    expect(digest.reply_needed_indicators).toContain(
      "application:deepmind.agent",
    );
    for (const candidate of digest.follow_up_candidates) {
      expect(candidate.raw_email_body_included).toBe(false);
      expect(candidate.raw_application_body_included).toBe(false);
      expect(candidate.metadata_only).toBe(true);
    }
  });

  it("creates outreach draft metadata only and requires approval for outreach", () => {
    const preview = previewApplicationTrackerAgent(baseInput());
    const outreach =
      preview.application_tracking_digest_preview
        .suggested_outreach_drafts_metadata_only;

    expect(outreach.length).toBeGreaterThan(0);
    for (const draft of outreach) {
      expect(draft.recipient_domain).toMatch(/\.example$/);
      expect(draft.subject_hint).toContain("application");
      expect(draft.body_generated).toBe(false);
      expect(draft.raw_email_body_included).toBe(false);
      expect(draft.approval_required).toBe(true);
      expect(draft.metadata_only).toBe(true);
    }
    expect(
      preview.application_tracking_digest_preview.follow_up_candidates
        .filter(
          (candidate) => candidate.suggested_action === "prepare_follow_up",
        )
        .every((candidate) => candidate.approval_required),
    ).toBe(true);
  });

  it("carries proposal approval metadata from the generic runtime output", () => {
    const preview = previewApplicationTrackerAgent(baseInput());

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
    const preview = previewApplicationTrackerAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("application_tracker");
    expect(preview.runtime_output_preview.output_type).toBe("report");
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

  it("keeps evidence refs declared and metadata-only", () => {
    const preview = previewApplicationTrackerAgent(baseInput());
    const refs = preview.application_tracking_digest_preview.evidence_refs;

    expect(refs.length).toBe(3);
    for (const source of refs) {
      expect(source.declared_in_contract).toBe(true);
      expect(source.raw_body_included).toBe(false);
      expect(source.metadata_only).toBe(true);
    }
  });

  it("carries optional Gmail and Verification metadata without OAuth or bodies", () => {
    const preview = previewApplicationTrackerAgent(baseInput());

    expect(preview.gmail_metadata).toMatchObject({
      gmail_metadata_ref_id: "gmail:applications",
      oauth_attempted: false,
      gmail_call_attempted: false,
      raw_email_body_included: false,
      metadata_only: true,
    });
    expect(preview.verification_metadata).toMatchObject({
      verification_ref_id: "verification:applications",
      raw_verifier_response_included: false,
      metadata_only: true,
    });
  });

  it("rejects non-Application-Tracker registry entries and dry-runs", () => {
    expect(() =>
      previewApplicationTrackerAgent({
        ...baseInput(),
        registry_entry: getAgentRegistryEntry("build_monitor"),
      }),
    ).toThrow("application_tracker registry entry");

    expect(() =>
      previewApplicationTrackerAgent({
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
    ).toThrow("application_tracker dry-run");
  });

  it("rejects Gmail, Google API, OAuth, model, email, body, scheduling, inbox, write, and approval bypass requests", () => {
    for (const patch of [
      { gmail_call_requested: true },
      { google_api_call_requested: true },
      { oauth_requested: true },
      { model_call_requested: true },
      { real_email_draft_requested: true },
      { raw_email_bodies_included: true },
      { raw_application_bodies_included: true },
      { scheduling_requested: true },
      { email_send_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
      { approval_bypass_requested: true },
    ]) {
      expect(() =>
        previewApplicationTrackerAgent({
          ...baseInput(),
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("reports governance as preview-only with no side effects", () => {
    const preview = previewApplicationTrackerAgent(baseInput());

    expect(preview.governance.preview_only).toBe(true);
    expect(preview.governance.execution_attempted).toBe(false);
    expect(preview.governance.write_attempted).toBe(false);
    expect(preview.governance.inbox_write_attempted).toBe(false);
    expect(preview.governance.gmail_call_attempted).toBe(false);
    expect(preview.governance.google_api_call_attempted).toBe(false);
    expect(preview.governance.oauth_attempted).toBe(false);
    expect(preview.governance.model_call_attempted).toBe(false);
    expect(preview.governance.scheduling_attempted).toBe(false);
    expect(preview.governance.email_send_attempted).toBe(false);
    expect(preview.governance.real_email_draft_attempted).toBe(false);
    expect(preview.governance.obsidian_write_attempted).toBe(false);
    expect(preview.governance.approval_bypass_attempted).toBe(false);
    expect(preview.governance.raw_email_bodies_included).toBe(false);
    expect(preview.governance.raw_application_bodies_included).toBe(false);
  });

  it("has no Gmail, Google API, OAuth, model, email send, write, inbox, scheduling, or network imports", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/agent-runtime/application-tracker-preview.ts",
      ),
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
        /fetch\s*\(|googleapis|OAuth2Client|octokit|readGmail|sendEmail|gmail\.users/i,
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
    preview_version: APPLICATION_TRACKER_AGENT_PREVIEW_VERSION,
    dry_run: applicationTrackerDryRun(),
    registry_entry: getAgentRegistryEntry("application_tracker"),
    application_metadata: applicationFixture(),
    gmail_metadata: {
      gmail_metadata_ref_id: "gmail:applications",
      matched_thread_count: 4,
      unread_thread_count: 1,
      reply_needed_count: 2,
      oauth_attempted: false,
      gmail_call_attempted: false,
      raw_email_body_included: false,
      metadata_only: true,
    },
    verification_metadata: {
      verification_ref_id: "verification:applications",
      verification_status: "completed_metadata_only",
      risk_flag_count: 1,
      raw_verifier_response_included: false,
      metadata_only: true,
    },
    generated_at: GENERATED_AT,
    metadata_only: true,
    gmail_call_requested: false,
    google_api_call_requested: false,
    oauth_requested: false,
    model_call_requested: false,
    real_email_draft_requested: false,
    raw_email_bodies_included: false,
    raw_application_bodies_included: false,
    scheduling_requested: false,
    email_send_requested: false,
    inbox_write_requested: false,
    write_requested: false,
    approval_bypass_requested: false,
  };
}

function applicationTrackerDryRun() {
  const entry = getAgentRegistryEntry("application_tracker");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "application_tracker",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "report",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    }),
    registry_entry: entry,
    fixture_metadata: {
      fixture_id: "fixture:application.tracker.preview",
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

function applicationFixture(): ApplicationMetadata[] {
  const refs = getAgentRegistryEntry(
    "application_tracker",
  ).declared_sources.map((source) =>
    sourceRef(source.source_kind, source.source_id),
  );
  return [
    application(
      "application:deepmind.agent",
      "DeepMind",
      "Agent Systems Intern",
      "applied",
      "2026-05-20T09:00:00.000Z",
      "2026-05-24T09:00:00.000Z",
      "2026-06-01T09:00:00.000Z",
      "gmail_metadata",
      "critical",
      [refs[0], refs[2]],
    ),
    application(
      "application:oldco.backend",
      "OldCo",
      "Backend Engineer",
      "screening",
      "2026-04-01T09:00:00.000Z",
      "2026-04-20T09:00:00.000Z",
      "2026-05-01T09:00:00.000Z",
      "company_portal",
      "medium",
      [refs[2]],
    ),
    application(
      "application:openai.platform",
      "OpenAI",
      "Platform Engineering Intern",
      "interviewing",
      "2026-05-28T09:00:00.000Z",
      "2026-06-01T09:00:00.000Z",
      "2026-06-05T09:00:00.000Z",
      "calendar_metadata",
      "high",
      [refs[1], refs[2]],
    ),
    application(
      "application:done.rejected",
      "DoneCo",
      "Frontend Intern",
      "rejected",
      "2026-05-01T09:00:00.000Z",
      "2026-05-15T09:00:00.000Z",
      null,
      "gmail_metadata",
      "low",
      [refs[0]],
    ),
  ];
}

function application(
  applicationId: string,
  company: string,
  roleTitle: string,
  status: ApplicationMetadata["status"],
  appliedAt: string | null,
  lastContactAt: string | null,
  followUpDueAt: string | null,
  source: ApplicationMetadata["source"],
  priority: ApplicationMetadata["priority"],
  evidenceRefs: ApplicationMetadata["evidence_refs"],
): ApplicationMetadata {
  return {
    application_id: applicationId,
    company,
    role_title: roleTitle,
    status,
    applied_at: appliedAt,
    last_contact_at: lastContactAt,
    follow_up_due_at: followUpDueAt,
    source,
    priority,
    evidence_refs: evidenceRefs,
    raw_email_body_included: false,
    raw_application_body_included: false,
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
