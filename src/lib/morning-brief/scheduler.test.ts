import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MORNING_BRIEF_SCHEDULE_ID,
  MORNING_BRIEF_SCHEDULER_PLAN_VERSION,
  buildMorningBriefSchedulerPlan,
} from ".";

describe("Morning Brief scheduler metadata", () => {
  it("declares daily 08:00 local schedule metadata", () => {
    const plan = buildMorningBriefSchedulerPlan();

    expect(plan.plan_version).toBe(MORNING_BRIEF_SCHEDULER_PLAN_VERSION);
    expect(plan.schedule.schedule_id).toBe(MORNING_BRIEF_SCHEDULE_ID);
    expect(plan.schedule.local_time).toBe("08:00");
    expect(plan.schedule.timezone).toBe("local");
    expect(plan.schedule.frequency).toBe("daily");
    expect(plan.schedule.enabled_by_default).toBe(false);
    expect(plan.schedule.kill_switch_supported).toBe(true);
    expect(plan.schedule.kill_switch_enabled).toBe(true);
  });

  it("targets Suggestion Inbox digest output only", () => {
    const plan = buildMorningBriefSchedulerPlan();

    expect(plan.job.output_target).toBe("suggestion_inbox_digest");
    expect(plan.job.output_kind).toBe("suggestion.digest");
    expect(plan.job.required_sources).toEqual(["gmail_or_calendar"]);
    expect(plan.job.optional_sources).toEqual([
      "drive",
      "jarvis_status",
      "agent_preview",
    ]);
    expect(plan.job.failure_behavior).toBe("skip_and_report_metadata_only");
    expect(plan.job.action_execution_supported).toBe(false);
  });

  it("stays disabled and metadata-only with no daemon posture", () => {
    const plan = buildMorningBriefSchedulerPlan();

    expect(plan.governance.suggestion_only).toBe(true);
    expect(plan.governance.metadata_only).toBe(true);
    expect(plan.governance.disabled_by_default).toBe(true);
    expect(plan.governance.scheduler_metadata_only).toBe(true);
    expect(plan.governance.daemon_started).toBe(false);
    expect(plan.governance.background_job_started).toBe(false);
    expect(plan.governance.timer_registered).toBe(false);
    expect(plan.governance.delivery_supported).toBe(false);
    expect(plan.governance.auto_send_supported).toBe(false);
    expect(plan.governance.auto_execute_supported).toBe(false);
    expect(plan.governance.approval_finalization_supported).toBe(false);
    expect(plan.governance.network_call_supported).toBe(false);
    expect(plan.governance.provider_call_supported).toBe(false);
    expect(plan.governance.mutation_supported).toBe(false);
  });

  it("does not introduce timer, daemon, provider, network, or write code", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/scheduler.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /cron|agenda|bull|node-schedule|googleapis|openai|anthropic|fetch/i,
    );
    expect(source).not.toMatch(
      /setInterval|setTimeout|writeFile|appendFile|insert|update|delete/i,
    );
    expect(source).not.toMatch(/sendEmail|createEvent|downloadFile/);
  });
});
