import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MORNING_BRIEF_CONTRACT,
  MORNING_BRIEF_GOVERNANCE,
  MORNING_BRIEF_PRIORITIES,
  MORNING_BRIEF_SECTIONS,
  MorningBriefLibrarianUpdateSchema,
  MorningBriefVerificationMetadataSchema,
  createMorningBriefRequest,
  createMorningBriefSection,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const NOW = "2026-06-02T07:30:00.000Z";

describe("Morning Brief contract", () => {
  it("defines supported sections and priority levels", () => {
    expect(MORNING_BRIEF_SECTIONS).toEqual([
      "today_overview",
      "calendar_summary",
      "inbox_summary",
      "project_focus",
      "knowledge_updates",
      "risk_alerts",
      "recommended_actions",
    ]);
    expect(MORNING_BRIEF_PRIORITIES).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
    expect(MORNING_BRIEF_CONTRACT.governance).toEqual(MORNING_BRIEF_GOVERNANCE);
  });

  it("validates a metadata-only Morning Brief request", () => {
    const request = createMorningBriefRequest({
      kind: "morning_brief.request",
      contract_version: "phase21c.morning-brief-contract.v1",
      request_id: "morning-brief:2026-06-02",
      brief_date: "2026-06-02",
      created_at: NOW,
      user_context: {
        user_id_hash: HASH,
        timezone: "Europe/London",
        locale: "en-GB",
        day_intent_hash: HASH_B,
        focus_area_ids: ["project:jarvis"],
        raw_user_profile_included: false,
      },
      calendar_metadata: [
        {
          event_id: "calendar:event-one",
          calendar_source_id: "google:calendar-main",
          title_hash: HASH,
          start_at: "2026-06-02T09:00:00.000Z",
          end_at: "2026-06-02T10:00:00.000Z",
          attendee_count: 2,
          priority: "high",
          verification_ref_ids: ["verification:calendar-one"],
          metadata_only: true,
          raw_description_included: false,
        },
      ],
      email_metadata: [
        {
          message_id: "gmail:message-one",
          thread_id: "gmail:thread-one",
          subject_hash: HASH,
          sender_hash: HASH_B,
          received_at: NOW,
          label_ids: ["INBOX"],
          attachment_count: 0,
          priority: "medium",
          verification_ref_ids: ["verification:gmail-one"],
          metadata_only: true,
          raw_message_body_included: false,
        },
      ],
      project_metadata: [
        {
          project_id: "project:jarvis",
          project_name: "JARVIS",
          status: "active",
          priority: "critical",
          due_at: null,
          metadata_only: true,
        },
      ],
      knowledge_metadata: [
        {
          knowledge_id: "knowledge:wiki-update",
          title: "LLM Wiki update",
          source_type: "llm_wiki",
          content_hash: HASH,
          updated_at: NOW,
          priority: "low",
          metadata_only: true,
          raw_note_body_included: false,
        },
      ],
      reminder_metadata: [
        {
          reminder_id: "reminder:one",
          title_hash: HASH,
          due_at: NOW,
          priority: "high",
          metadata_only: true,
          raw_reminder_body_included: false,
        },
      ],
      verification_metadata: [
        {
          verification_id: "verification:gmail-one",
          source_ref_id: "gmail:message-one",
          verification_status: "verified_with_caveat",
          confidence: "medium",
          caveat_summary: "Metadata-only source.",
          risk_flags: ["insufficient_sources"],
          advisory_only: true,
          metadata_only: true,
          raw_verifier_response_included: false,
        },
      ],
      librarian_updates: [
        {
          librarian_envelope_id: "librarian:update-one",
          source_type: "llm_wiki",
          classification: "candidate",
          route_target: "wiki",
          content_hash: HASH,
          priority: "low",
          promotion_attempted: false,
          metadata_only: true,
          raw_body_included: false,
        },
      ],
      metadata_only: true,
      generation_requested: false,
      scheduling_requested: false,
      delivery_requested: false,
      notification_requested: false,
      model_call_requested: false,
      raw_calendar_bodies_included: false,
      raw_email_bodies_included: false,
      raw_knowledge_bodies_included: false,
    });

    expect(request.brief_date).toBe("2026-06-02");
    expect(request.calendar_metadata[0].raw_description_included).toBe(false);
    expect(request.email_metadata[0].raw_message_body_included).toBe(false);
    expect(request.knowledge_metadata[0].raw_note_body_included).toBe(false);
    expect(request.generation_requested).toBe(false);
    expect(request.scheduling_requested).toBe(false);
    expect(request.delivery_requested).toBe(false);
  });

  it("rejects generation, scheduling, delivery, notification, and model-call requests", () => {
    const base = minimalRequest();

    expect(() =>
      createMorningBriefRequest({ ...base, generation_requested: true }),
    ).toThrow();
    expect(() =>
      createMorningBriefRequest({ ...base, scheduling_requested: true }),
    ).toThrow();
    expect(() =>
      createMorningBriefRequest({ ...base, delivery_requested: true }),
    ).toThrow();
    expect(() =>
      createMorningBriefRequest({ ...base, notification_requested: true }),
    ).toThrow();
    expect(() =>
      createMorningBriefRequest({ ...base, model_call_requested: true }),
    ).toThrow();
  });

  it("defines section shells without generated text", () => {
    const section = createMorningBriefSection({
      section_type: "risk_alerts",
      priority: "critical",
      source_refs: [
        {
          source_id: "verification:gmail-one",
          source_domain: "verification",
          source_ref: "verification://gmail-one",
          content_hash: HASH,
          metadata_only: true,
          raw_body_included: false,
        },
      ],
      verification_ref_ids: ["verification:gmail-one"],
      librarian_update_ids: [],
      intended_summary_shape: "risk_list",
      generated_text_included: false,
      metadata_only: true,
    });

    expect(section.section_type).toBe("risk_alerts");
    expect(section.generated_text_included).toBe(false);
  });

  it("defines Verification Agent metadata as advisory-only input", () => {
    const verification = MorningBriefVerificationMetadataSchema.parse({
      verification_id: "verification:one",
      source_ref_id: "source:one",
      verification_status: "conflicting",
      confidence: "low",
      caveat_summary: "Conflicting metadata.",
      risk_flags: ["conflicting_context", "model_disagreement"],
      advisory_only: true,
      metadata_only: true,
      raw_verifier_response_included: false,
    });

    expect(verification.advisory_only).toBe(true);
    expect(verification.raw_verifier_response_included).toBe(false);
  });

  it("defines Librarian knowledge updates without promotion or body content", () => {
    const update = MorningBriefLibrarianUpdateSchema.parse({
      librarian_envelope_id: "librarian:update-one",
      source_type: "knowledge_compounding",
      classification: "candidate",
      route_target: "wiki",
      content_hash: HASH,
      priority: "medium",
      promotion_attempted: false,
      metadata_only: true,
      raw_body_included: false,
    });

    expect(update.promotion_attempted).toBe(false);
    expect(update.raw_body_included).toBe(false);
  });

  it("has no scheduling, notification, model, Gmail, Calendar, or background-job execution surface", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/contract.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
    expect(source).not.toMatch(/Notification|sendNotification|notifyUser/);
    expect(source).not.toMatch(/generateMorningBrief|callModel|modelRuntime/);
    expect(source).not.toMatch(/googleapis|fetch\s*\(/);
    expect(source).not.toMatch(
      /from\s+["'].*google-adapters|readGmail|readCalendar/,
    );
    expect(source).not.toMatch(/backgroundJob|queue|worker/i);
  });
});

function minimalRequest() {
  return {
    kind: "morning_brief.request",
    contract_version: "phase21c.morning-brief-contract.v1",
    request_id: "morning-brief:minimal",
    brief_date: "2026-06-02",
    created_at: NOW,
    user_context: {
      user_id_hash: HASH,
      timezone: "Europe/London",
      raw_user_profile_included: false,
    },
    metadata_only: true,
    generation_requested: false,
    scheduling_requested: false,
    delivery_requested: false,
    notification_requested: false,
    model_call_requested: false,
    raw_calendar_bodies_included: false,
    raw_email_bodies_included: false,
    raw_knowledge_bodies_included: false,
  };
}
