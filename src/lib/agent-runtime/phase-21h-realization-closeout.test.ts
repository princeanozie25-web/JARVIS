import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPANSION_ERA_AGENT_IDS,
  PHASE21H_REALIZATION_CLOSEOUT_VERSION,
  buildPhase21HRealizationCloseoutReport,
} from ".";

describe("Phase 21H Agent Suite realization closeout", () => {
  it("verifies realized scheduled Suggestion Inbox delivery status", () => {
    const report = buildPhase21HRealizationCloseoutReport();

    expect(report.closeout_version).toBe(PHASE21H_REALIZATION_CLOSEOUT_VERSION);
    expect(report.kind).toBe("agent_runtime.phase21h_realization_closeout");
    expect(report.status).toBe(
      "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
    );
    expect(report.realized).toBe(true);
    expect(report.foundation_complete).toBe(true);
    expect(report.deterministic).toBe(true);
    expect(report.metadata_only).toBe(true);
  });

  it("verifies runtime, delivery, scheduler, and digest components", () => {
    const report = buildPhase21HRealizationCloseoutReport();

    expect(
      report.components.map((component) => component.component_id),
    ).toEqual([
      "agent-runtime-contract",
      "agent-registry",
      "agent-dry-run-runtime",
      "agent-planner",
      "agent-output-factory",
      "agent-suite-summary",
      "agent-inbox-delivery",
      "agent-scheduled-invocation-boundary",
      "shared-suggestion-inbox-delivery-bridge",
    ]);
    expect(report.components.every((component) => component.present)).toBe(
      true,
    );
    expect(report.components.map((component) => component.posture)).toContain(
      "inbox_delivery",
    );
    expect(report.components.map((component) => component.posture)).toContain(
      "scheduled_invocation",
    );
    expect(report.components.map((component) => component.posture)).toContain(
      "digest_generation",
    );
  });

  it("represents all eight realized agents", () => {
    const report = buildPhase21HRealizationCloseoutReport();

    expect(report.agent_count).toBe(8);
    expect(report.agents.map((agent) => agent.agent_id)).toEqual([
      ...EXPANSION_ERA_AGENT_IDS,
    ]);
    for (const agent of report.agents) {
      expect(agent.inbox_delivery_supported).toBe(true);
      expect(agent.scheduled_invocation_supported).toBe(true);
      expect(agent.source_attribution_supported).toBe(true);
      expect(agent.execution_authority).toBe(false);
      expect(agent.approval_finalization_supported).toBe(false);
      expect(agent.metadata_only).toBe(true);
    }
  });

  it("verifies prohibited capabilities remain absent", () => {
    const governance = buildPhase21HRealizationCloseoutReport().governance;

    expect(governance.workflow_status).toBe(
      "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
    );
    expect(governance.suggestion_inbox_delivery_exists).toBe(true);
    expect(governance.scheduled_invocation_exists).toBe(true);
    expect(governance.digest_generation_exists).toBe(true);
    expect(governance.no_execution).toBe(true);
    expect(governance.no_approval_finalization).toBe(true);
    expect(governance.no_provider_model_calls).toBe(true);
    expect(governance.no_network_calls).toBe(true);
    expect(governance.no_autonomous_actions).toBe(true);
    expect(governance.no_cross_agent_execution).toBe(true);
    expect(governance.no_self_modification).toBe(true);
    expect(governance.no_authority_escalation).toBe(true);
    expect(governance.new_authority_surface_added).toBe(false);
  });

  it("uses README-safe scope wording", () => {
    const report = buildPhase21HRealizationCloseoutReport();
    const wording = report.readme_safe_wording.join(" ");

    expect(wording).toMatch(
      /Agent Suite realized as scheduled Suggestion Inbox delivery workflow/i,
    );
    expect(wording).toMatch(/user-visible Suggestion Inbox digest or alert/i);
    expect(wording).not.toMatch(/autonomous execution|direct side effects/i);
    expect(report.future_work.join(" ")).toMatch(/execution authority/i);
  });

  it("does not add provider, network, daemon, filesystem, database, approval, or authority code", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/agent-runtime/phase-21h-realization-closeout.ts",
      ),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch|fs|path/i,
    );
    expect(source).not.toMatch(/setInterval|setTimeout|new\s+Worker/);
    expect(source).not.toMatch(/readFile|writeFile|appendFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
    expect(source).not.toMatch(/crossAgentExecute|selfModify|authorityToken/i);
  });
});
