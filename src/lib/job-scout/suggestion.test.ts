import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION,
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobScoutDigest,
  buildJobScoutSuggestionPayload,
  planJobScoutSuggestionInboxWrite,
  rankJobPostings,
  type JobScoutSuggestionWriter,
} from ".";

describe("Job Scout suggestion payload", () => {
  it("builds a deterministic Suggestion Inbox-ready payload", () => {
    const digest = fixtureDigest();

    expect(buildJobScoutSuggestionPayload(digest)).toEqual(
      buildJobScoutSuggestionPayload(digest),
    );
  });

  it("preserves ranked jobs, fit scores, missing skills, and recommendations", () => {
    const payload = buildJobScoutSuggestionPayload(fixtureDigest());

    expect(payload.payload_version).toBe(JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION);
    expect(payload.kind).toBe("suggestion.digest");
    expect(payload.source_kind).toBe("job_scout.digest");
    expect(payload.digest_id).toBe("job-scout:digest:test");
    expect(payload.top_ranked_jobs[0].posting_id).toBe(
      "job:applied-ai-security-graduate",
    );
    expect(payload.top_ranked_jobs[0].fit_score).toBeGreaterThanOrEqual(85);
    expect(
      payload.missing_skill_summary.map((skill) => skill.skill_tag),
    ).toEqual(["design-systems", "frontend", "kubernetes", "react"]);
    expect(payload.recommended_next_actions[0]).toMatch(/manual review/i);
  });

  it("includes governance metadata with no execution or submission affordance", () => {
    const payload = buildJobScoutSuggestionPayload(fixtureDigest());

    expect(payload.governance.suggestion_only).toBe(true);
    expect(payload.governance.digest_only).toBe(true);
    expect(payload.governance.application_submission_supported).toBe(false);
    expect(payload.governance.auto_apply_supported).toBe(false);
    expect(payload.governance.auto_send_supported).toBe(false);
    expect(payload.governance.execution_supported).toBe(false);
    expect(payload.governance.approval_finalization_supported).toBe(false);
    expect(payload.application_submission_attempted).toBe(false);
    expect(payload.auto_apply_attempted).toBe(false);
    expect(payload.auto_send_attempted).toBe(false);
    expect(payload.write_attempted).toBe(false);
    expect(payload.execution_attempted).toBe(false);
  });

  it("defaults write planning to dry-run and no-write", async () => {
    const payload = buildJobScoutSuggestionPayload(fixtureDigest());
    const plan = await planJobScoutSuggestionInboxWrite(payload);

    expect(plan.status).toBe("dry_run");
    expect(plan.dry_run).toBe(true);
    expect(plan.writer_injected).toBe(false);
    expect(plan.writer_result).toBeNull();
    expect(plan.real_inbox_write_attempted).toBe(false);
    expect(plan.write_attempted).toBe(false);
    expect(plan.execution_attempted).toBe(false);
    expect(plan.application_submission_attempted).toBe(false);
    expect(plan.approval_finalization_attempted).toBe(false);
  });

  it("supports injected preview-only writers without real inbox writes", async () => {
    const payload = buildJobScoutSuggestionPayload(fixtureDigest());
    const seen: string[] = [];
    const writer: JobScoutSuggestionWriter = {
      writer_id: "job-scout-test-writer",
      preview_only: true,
      writePreviewPayload(input) {
        seen.push(input.suggestion_id);
        return {
          writer_id: "job-scout-test-writer",
          accepted: true,
          wrote_to_real_inbox: false,
          result_metadata_only: true,
        };
      },
    };

    const plan = await planJobScoutSuggestionInboxWrite(payload, writer);

    expect(plan.status).toBe("injected_writer_planned");
    expect(seen).toEqual([payload.suggestion_id]);
    expect(plan.writer_result?.accepted).toBe(true);
    expect(plan.writer_result?.wrote_to_real_inbox).toBe(false);
    expect(plan.real_inbox_write_attempted).toBe(false);
    expect(plan.write_attempted).toBe(false);
  });

  it("keeps suggestion source free of network, provider, write, and submission helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/suggestion.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(
      /submitApplication|autoApply|sendEmail|writeFile|executeApproval/i,
    );
  });
});

function fixtureDigest() {
  return buildJobScoutDigest(
    rankJobPostings(buildFixtureJobPostings(), buildDefaultJobScoutProfile()),
    {
      generated_at: "2026-06-03T08:00:00.000Z",
      digest_id: "job-scout:digest:test",
    },
  );
}
