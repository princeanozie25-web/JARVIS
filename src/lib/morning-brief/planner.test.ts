import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MORNING_BRIEF_PLANNER_VERSION,
  planMorningBrief,
  type MorningBriefRequest,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const NOW = "2026-06-02T07:30:00.000Z";

describe("Morning Brief planner", () => {
  it("plans requested sections and deterministic included metadata", () => {
    const plan = planMorningBrief({
      ...minimalRequest(),
      calendar_metadata: [
        {
          event_id: "calendar:event-one",
          calendar_source_id: "google:calendar-main",
          start_at: "2026-06-02T09:00:00.000Z",
          end_at: "2026-06-02T10:00:00.000Z",
          attendee_count: 2,
          priority: "high",
          metadata_only: true,
          raw_description_included: false,
        },
      ],
      email_metadata: [
        {
          message_id: "gmail:message-one",
          thread_id: "gmail:thread-one",
          received_at: NOW,
          label_ids: ["INBOX"],
          attachment_count: 1,
          priority: "medium",
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
          priority: "medium",
          metadata_only: true,
          raw_reminder_body_included: false,
        },
      ],
    });

    expect(plan.planner_version).toBe(MORNING_BRIEF_PLANNER_VERSION);
    expect(
      plan.section_plans.map((section) => section.section.section_type),
    ).toEqual([
      "today_overview",
      "calendar_summary",
      "inbox_summary",
      "project_focus",
      "knowledge_updates",
      "risk_alerts",
      "recommended_actions",
    ]);
    expect(inclusionFor(plan, "calendar:event-one")).toBe("include");
    expect(inclusionFor(plan, "gmail:message-one")).toBe("include");
    expect(inclusionFor(plan, "project:jarvis")).toBe("include");
    expect(sectionFor(plan, "project_focus")?.section.priority).toBe(
      "critical",
    );
    expect(sectionFor(plan, "today_overview")?.included_count).toBeGreaterThan(
      0,
    );
    expect(plan.write_attempted).toBe(false);
    expect(plan.governance).toMatchObject({
      generation_attempted: false,
      scheduling_attempted: false,
      delivery_attempted: false,
      notification_attempted: false,
      model_call_attempted: false,
      metadata_only: true,
    });
  });

  it("escalates high-risk verification metadata into priority and warnings", () => {
    const plan = planMorningBrief({
      ...minimalRequest(),
      email_metadata: [
        {
          message_id: "gmail:message-risk",
          thread_id: "gmail:thread-risk",
          received_at: NOW,
          label_ids: ["INBOX"],
          attachment_count: 0,
          priority: "low",
          verification_ref_ids: ["verification:risk"],
          metadata_only: true,
          raw_message_body_included: false,
        },
      ],
      verification_metadata: [
        {
          verification_id: "verification:risk",
          source_ref_id: "gmail:message-risk",
          verification_status: "conflicting",
          confidence: "low",
          caveat_summary: "Conflicting metadata.",
          risk_flags: ["conflicting_context", "model_disagreement"],
          advisory_only: true,
          metadata_only: true,
          raw_verifier_response_included: false,
        },
      ],
    });

    const email = decisionFor(plan, "gmail:message-risk");
    const risk = decisionFor(plan, "verification:risk");

    expect(email.priority).toBe("critical");
    expect(email.risk_flags).toContain("conflicting_context");
    expect(risk.section_type).toBe("risk_alerts");
    expect(risk.inclusion).toBe("include");
    expect(sectionFor(plan, "risk_alerts")?.section.priority).toBe("critical");
    expect(plan.warnings).toContain("high_risk_verification_present");
  });

  it("supports include, defer, and suppress decisions", () => {
    const plan = planMorningBrief({
      ...minimalRequest(),
      email_metadata: [
        {
          message_id: "gmail:spam",
          thread_id: "gmail:thread-spam",
          received_at: NOW,
          label_ids: ["SPAM"],
          attachment_count: 0,
          priority: "critical",
          metadata_only: true,
          raw_message_body_included: false,
        },
      ],
      project_metadata: [
        {
          project_id: "project:done",
          project_name: "Done Project",
          status: "done",
          priority: "critical",
          due_at: null,
          metadata_only: true,
        },
      ],
      reminder_metadata: [
        {
          reminder_id: "reminder:future",
          title_hash: HASH,
          due_at: "2026-06-10T09:00:00.000Z",
          priority: "low",
          metadata_only: true,
          raw_reminder_body_included: false,
        },
      ],
    });

    expect(inclusionFor(plan, "gmail:spam")).toBe("suppress");
    expect(inclusionFor(plan, "project:done")).toBe("suppress");
    expect(inclusionFor(plan, "reminder:future")).toBe("defer");
    expect(plan.omission_decisions.map((decision) => decision.item_id)).toEqual(
      ["gmail:spam", "project:done", "reminder:future"],
    );
  });

  it("suppresses candidates for sections that were not requested", () => {
    const plan = planMorningBrief({
      ...minimalRequest(),
      requested_sections: ["today_overview", "calendar_summary"],
      email_metadata: [
        {
          message_id: "gmail:not-requested",
          thread_id: "gmail:thread-not-requested",
          received_at: NOW,
          label_ids: ["INBOX"],
          attachment_count: 0,
          priority: "high",
          metadata_only: true,
          raw_message_body_included: false,
        },
      ],
    });

    expect(
      plan.section_plans.map((section) => section.section.section_type),
    ).toEqual(["today_overview", "calendar_summary"]);
    expect(inclusionFor(plan, "gmail:not-requested")).toBe("suppress");
    expect(decisionFor(plan, "gmail:not-requested").reasons).toContain(
      "section_not_requested",
    );
    expect(plan.warnings).toContain("section_not_requested");
  });

  it("represents Librarian updates as metadata-only knowledge updates", () => {
    const plan = planMorningBrief({
      ...minimalRequest(),
      librarian_updates: [
        {
          librarian_envelope_id: "librarian:update-one",
          source_type: "knowledge_compounding",
          classification: "candidate",
          route_target: "wiki",
          content_hash: HASH,
          priority: "medium",
          promotion_attempted: false,
          metadata_only: true,
          raw_body_included: false,
        },
      ],
    });

    const update = decisionFor(plan, "librarian:update-one");
    expect(update.section_type).toBe("knowledge_updates");
    expect(update.librarian_update_ids).toEqual(["librarian:update-one"]);
    expect(update.raw_body_included).toBe(false);
    expect(JSON.stringify(plan)).not.toMatch(/raw note body|raw email body/i);
  });

  it("returns a safe empty-input plan without generation or delivery", () => {
    const plan = planMorningBrief(minimalRequest());

    expect(plan.item_decisions).toEqual([]);
    expect(plan.warnings).toContain("insufficient_input_metadata");
    expect(plan.section_plans).toHaveLength(7);
    expect(plan.governance.write_attempted).toBe(false);
    expect(plan.governance.raw_bodies_included).toBe(false);
  });

  it("has no scheduling, delivery, adapter, model, notification, or raw body execution surface", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/planner.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
    expect(source).not.toMatch(/Notification|sendNotification|notifyUser/);
    expect(source).not.toMatch(/callModel|modelRuntime|DeepSeek|Ollama/i);
    expect(source).not.toMatch(/googleapis|fetch\s*\(/);
    expect(source).not.toMatch(
      /from\s+["'].*google-adapters|readGmail|readCalendar/i,
    );
    expect(source).not.toMatch(/backgroundJob|queue|worker/i);
  });
});

function minimalRequest(): MorningBriefRequest {
  return {
    kind: "morning_brief.request",
    contract_version: "phase21c.morning-brief-contract.v1",
    request_id: "morning-brief:planner",
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
    calendar_metadata: [],
    email_metadata: [],
    project_metadata: [],
    knowledge_metadata: [],
    reminder_metadata: [],
    verification_metadata: [],
    librarian_updates: [],
    requested_sections: [
      "today_overview",
      "calendar_summary",
      "inbox_summary",
      "project_focus",
      "knowledge_updates",
      "risk_alerts",
      "recommended_actions",
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
  };
}

function decisionFor(
  plan: ReturnType<typeof planMorningBrief>,
  itemId: string,
) {
  const decision = plan.item_decisions.find((item) => item.item_id === itemId);
  if (!decision) throw new Error(`Missing decision for ${itemId}`);
  return decision;
}

function inclusionFor(
  plan: ReturnType<typeof planMorningBrief>,
  itemId: string,
) {
  return decisionFor(plan, itemId).inclusion;
}

function sectionFor(
  plan: ReturnType<typeof planMorningBrief>,
  sectionType: string,
) {
  return plan.section_plans.find(
    (section) => section.section.section_type === sectionType,
  );
}
