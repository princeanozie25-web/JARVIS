import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  acquireJobsThroughAdapter,
  buildCoverLetterDraftPlan,
  buildDefaultJobScoutProfile,
  buildDefaultJobSourceAcquisitionConfigs,
  buildFixtureJobPostings,
  buildJobFitScore,
  buildJobScoutSubmissionPlan,
  evaluateJobSourceAcquisitionConfig,
  importJobFeed,
  rankJobPostings,
  submitJobScoutApplication,
  type JobSourceAcquisitionAdapter,
} from ".";

const now = "2026-06-03T09:00:00.000Z";

describe("Job Scout realization acquisition and supervised submission", () => {
  it("enforces disabled and access-disallowed acquisition source configs", async () => {
    const configs = buildDefaultJobSourceAcquisitionConfigs();
    const linkedin = configFor(configs, "source:linkedin");
    const request = {
      request_id: "job-acquisition:linkedin",
      source_id: "source:linkedin",
      requested_at: now,
      expected_record_limit: 25,
      metadata_only: true as const,
    };
    const evaluation = evaluateJobSourceAcquisitionConfig({
      config: linkedin,
      request,
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.adapter_invocation_permitted).toBe(false);
    expect(evaluation.reasons).toEqual(
      expect.arrayContaining([
        "config_disabled",
        "source_access_tos_disallowed",
        "form_automation_not_permitted",
      ]),
    );
    expect(evaluation.governance).toMatchObject({
      disabled_config_enforced: true,
      tos_disallowed_config_enforced: true,
      metadata_only: true,
      credentials_included: false,
      raw_source_payload_included: false,
      network_call_attempted: false,
      automation_attempted: false,
    });

    let invoked = false;
    const result = await acquireJobsThroughAdapter({
      config: linkedin,
      request,
      adapter: {
        adapter_id: "fake:linkedin",
        source_id: "source:linkedin",
        acquisition_method: "structured_export",
        acquire() {
          invoked = true;
          throw new Error("must not acquire");
        },
      },
    });

    expect(result.feed).toBeNull();
    expect(result.adapter.invoked).toBe(false);
    expect(invoked).toBe(false);
  });

  it("acquires supplied feed data through an injected adapter when source policy allows it", async () => {
    const configs = buildDefaultJobSourceAcquisitionConfigs();
    const manual = configFor(configs, "source:manual");
    const request = {
      request_id: "job-acquisition:manual",
      source_id: "source:manual",
      requested_at: now,
      expected_record_limit: 25,
      metadata_only: true as const,
    };
    const adapter: JobSourceAcquisitionAdapter = {
      adapter_id: "fake:manual-feed",
      source_id: "source:manual",
      acquisition_method: "supplied_feed",
      acquire() {
        return importJobFeed({
          feed_version: "phase21i.job-scout-feed-layer.v1",
          feed_id: "feed:manual",
          imported_at: now,
          source: {
            source_id: "source:manual",
            source_type: "manual",
            import_format: "manual_json",
            display_name: "Manual",
            base_url: null,
          },
          records: [
            {
              record_id: "record:one",
              title: "Applied AI Security Graduate",
              company_name: "Example AI",
              company_domain: "example.ai",
              location_label: "Manchester, UK",
              location_type: "uk",
              work_mode: "hybrid",
              role_level: "graduate",
              salary_min_amount: 32000,
              salary_max_amount: 42000,
              salary_currency: "GBP",
              salary_period: "year",
              salary_disclosed: true,
              tags: ["ai", "security"],
              url: "https://example.ai/jobs/1",
              posted_at: now,
              required_skill_tags: ["typescript"],
              preferred_skill_tags: ["security"],
              years_experience_min: null,
              degree_required: null,
              sponsorship_available: null,
              graduate_friendly: true,
              metadata_only: true,
              raw_description_included: false,
            },
          ],
          metadata: {
            record_count: 1,
            supplied_as_input: true,
            metadata_only: true,
            scraping_attempted: false,
            playwright_attempted: false,
            browser_automation_attempted: false,
            external_api_call_attempted: false,
            network_call_attempted: false,
            provider_call_attempted: false,
            filesystem_write_attempted: false,
            database_write_attempted: false,
          },
        });
      },
    };

    const result = await acquireJobsThroughAdapter({
      config: manual,
      request,
      adapter,
    });

    expect(result.evaluation.allowed).toBe(true);
    expect(result.adapter.invoked).toBe(true);
    expect(result.feed?.records).toHaveLength(1);
    expect(result.telemetry).toMatchObject({
      metadata_only: true,
      credentials_included: false,
      raw_source_payload_included: false,
      network_call_attempted_by_boundary: false,
    });
  });

  it("builds a form fill preview without submitting", () => {
    const rankedJob = rankedFixture();
    const draft = draftForRankedJob();
    const plan = buildJobScoutSubmissionPlan({
      ranked_job: rankedJob,
      cover_letter_draft: draft,
    });

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(
      expect.arrayContaining([
        "approval_not_finalized",
        "final_ui_confirmation_missing",
      ]),
    );
    expect(plan.form_fill_preview).toMatchObject({
      ranked_job_id: rankedJob.posting.posting_id,
      preview_required_before_submit: true,
      submit_attempted: false,
      credentials_included: false,
      raw_application_body_included: false,
    });
    expect(plan.form_fill_preview.steps.map((step) => step.step_kind)).toEqual([
      "profile_metadata",
      "cover_letter_attachment",
      "cv_attachment",
      "screening_questions",
      "review_before_submit",
    ]);
    for (const step of plan.form_fill_preview.steps) {
      expect(step.raw_value_included).toBe(false);
      expect(step.submit_attempted).toBe(false);
    }
  });

  it("requires approval and final UI confirmation before an injected submit adapter can run", async () => {
    const blockedPlan = buildJobScoutSubmissionPlan({
      ranked_job: rankedFixture(),
      cover_letter_draft: draftForRankedJob(),
    });
    let invoked = false;
    const blockedResult = await submitJobScoutApplication({
      plan: blockedPlan,
      adapter: {
        submit() {
          invoked = true;
          throw new Error("must not submit");
        },
      },
    });

    expect(blockedResult).toMatchObject({
      status: "blocked",
      adapter_invoked: false,
      submission_attempted: false,
      submitted: false,
    });
    expect(invoked).toBe(false);

    const readyPlan = buildJobScoutSubmissionPlan({
      ranked_job: rankedFixture(),
      cover_letter_draft: draftForRankedJob(),
      approval_gate: {
        approval_status: "approved",
        approval_id: "approval:job-submit:1",
        approved_at: now,
      },
      final_confirmation: {
        final_ui_confirmation_received: true,
        confirmed_at: now,
        confirmation_ref_hash:
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      },
    });
    const submitted = await submitJobScoutApplication({
      plan: readyPlan,
      adapter: {
        submit() {
          return {
            submission_ref_hash:
              "sha256:1111111111111111111111111111111111111111111111111111111111111111",
            submitted_at: now,
            adapter_ref: "fake:submit",
            raw_provider_response_included: false,
            credentials_logged: false,
          };
        },
      },
    });

    expect(readyPlan.status).toBe("preview_ready");
    expect(submitted).toMatchObject({
      status: "submitted",
      adapter_invoked: true,
      submission_attempted: true,
      submitted: true,
    });
    expect(submitted.telemetry).toMatchObject({
      metadata_only: true,
      credentials_included: false,
      raw_application_body_included: false,
      raw_cover_letter_included: false,
    });
  });

  it("does not expose acquisition or submission automation paths in source", () => {
    const acquisition = readFileSync(
      "src/lib/job-scout/acquisition.ts",
      "utf8",
    );
    const submission = readFileSync(
      "src/lib/job-scout/submission-workflow.ts",
      "utf8",
    );

    expect(acquisition).not.toMatch(/playwright|puppeteer|submitApplication/i);
    expect(submission).not.toMatch(/playwright|puppeteer|autoApply|sendEmail/i);
    expect(submission).not.toMatch(/\bfetch\s*\(|\bwriteFile(?:Sync)?\s*\(/);
  });
});

function configFor(
  configs: ReturnType<typeof buildDefaultJobSourceAcquisitionConfigs>,
  sourceId: string,
) {
  const config = configs.find((item) => item.source_id === sourceId);
  if (!config) throw new Error(`missing config ${sourceId}`);
  return config;
}

function rankedFixture() {
  const profile = buildDefaultJobScoutProfile();
  return rankJobPostings(buildFixtureJobPostings(), profile).ranked_jobs[0]!;
}

function draftForRankedJob() {
  const profile = buildDefaultJobScoutProfile();
  const posting = rankedFixture().posting;
  return buildCoverLetterDraftPlan({
    input_id: "cover-letter-input:submission",
    posting,
    profile,
    fit_score: buildJobFitScore(posting, profile),
    company_notes: ["Metadata-only company note."],
    candidate_highlights: ["Built governed JARVIS workflows."],
    metadata_only: true,
  });
}
