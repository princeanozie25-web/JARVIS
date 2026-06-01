import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  SYSTEM_COMPLETION_AREA_IDS,
  SystemCompletionAuditReportSchema,
  buildSystemCompletionAuditReport,
  type SystemCompletionAuditReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "approve",
  "dispatch",
  "toolCall",
  "callProvider",
  "createUiRoute",
  "createAuthority",
  "executeDemo",
  "executeHardening",
  "recover",
  "autoFix",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
  "raw_prompt",
  "raw_output",
  "raw_audio",
  "raw_ocr",
  "raw_frame",
  "project_body",
] as const;

let cachedReport: SystemCompletionAuditReport | undefined;

function report(): SystemCompletionAuditReport {
  cachedReport ??= buildSystemCompletionAuditReport();
  return cachedReport;
}

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 20F.9 system completion audit", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES audit output", () => {
    const auditReport = report();

    expect(
      SystemCompletionAuditReportSchema.safeParse(auditReport).success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(JSON.stringify(report()));
    expect(auditReport).toMatchObject({
      report_version: "20F.9",
      report_id: "phase-20f9-system-completion-audit",
      phase: "20F.9",
      verdict: "pass_with_notes",
    });
  }, 90000);

  it("covers every system completion area", () => {
    const auditReport = report();

    expect(auditReport.system_areas.map((area) => area.system_area_id)).toEqual(
      [...SYSTEM_COMPLETION_AREA_IDS],
    );
    expect(auditReport.summary).toMatchObject({
      system_area_count: 39,
      operationalization_system_count: 13,
      hardening_system_count: 6,
      disabled_by_design_count: 13,
      expansion_era_count: 7,
    });
  });

  it("covers completed operationalization systems and Phase 19 fortress subsystems", () => {
    const auditReport = report();
    const ids = auditReport.system_areas.map((area) => area.system_area_id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "system-completion:room-os",
        "system-completion:persistence-layer",
        "system-completion:command-center",
        "system-completion:model-runtime",
        "system-completion:voice-runtime",
        "system-completion:vision-runtime",
        "system-completion:room-adapter-runtime",
        "system-completion:scheduled-assistance-runtime",
        "system-completion:approval-gated-execution-layer",
        "system-completion:architecture-graph",
        "system-completion:telemetry-cockpit",
        "system-completion:governance-boundary-visualizer",
        "system-completion:cai-governed-red-team-layer",
      ]),
    );
    expect(auditReport.summary.represented_core_phase_count).toBe(10);
    expect(auditReport.summary.final_status_blocked_or_missing_count).toBe(0);
  });

  it("covers final hardening systems", () => {
    const auditReport = report();
    const ids = auditReport.system_areas.map((area) => area.system_area_id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "system-completion:safety-regression",
        "system-completion:disabled-capability-audit",
        "system-completion:recovery-audit",
        "system-completion:authority-regression-audit",
        "system-completion:governance-integrity-audit",
        "system-completion:demo-portfolio-readiness-audit",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      recovery_auto_recovery_count: 0,
      authority_regression_count: 0,
      governance_integrity_pass: true,
      demo_portfolio_blocking_count: 0,
    });
  });

  it("covers disabled-by-design capabilities", () => {
    const auditReport = report();
    const disabledAreas = auditReport.system_areas.filter(
      (area) => area.group === "disabled_by_design",
    );

    expect(disabledAreas.map((area) => area.system_area_id)).toEqual(
      expect.arrayContaining([
        "system-completion:disabled-wake-word",
        "system-completion:disabled-always-listening",
        "system-completion:disabled-background-camera",
        "system-completion:disabled-graph-driven-execution",
        "system-completion:disabled-viewer-driven-execution",
        "system-completion:disabled-autonomous-device-execution",
        "system-completion:disabled-autonomous-routines",
        "system-completion:disabled-public-dashboards",
        "system-completion:disabled-voice-only-approval",
        "system-completion:disabled-auto-approval",
        "system-completion:disabled-cai-execution",
        "system-completion:disabled-cai-installation",
        "system-completion:disabled-external-red-team-targets",
      ]),
    );
    expect(
      disabledAreas.every(
        (area) =>
          area.completion_status === "disabled_by_design" &&
          area.deployment_status === "deferred_disabled" &&
          !area.future_expansion,
      ),
    ).toBe(true);
  });

  it("covers expansion-era items as future-only", () => {
    const auditReport = report();
    const expansionAreas = auditReport.system_areas.filter(
      (area) => area.group === "expansion_era",
    );

    expect(expansionAreas.map((area) => area.system_area_id)).toEqual(
      expect.arrayContaining([
        "system-completion:expansion-obsidian-integration",
        "system-completion:expansion-graphify-overlay",
        "system-completion:expansion-llm-council",
        "system-completion:expansion-hitnexus-integration",
        "system-completion:expansion-llm-wiki",
        "system-completion:expansion-security-knowledge-systems",
        "system-completion:expansion-future-research-systems",
      ]),
    );
    expect(
      expansionAreas.every(
        (area) =>
          area.completion_status === "future_expansion" &&
          area.deployment_status === "future_not_shipped" &&
          area.future_expansion,
      ),
    ).toBe(true);
  });

  it("aligns summary counts and completion status consistently", () => {
    const auditReport = report();

    expect(auditReport.summary).toMatchObject({
      complete_count: 14,
      complete_with_notes_count: 5,
      disabled_by_design_status_count: 13,
      future_expansion_status_count: 7,
      shipped_operational_count: 8,
      metadata_ready_count: 11,
      deferred_disabled_count: 13,
      future_not_shipped_count: 7,
      blocking_count: 0,
      disabled_feature_count: 18,
      portfolio_report_section_count: 11,
      phase20b_complete: true,
      phase20c_complete: true,
      phase20d_complete: true,
      core_jarvis_os_complete: true,
    });
    expect(auditReport.blocking_areas).toHaveLength(0);
  });

  it("answers the roadmap completion questions", () => {
    const auditReport = report();

    expect(auditReport.answers.what_is_implemented).toContain(
      "Core JARVIS OS operationalization systems",
    );
    expect(auditReport.answers.what_is_complete).toContain(
      "core OS plus Phase 20A-20F readiness",
    );
    expect(auditReport.answers.what_is_intentionally_disabled).toContain(
      "Wake word",
    );
    expect(auditReport.answers.what_is_future_expansion).toContain("Obsidian");
    expect(auditReport.answers.is_core_jarvis_os_complete).toBe(true);
    expect(auditReport.final_completion_statement).toContain(
      "Core JARVIS OS is complete",
    );
  });

  it("declares no runtime, provider, network, filesystem, process, UI, approval, authority, source-material, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.system_areas.map((area) => area.posture),
    ]) {
      expect(posture.hardening_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.shell_process_execution_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.approval_bypass_created).toBe(false);
      expect(posture.authority_surface_created).toBe(false);
      expect(posture.capability_created).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(auditReport)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution, provider, UI, approval, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildSystemCompletionAuditReport"]),
    );
  });
});
