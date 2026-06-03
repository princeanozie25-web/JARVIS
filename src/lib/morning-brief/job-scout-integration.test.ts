import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GMAIL_READ_ADAPTER_VERSION,
  type GmailReadMessageMetadata,
} from "../google-adapters";
import {
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobScoutDigest,
  rankJobPostings,
} from "../job-scout";
import { composeMorningBrief, type MorningBriefRealInput } from ".";

describe("Morning Brief Job Scout integration contract", () => {
  it("accepts optional Job Scout digest metadata and renders a section", () => {
    const brief = composeMorningBrief(realInput({ includeJobScout: true }));
    const section = brief.sections.find(
      (candidate) => candidate.section_type === "job_scout",
    );

    expect(section).toBeDefined();
    expect(section?.title).toBe("Job Scout digest metadata");
    expect(section?.summary).toBe(
      "3 ranked opportunities supplied; no applications were submitted.",
    );
    expect(section?.item_count).toBe(3);
    expect(section?.metadata.top_opportunity_count).toBe(3);
    expect(section?.metadata.highest_fit_role).toBe(
      "Graduate Applied AI Security Engineer at Sentinel AI Labs",
    );
    expect(section?.metadata.missing_skill_tags).toEqual([
      "design-systems",
      "frontend",
      "kubernetes",
      "react",
    ]);
    expect(section?.metadata.application_submission_attempted).toBe(false);
    expect(section?.metadata.auto_apply_attempted).toBe(false);
    expect(section?.items[0].metadata_flags).toContain(
      "no_application_submitted",
    );
  });

  it("keeps Morning Brief viable when Job Scout metadata is missing", () => {
    const brief = composeMorningBrief(realInput({ includeJobScout: false }));

    expect(brief.composition_status).toBe("degraded");
    expect(brief.sections.map((section) => section.section_type)).toEqual([
      "gmail",
    ]);
    expect(
      brief.sections.some((section) => section.section_type === "job_scout"),
    ).toBe(false);
  });

  it("does not introduce live scheduler, provider, network, write, or submission paths", () => {
    const composerSource = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/composer.ts"),
      "utf8",
    );
    const inputSource = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/real-input-contract.ts"),
      "utf8",
    );
    const imports = `${composerSource}\n${inputSource}`
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(`${composerSource}\n${inputSource}`).not.toMatch(
      /submitApplication|autoApply|sendEmail|writeFile|executeApproval/i,
    );
  });
});

function realInput(options: {
  readonly includeJobScout: boolean;
}): MorningBriefRealInput {
  return {
    input_version: "phase21c.morning-brief-real-input.v1",
    built_at: "2026-06-03T09:00:00.000Z",
    google: {
      account_summary: null,
      gmail: {
        recent_messages: [gmailMessage("gmail-message-1")],
        unread_messages: [],
        metadata_only: true,
        raw_message_bodies_included: false,
      },
      calendar: null,
      drive: null,
      metadata_only: true,
      live_calls_attempted: false,
    },
    jarvis_status_metadata: null,
    agent_preview_metadata: null,
    job_scout_digest: options.includeJobScout ? fixtureDigest() : null,
    metadata_only: true,
    generation_requested: false,
    scheduling_requested: false,
    delivery_requested: false,
    model_call_requested: false,
    network_call_requested: false,
    write_requested: false,
  };
}

function fixtureDigest() {
  return buildJobScoutDigest(
    rankJobPostings(buildFixtureJobPostings(), buildDefaultJobScoutProfile()),
    {
      generated_at: "2026-06-03T08:00:00.000Z",
      digest_id: "job-scout:digest:morning-brief",
    },
  );
}

function gmailMessage(id: string): GmailReadMessageMetadata {
  return {
    adapter_version: GMAIL_READ_ADAPTER_VERSION,
    message_id: id,
    thread_id: `thread-${id}`,
    subject: "Metadata subject",
    sender: "Prince <prince@example.com>",
    sender_domain: "example.com",
    timestamp: "2026-06-03T08:30:00.000Z",
    label_ids: ["INBOX"],
    size_estimate_bytes: 512,
    raw_body_included: false,
    attachment_contents_included: false,
  };
}
