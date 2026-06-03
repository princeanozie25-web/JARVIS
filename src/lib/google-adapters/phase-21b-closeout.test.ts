import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPhase21BGoogleIntegrationCloseoutReport,
  createCalendarReadAdapter,
  createDriveReadAdapter,
  createGmailReadAdapter,
  createGoogleAccountRuntime,
} from ".";

describe("Phase 21B Google integration closeout", () => {
  it("reports Gmail, Calendar, Drive, and unified runtime as T0 read complete", () => {
    const report = buildPhase21BGoogleIntegrationCloseoutReport();

    expect(report.verdict).toBe("PASS");
    expect(report.integration_status).toBe("T0 read integration complete");
    expect(report.completed_adapters).toEqual(["gmail", "calendar", "drive"]);
    expect(report.unified_runtime_present).toBe(true);
    expect(report.readiness_represented).toEqual({
      gmail: true,
      calendar: true,
      drive: true,
    });
    expect(report.wording).toEqual({
      says_t0_read_complete: true,
      says_full_google_automation: false,
    });
  });

  it("verifies all adapters remain T0 read-only with no authority expansion", () => {
    const report = buildPhase21BGoogleIntegrationCloseoutReport();

    expect(report.authority).toEqual({
      all_adapters_t0: true,
      all_adapters_read_only: true,
      new_authority_surface_added: false,
      approval_execution_supported: false,
    });
  });

  it("verifies metadata-only telemetry and no raw payload exposure", () => {
    const report = buildPhase21BGoogleIntegrationCloseoutReport();

    expect(report.telemetry).toEqual({
      metadata_only: true,
      tokens_exposed: false,
      raw_email_bodies_exposed: false,
      raw_calendar_descriptions_exposed: false,
      raw_calendar_attendee_lists_exposed: false,
      raw_drive_file_contents_exposed: false,
      raw_drive_permission_lists_exposed: false,
    });
  });

  it("verifies no Google mutation, scheduler, approval execution, or provider path exists", () => {
    const report = buildPhase21BGoogleIntegrationCloseoutReport();

    expect(report.forbidden_capabilities).toEqual({
      gmail_send_or_draft_or_mutation: false,
      calendar_create_update_delete_or_rsvp: false,
      drive_create_update_delete_move_rename_permission_or_download: false,
      background_sync: false,
      scheduler_wiring: false,
      provider_model_call: false,
    });
  });

  it("keeps closeout as a report, not adapter execution or full automation", () => {
    expect(createGmailReadAdapter).toBeTypeOf("function");
    expect(createCalendarReadAdapter).toBeTypeOf("function");
    expect(createDriveReadAdapter).toBeTypeOf("function");
    expect(createGoogleAccountRuntime).toBeTypeOf("function");

    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/phase-21b-closeout.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch/,
    );
    expect(imports.join("\n")).not.toMatch(
      /orchestrator|scheduler|suggestion-inbox|morning-brief/i,
    );
    expect(source).not.toMatch(
      /\bcreateEvent\b|\bupdateEvent\b|\bdeleteEvent\b|\bsendEmail\b|\bcreateDraft\b|\bdownloadFile\b/,
    );
    expect(source).not.toMatch(/full Google automation/i);
  });
});
