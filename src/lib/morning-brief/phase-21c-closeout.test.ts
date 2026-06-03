import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHASE_21C_MORNING_BRIEF_CLOSEOUT_VERSION,
  buildPhase21CMorningBriefCloseoutReport,
} from ".";

describe("Phase 21C Morning Brief closeout", () => {
  it("verifies every Morning Brief workflow component", () => {
    const report = buildPhase21CMorningBriefCloseoutReport();

    expect(report.closeout_version).toBe(
      PHASE_21C_MORNING_BRIEF_CLOSEOUT_VERSION,
    );
    expect(report.phase).toBe("21C-R");
    expect(report.status).toBe(
      "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
    );
    expect(
      report.components.map((component) => component.component_id),
    ).toEqual([
      "morning-brief-real-input-contract",
      "morning-brief-composer",
      "morning-brief-preview-generator",
      "morning-brief-suggestion-payload",
      "morning-brief-scheduler-plan",
      "morning-brief-inbox-delivery",
      "morning-brief-scheduler-invocation-boundary",
      "shared-suggestion-inbox-delivery-bridge",
    ]);
    expect(report.components.every((component) => component.present)).toBe(
      true,
    );
  });

  it("declares the workflow suggestion-only and metadata-governed", () => {
    const report = buildPhase21CMorningBriefCloseoutReport();

    expect(report.governance.workflow_status).toBe(
      "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
    );
    expect(report.governance.suggestion_only).toBe(true);
    expect(report.governance.metadata_only).toBe(true);
    expect(report.governance.read_only_google_inputs_only).toBe(true);
    expect(report.governance.google_t0_read_stack_present).toBe(true);
    expect(report.governance.minimum_viable_input_rules_present).toBe(true);
    expect(report.governance.degraded_modes_present).toBe(true);
    expect(report.governance.suggestion_payload_builder_present).toBe(true);
    expect(report.governance.suggestion_inbox_delivery_present).toBe(true);
    expect(report.governance.injected_delivery_supported).toBe(true);
    expect(report.governance.scheduler_metadata_present).toBe(true);
    expect(report.governance.scheduler_invocation_boundary_present).toBe(true);
    expect(report.governance.idempotency_dedupe_present).toBe(true);
    expect(report.governance.delivery_user_visible_through_inbox_item).toBe(
      true,
    );
  });

  it("keeps automation, model, network, and mutation paths unavailable", () => {
    const report = buildPhase21CMorningBriefCloseoutReport();

    expect(report.governance.scheduler_daemon_started).toBe(false);
    expect(report.governance.auto_send_supported).toBe(false);
    expect(report.governance.auto_execute_supported).toBe(false);
    expect(report.governance.action_execution_attempted).toBe(false);
    expect(report.governance.approval_finalization_supported).toBe(false);
    expect(report.governance.approval_finalization_attempted).toBe(false);
    expect(report.governance.provider_call_supported).toBe(false);
    expect(report.governance.network_call_supported).toBe(false);
    expect(
      report.governance.live_adapter_call_inside_morning_brief_supported,
    ).toBe(false);
    expect(report.governance.filesystem_write_supported).toBe(false);
    expect(report.governance.database_write_supported).toBe(false);
    expect(report.governance.mutation_supported).toBe(false);
    expect(report.governance.new_authority_surface_added).toBe(false);
  });

  it("uses README-safe wording for closeout scope", () => {
    const report = buildPhase21CMorningBriefCloseoutReport();
    const wording = report.readme_safe_wording.join(" ");

    expect(wording).toMatch(
      /Morning Brief realized as scheduled Suggestion Inbox delivery workflow/i,
    );
    expect(wording).toMatch(/metadata-only Suggestion Inbox item/i);
    expect(wording).toMatch(/08:00 local scheduling/i);
    expect(wording).not.toMatch(/sends emails|calendar mutation|Drive writes/i);
    expect(report.future_work.join(" ")).toMatch(/approval lifecycle/i);
  });

  it("does not export forbidden action helpers from the Morning Brief index", () => {
    const indexSource = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/index.ts"),
      "utf8",
    );

    expect(indexSource).not.toMatch(
      /executeMorningBrief|sendMorningBrief|applyMorningBrief|approveMorningBrief/i,
    );
    expect(indexSource).not.toMatch(
      /createCalendarEvent|sendEmail|downloadDriveFile|writeSuggestionInbox/i,
    );
  });

  it("keeps closeout source free of provider, network, timer, and write imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/phase-21c-closeout.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch|node-schedule|cron/i,
    );
    expect(source).not.toMatch(/setInterval|setTimeout|writeFile|appendFile/);
    expect(source).not.toMatch(/sendEmail|createEvent|downloadFile/);
  });
});
