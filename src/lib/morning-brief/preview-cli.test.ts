import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MORNING_BRIEF_PREVIEW_CLI_VERSION,
  buildSampleMorningBriefRequest,
  createMorningBriefPreviewReport,
  runMorningBriefPreviewCli,
} from ".";

describe("Morning Brief preview CLI", () => {
  it("creates a safe metadata-only preview report from fixture input", async () => {
    const report = await createMorningBriefPreviewReport(
      buildSampleMorningBriefRequest(),
    );

    expect(report.status).toBe("ok");
    expect(report.cli_version).toBe(MORNING_BRIEF_PREVIEW_CLI_VERSION);
    expect(report.title).toBe("Morning Brief 2026-06-02");
    expect(report.date).toBe("2026-06-02");
    expect(report.section_count).toBe(7);
    expect(report.priority_summary.top_priority).toBe("critical");
    expect(report.caveats).toEqual([
      "Preview uses safe fixture metadata only.",
    ]);
    expect(
      report.section_previews.map((section) => section.section_type),
    ).toEqual([
      "today_overview",
      "calendar_summary",
      "inbox_summary",
      "project_focus",
      "knowledge_updates",
      "risk_alerts",
      "recommended_actions",
    ]);
    expect(report.delivery_attempted).toBe(false);
    expect(report.write_attempted).toBe(false);
    expect(report.metadata_only).toBe(true);
    expect(report.raw_body_included).toBe(false);
  });

  it("prints title, date, counts, caveats, sections, and governance flags as JSON", async () => {
    const lines: string[] = [];
    const report = await runMorningBriefPreviewCli({
      write(line) {
        lines.push(line);
      },
    });
    const printed = JSON.parse(lines.join("\n")) as typeof report;

    expect(printed.title).toBe(report.title);
    expect(printed.date).toBe(report.date);
    expect(printed.section_count).toBe(report.section_count);
    expect(printed.priority_summary).toEqual(report.priority_summary);
    expect(printed.caveats).toEqual(report.caveats);
    expect(printed.section_previews).toHaveLength(7);
    expect(printed.delivery_attempted).toBe(false);
    expect(printed.scheduling_attempted).toBe(false);
    expect(printed.write_attempted).toBe(false);
  });

  it("does not output raw bodies or live integration data", async () => {
    const lines: string[] = [];
    await runMorningBriefPreviewCli({
      write(line) {
        lines.push(line);
      },
    });
    const output = lines.join("\n");

    expect(output).not.toMatch(
      /raw email body|raw calendar body|raw note body/i,
    );
    expect(output).toContain('"delivery_attempted": false');
    expect(output).toContain('"scheduling_attempted": false');
    expect(output).toContain('"notification_attempted": false');
    expect(output).toContain('"gmail_access_attempted": false');
    expect(output).toContain('"calendar_access_attempted": false');
    expect(output).toContain('"drive_access_attempted": false');
    expect(output).toContain('"vault_write_attempted": false');
    expect(output).toContain('"write_attempted": false');
  });

  it("has no scheduler, notification, Google, model, vault write, or background execution surface", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/preview-cli.ts"),
      "utf8",
    );
    const script = readFileSync(
      join(process.cwd(), "scripts/morning-brief.ts"),
      "utf8",
    );

    for (const text of [source, script]) {
      expect(text).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
      expect(text).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
      expect(text).not.toMatch(/Notification|sendNotification|notifyUser/);
      expect(text).not.toMatch(/googleapis|fetch\s*\(/);
      expect(text).not.toMatch(
        /from\s+["'].*google-adapters|readGmail|readCalendar|readDrive/i,
      );
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(
        /DeepSeek|Ollama|OpenAI|Anthropic|modelRuntime/i,
      );
      expect(text).not.toMatch(/backgroundJob|queue|worker/i);
    }
  });
});
