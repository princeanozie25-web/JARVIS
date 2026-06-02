import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MORNING_BRIEF_GENERATOR_VERSION,
  createMorningBriefRequest,
  generateMorningBrief,
  planMorningBrief,
  type MorningBriefGeneratedSection,
  type MorningBriefRequest,
  type MorningBriefSectionGeneratorInput,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const NOW = "2026-06-02T07:30:00.000Z";

describe("Morning Brief generator", () => {
  it("generates deterministic structured brief sections from a plan", async () => {
    const request = populatedRequest();
    const plan = planMorningBrief(request);

    const result = await generateMorningBrief({
      request,
      plan,
      runtime_mode: "deterministic_mock",
      metadata_only: true,
      delivery_requested: false,
      scheduling_requested: false,
      notification_requested: false,
      live_model_requested: false,
    });

    expect(result.generator_version).toBe(MORNING_BRIEF_GENERATOR_VERSION);
    expect(result.generation_status).toBe("generated");
    expect(result.title).toBe("Morning Brief 2026-06-02");
    expect(result.sections.map((section) => section.section_type)).toEqual([
      "today_overview",
      "calendar_summary",
      "inbox_summary",
      "project_focus",
      "knowledge_updates",
      "risk_alerts",
      "recommended_actions",
    ]);
    expect(result.sections[0].generated_by).toBe("deterministic_mock");
    expect(result.sections[0].bullets[0]).toContain("priority:");
    expect(result.priority_summary.top_priority).toBe("critical");
    expect(result.delivery_attempted).toBe(false);
    expect(result.write_attempted).toBe(false);
  });

  it("supports an injected mock runtime without live model dependency", async () => {
    const request = populatedRequest();
    const plan = planMorningBrief(request);
    const calls: string[] = [];

    const result = await generateMorningBrief(
      {
        request,
        plan,
        runtime_mode: "injected_mock",
        metadata_only: true,
        delivery_requested: false,
        scheduling_requested: false,
        notification_requested: false,
        live_model_requested: false,
      },
      {
        runtime: {
          runtime_kind: "mock",
          generateSection(input: MorningBriefSectionGeneratorInput) {
            calls.push(input.section_plan.section.section_type);
            return injectedMockSection(input);
          },
        },
      },
    );

    expect(result.generation_status).toBe("generated");
    expect(calls).toEqual([
      "today_overview",
      "calendar_summary",
      "inbox_summary",
      "project_focus",
      "knowledge_updates",
      "risk_alerts",
      "recommended_actions",
    ]);
    expect(result.sections[0].generated_by).toBe("injected_mock");
    expect(result.sections[0].bullets[0]).toContain("mock:");
    expect(result.governance.live_model_call_attempted).toBe(false);
  });

  it("fails closed when live generation is requested", async () => {
    const request = populatedRequest();
    const plan = planMorningBrief(request);

    const result = await generateMorningBrief({
      request,
      plan,
      runtime_mode: "live",
      metadata_only: true,
      delivery_requested: false,
      scheduling_requested: false,
      notification_requested: false,
      live_model_requested: true,
    });

    expect(result.generation_status).toBe("failed_closed");
    expect(result.sections).toEqual([]);
    expect(result.warnings).toContain("live_generation_not_enabled");
    expect(result.warnings).toContain("section_generation_failed_closed");
    expect(result.governance.live_model_call_attempted).toBe(false);
  });

  it("fails closed when injected mock runtime is unavailable", async () => {
    const request = populatedRequest();
    const plan = planMorningBrief(request);

    const result = await generateMorningBrief({
      request,
      plan,
      runtime_mode: "injected_mock",
      metadata_only: true,
      delivery_requested: false,
      scheduling_requested: false,
      notification_requested: false,
      live_model_requested: false,
    });

    expect(result.generation_status).toBe("failed_closed");
    expect(result.sections).toEqual([]);
    expect(result.warnings).toContain("runtime_unavailable");
    expect(result.delivery_attempted).toBe(false);
  });

  it("preserves verification caveats, risk flags, and Librarian metadata", async () => {
    const request = populatedRequest();
    const plan = planMorningBrief(request);

    const result = await generateMorningBrief({
      request,
      plan,
      runtime_mode: "deterministic_mock",
      metadata_only: true,
      delivery_requested: false,
      scheduling_requested: false,
      notification_requested: false,
      live_model_requested: false,
    });

    expect(result.caveats).toEqual(["Conflicting metadata."]);
    expect(result.advisory_metadata.risk_flags).toEqual([
      "conflicting_context",
      "model_disagreement",
    ]);
    expect(result.advisory_metadata.verification_ref_ids).toContain(
      "verification:risk",
    );
    expect(result.advisory_metadata.librarian_update_ids).toContain(
      "librarian:update-one",
    );
    expect(result.advisory_metadata.raw_body_included).toBe(false);
    expect(result.warnings).toContain("verification_caveats_present");
  });

  it("rejects request and plan mismatch without generating sections", async () => {
    const request = populatedRequest();
    const plan = {
      ...planMorningBrief(request),
      request_id: "morning-brief:other",
    };

    const result = await generateMorningBrief({
      request,
      plan,
      runtime_mode: "deterministic_mock",
      metadata_only: true,
      delivery_requested: false,
      scheduling_requested: false,
      notification_requested: false,
      live_model_requested: false,
    });

    expect(result.generation_status).toBe("failed_closed");
    expect(result.warnings).toContain("request_plan_mismatch");
    expect(result.sections).toEqual([]);
  });

  it("does not include raw bodies or attempt delivery, writes, adapters, notifications, or scheduling", async () => {
    const request = populatedRequest();
    const plan = planMorningBrief(request);

    const result = await generateMorningBrief({
      request,
      plan,
      runtime_mode: "deterministic_mock",
      metadata_only: true,
      delivery_requested: false,
      scheduling_requested: false,
      notification_requested: false,
      live_model_requested: false,
    });

    expect(JSON.stringify(result)).not.toMatch(
      /raw email body|raw calendar body|raw note body/i,
    );
    expect(result.governance).toMatchObject({
      scheduling_attempted: false,
      delivery_attempted: false,
      notification_attempted: false,
      gmail_access_attempted: false,
      calendar_access_attempted: false,
      drive_access_attempted: false,
      vault_write_attempted: false,
      obsidian_note_write_attempted: false,
      raw_bodies_included: false,
    });
  });

  it("has no scheduler, notification, adapter, vault write, or live model imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/generator.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
    expect(source).not.toMatch(/Notification|sendNotification|notifyUser/);
    expect(source).not.toMatch(/googleapis|fetch\s*\(/);
    expect(source).not.toMatch(
      /from\s+["'].*google-adapters|readGmail|readCalendar|readDrive/i,
    );
    expect(source).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
    expect(source).not.toMatch(
      /DeepSeek|Ollama|OpenAI|Anthropic|modelRuntime/i,
    );
    expect(source).not.toMatch(/backgroundJob|queue|worker/i);
  });
});

function populatedRequest(): MorningBriefRequest {
  return createMorningBriefRequest({
    kind: "morning_brief.request",
    contract_version: "phase21c.morning-brief-contract.v1",
    request_id: "morning-brief:generator",
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
    project_metadata: [
      {
        project_id: "project:jarvis",
        project_name: "JARVIS",
        status: "blocked",
        priority: "high",
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
        priority: "medium",
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
  });
}

function injectedMockSection(
  input: MorningBriefSectionGeneratorInput,
): MorningBriefGeneratedSection {
  return {
    section_type: input.section_plan.section.section_type,
    title: `Mock ${input.section_plan.section.section_type}`,
    priority: input.section_plan.section.priority,
    bullets: [`mock:${input.section_plan.section.section_type}`],
    item_ids: input.section_plan.item_ids,
    source_refs: input.section_plan.section.source_refs,
    verification_ref_ids: input.section_plan.section.verification_ref_ids,
    librarian_update_ids: input.section_plan.section.librarian_update_ids,
    risk_flags: input.item_decisions.flatMap((item) => item.risk_flags),
    caveats: [...input.caveats],
    generated_by: "injected_mock",
    metadata_only: true,
    raw_body_included: false,
  };
}
