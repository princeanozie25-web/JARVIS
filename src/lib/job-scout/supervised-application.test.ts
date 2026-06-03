import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  approveApplicationDraftPlan,
  buildCoverLetterDraftPlan,
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobFitScore,
  buildSupervisedApplicationDraftPlan,
  completeSupervisedApplicationWithAdapter,
  confirmApplicationPreviewForSubmission,
  createJobApplication,
  generateApplicationFormFillPreview,
  rankJobPostings,
  updateJobApplicationStatus,
  type JobScoutApplicationDraftPlan,
  type JobScoutApplicationFormFillPreview,
  type JobScoutFinalUiConfirmation,
} from ".";

describe("Job Scout supervised application workflow", () => {
  it("builds a selected ranked-job application draft plan that requires user approval", () => {
    const draftPlan = supervisedFixture().draftPlan;

    expect(draftPlan.status).toBe("awaiting_user_approval");
    expect(draftPlan.selected_ranked_job.rank).toBe(1);
    expect(draftPlan.application.status).toBe("ready_to_apply");
    expect(draftPlan.cover_letter_draft.status).toBe("draft_plan_ready");
    expect(draftPlan.planned_form_fields).toHaveLength(4);
    expect(draftPlan.user_approval_required).toBe(true);
    expect(draftPlan.final_ui_confirmation_required).toBe(true);
    expect(draftPlan.governance).toMatchObject({
      supervised_only: true,
      ranked_job_selected: true,
      application_ready_to_apply: true,
      cover_letter_draft_plan_ready: true,
      user_approval_received: false,
      form_fill_preview_generated: false,
      final_ui_confirmation_received: false,
      fake_submission_adapter_invoked: false,
      external_submission_attempted: false,
      no_auto_apply: true,
      no_unsupervised_submit: true,
      credentials_included: false,
      raw_application_body_telemetry_included: false,
    });
  });

  it("blocks draft planning when the tracked application is not ready", () => {
    const fixture = supervisedFixture({ readyApplication: false });

    expect(fixture.draftPlan.status).toBe("blocked_application_not_ready");
    expect(fixture.draftPlan.governance.application_ready_to_apply).toBe(false);
  });

  it("requires explicit user approval before generating a form fill preview", () => {
    const { draftPlan } = supervisedFixture();
    const blocked = generateApplicationFormFillPreview({
      draft_plan: draftPlan,
      approval: null,
    });
    const approval = approveApplicationDraftPlan({
      draft_plan: draftPlan,
      approved: true,
    });
    const preview = generateApplicationFormFillPreview({
      draft_plan: draftPlan,
      approval,
    });

    expect(blocked.status).toBe("blocked_missing_user_approval");
    expect(blocked.fields).toHaveLength(0);
    expect(preview.status).toBe("ready_for_final_confirmation");
    expect(preview.generated_after_user_approval).toBe(true);
    expect(preview.final_ui_confirmation_required).toBe(true);
    expect(preview.submission_adapter_invocation_permitted).toBe(false);
    expect(preview.fields.map((field) => field.credentials_field)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(preview.telemetry).toMatchObject({
      metadata_only: true,
      credentials_included: false,
      raw_application_body_included: false,
      field_count: 4,
    });
  });

  it("does not invoke the fake submission adapter without final UI confirmation", async () => {
    const { preview } = approvedPreviewFixture();
    let calls = 0;

    const result = await completeSupervisedApplicationWithAdapter({
      preview,
      final_confirmation: null,
      adapter: {
        adapter_id: "job-scout:fake-submit",
        source_id:
          preview.draft_plan.selected_ranked_job.posting.source.source_id,
        complete() {
          calls += 1;
          return fakeAdapterResult(preview);
        },
      },
    });

    expect(calls).toBe(0);
    expect(result.status).toBe("blocked_missing_final_ui_confirmation");
    expect(result.adapter_result).toBeNull();
    expect(result.governance.fake_submission_adapter_invoked).toBe(false);
    expect(result.governance.no_unsupervised_submit).toBe(true);
  });

  it("requires visible preview review before the injected fake adapter can complete", async () => {
    const { preview } = approvedPreviewFixture();
    const confirmation = confirmApplicationPreviewForSubmission({
      preview,
      confirmed: true,
      visible_preview_reviewed: false,
    });
    let calls = 0;

    const result = await completeSupervisedApplicationWithAdapter({
      preview,
      final_confirmation: confirmation,
      adapter: {
        adapter_id: "job-scout:fake-submit",
        source_id:
          preview.draft_plan.selected_ranked_job.posting.source.source_id,
        complete() {
          calls += 1;
          return fakeAdapterResult(preview);
        },
      },
    });

    expect(calls).toBe(0);
    expect(result.status).toBe("blocked_missing_final_ui_confirmation");
    expect(result.governance.final_ui_confirmation_received).toBe(false);
  });

  it("invokes only a matching injected fake adapter after approval, preview, and final UI confirmation", async () => {
    const { preview, confirmation } = approvedPreviewFixture();
    let calls = 0;

    const result = await completeSupervisedApplicationWithAdapter({
      submission_id: "job-scout:supervised-submission:test",
      preview,
      final_confirmation: confirmation,
      adapter: {
        adapter_id: "job-scout:fake-submit",
        source_id:
          preview.draft_plan.selected_ranked_job.posting.source.source_id,
        complete(confirmedPreview, finalConfirmation) {
          calls += 1;
          expect(confirmedPreview.preview_id).toBe(preview.preview_id);
          expect(finalConfirmation.confirmed).toBe(true);
          return fakeAdapterResult(preview);
        },
      },
    });

    expect(calls).toBe(1);
    expect(result.status).toBe("fake_submission_completed");
    expect(result.adapter_result).toMatchObject({
      fake_submission: true,
      credentials_used: false,
      raw_application_body_logged: false,
      network_call_attempted: false,
    });
    expect(result.governance).toMatchObject({
      supervised_only: true,
      user_approval_required: true,
      user_approval_received: true,
      final_ui_confirmation_required: true,
      final_ui_confirmation_received: true,
      fake_submission_adapter_invoked: true,
      external_submission_attempted: false,
      no_auto_apply: true,
      no_unsupervised_submit: true,
      credentials_included: false,
      raw_application_body_telemetry_included: false,
    });
    expect(result.telemetry).toMatchObject({
      metadata_only: true,
      preview_field_count: 4,
      credentials_included: false,
      raw_application_body_included: false,
      network_call_attempted_by_boundary: false,
    });
  });

  it("keeps supervised application source free of direct live integration, credential, and raw body telemetry paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/supervised-application.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(/autoApply|sendEmail|writeFile/i);
    expect(source).not.toMatch(/credentials_(included|used):\s*true/i);
    expect(source).not.toMatch(
      /raw_application_body_(included|logged|telemetry_included):\s*true/i,
    );
  });
});

