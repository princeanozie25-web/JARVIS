import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildApplicationTimeline,
  createJobApplication,
  rankJobPostings,
  summarizeJobApplications,
  updateJobApplicationStatus,
} from ".";

describe("Job Scout application tracker", () => {
  it("creates deterministic metadata-only applications from ranked jobs", () => {
    const ranked = rankedJob();

    expect(createJobApplication({ ranked_job: ranked })).toEqual(
      createJobApplication({ ranked_job: ranked }),
    );
    const application = createJobApplication({ ranked_job: ranked });
    expect(application.status).toBe("discovered");
    expect(application.application_id).toBe(
      "application:job:applied-ai-security-graduate",
    );
    expect(application.fit_score).toBe(ranked.score.fit_score);
    expect(application.governance.persisted).toBe(false);
    expect(application.governance.email_send_attempted).toBe(false);
    expect(application.governance.calendar_write_attempted).toBe(false);
    expect(application.governance.submission_attempted).toBe(false);
  });

  it("updates lifecycle statuses and timeline deterministically", () => {
    const application = createJobApplication({ ranked_job: rankedJob() });
    const updated = updateJobApplicationStatus(application, "ready_to_apply", {
      updated_at: "2026-06-03T09:00:00.000Z",
      note: "Prepared for human review.",
    });

    expect(updated.status).toBe("ready_to_apply");
    expect(updated.timeline.latest_status).toBe("ready_to_apply");
    expect(updated.timeline.events.map((event) => event.status)).toEqual([
      "discovered",
      "ready_to_apply",
    ]);
    expect(updated.timeline.events.every((event) => event.metadata_only)).toBe(
      true,
    );
    expect(
      updated.timeline.events.every(
        (event) => !event.external_action_attempted,
      ),
    ).toBe(true);
  });

  it("builds sorted timelines from supplied metadata events", () => {
    const timeline = buildApplicationTimeline({
      application_id: "application:test",
      events: [
        {
          event_id: "event:2",
          occurred_at: "2026-06-03T10:00:00.000Z",
          status: "preparing",
          note: "Preparing.",
          metadata_only: true,
          external_action_attempted: false,
        },
        {
          event_id: "event:1",
          occurred_at: "2026-06-03T09:00:00.000Z",
          status: "shortlisted",
          note: "Shortlisted.",
          metadata_only: true,
          external_action_attempted: false,
        },
      ],
    });

    expect(timeline.events.map((event) => event.event_id)).toEqual([
      "event:1",
      "event:2",
    ]);
    expect(timeline.latest_status).toBe("preparing");
  });

  it("summarizes applications without persistence or external actions", () => {
    const base = createJobApplication({ ranked_job: rankedJob() });
    const ready = updateJobApplicationStatus(base, "ready_to_apply", {
      updated_at: "2026-06-03T09:00:00.000Z",
    });
    const summary = summarizeJobApplications([base, ready]);

    expect(summary.application_count).toBe(2);
    expect(summary.status_counts.discovered).toBe(1);
    expect(summary.status_counts.ready_to_apply).toBe(1);
    expect(summary.ready_for_human_review_count).toBe(1);
    expect(summary.persisted).toBe(false);
    expect(summary.external_action_attempted).toBe(false);
  });

  it("keeps tracker source free of network, provider, write, email, calendar, and submission paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/application-tracker.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(
      /submitApplication|autoApply|sendEmail|createCalendar|writeFile|executeApproval/i,
    );
  });
});

function rankedJob() {
  return rankJobPostings(
    buildFixtureJobPostings(),
    buildDefaultJobScoutProfile(),
  ).ranked_jobs[0];
}