function supervisedFixture(
  options: { readonly readyApplication?: boolean } = {},
): { readonly draftPlan: JobScoutApplicationDraftPlan } {
  const profile = buildDefaultJobScoutProfile();
  const ranking = rankJobPostings(buildFixtureJobPostings(), profile);
  const rankedJob = ranking.ranked_jobs[0];
  const application =
    options.readyApplication === false
      ? createJobApplication({ ranked_job: rankedJob })
      : updateJobApplicationStatus(
          createJobApplication({ ranked_job: rankedJob }),
          "ready_to_apply",
          { updated_at: "2026-06-03T09:00:00.000Z" },
        );
  const coverLetterDraft = buildCoverLetterDraftPlan({
    input_id: "cover-letter-input:supervised-application",
    posting: rankedJob.posting,
    profile,
    fit_score: buildJobFitScore(rankedJob.posting, profile),
    company_notes: ["AI security role."],
    candidate_highlights: ["JARVIS workflow architecture."],
    metadata_only: true,
  });

  return {
    draftPlan: buildSupervisedApplicationDraftPlan({
      ranked_job: rankedJob,
      application,
      cover_letter_draft: coverLetterDraft,
    }),
  };
}

function approvedPreviewFixture(): {
  readonly preview: JobScoutApplicationFormFillPreview;
  readonly confirmation: JobScoutFinalUiConfirmation;
} {
  const { draftPlan } = supervisedFixture();
  const approval = approveApplicationDraftPlan({
    draft_plan: draftPlan,
    approved: true,
  });
  const preview = generateApplicationFormFillPreview({
    draft_plan: draftPlan,
    approval,
  });

  return {
    preview,
    confirmation: confirmApplicationPreviewForSubmission({
      preview,
      confirmed: true,
      visible_preview_reviewed: true,
    }),
  };
}

function fakeAdapterResult(preview: JobScoutApplicationFormFillPreview) {
  return {
    adapter_id: "job-scout:fake-submit",
    source_id: preview.draft_plan.selected_ranked_job.posting.source.source_id,
    outcome: "accepted_fake_submission",
    submitted_at: "2026-06-03T10:06:00.000Z",
    external_reference_id: "fake-ref:job-scout:test",
    fake_submission: true,
    credentials_used: false,
    raw_application_body_logged: false,
    network_call_attempted: false,
  } as const;
}
