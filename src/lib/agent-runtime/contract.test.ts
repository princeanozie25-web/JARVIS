import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_AUTHORITY_LEVELS,
  AGENT_DECLARED_SOURCE_KINDS,
  AGENT_OUTPUT_TYPES,
  AGENT_RUNTIME_GOVERNANCE_DEFAULTS,
  AGENT_RUNTIME_SCHEDULE_CLASSES,
  createAgentOutput,
  createAgentRuntimeContract,
  validateAgentOutputAgainstContract,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const NOW = "2026-06-02T12:00:00.000Z";

describe("Agent runtime contract", () => {
  it("defines output, authority, schedule, and source models", () => {
    expect(AGENT_OUTPUT_TYPES).toEqual([
      "digest",
      "report",
      "recommendation",
      "draft",
      "alert",
    ]);
    expect(AGENT_AUTHORITY_LEVELS).toEqual([
      "observe_only",
      "suggest_only",
      "proposal_only",
    ]);
    expect(AGENT_RUNTIME_SCHEDULE_CLASSES).toEqual([
      "manual_only",
      "foreground_tick_candidate",
      "user_initiated",
      "disabled",
    ]);
    expect(AGENT_DECLARED_SOURCE_KINDS).toEqual([
      "obsidian",
      "google_gmail",
      "google_calendar",
      "google_drive",
      "github",
      "telemetry",
      "model_calls",
      "project_registry",
      "manual_input",
    ]);
  });

  it("validates a contract-only agent runtime declaration", () => {
    const contract = createAgentRuntimeContract(buildMonitorContract());

    expect(contract.id).toBe("build_monitor");
    expect(contract.authority).toBe("suggest_only");
    expect(contract.inbox_target).toBe("suggestion_inbox");
    expect(contract.governance).toEqual(AGENT_RUNTIME_GOVERNANCE_DEFAULTS);
    expect(contract.governance.execution_authority).toBe(false);
    expect(contract.governance.scheduler_implementation_enabled).toBe(false);
    expect(contract.governance.model_call_enabled).toBe(false);
    expect(contract.governance.obsidian_write_enabled).toBe(false);
  });

  it("validates an output routed to Suggestion Inbox with declared sources", () => {
    const contract = createAgentRuntimeContract(buildMonitorContract());
    const output = createAgentOutput(buildMonitorOutput());
    const validation = validateAgentOutputAgainstContract(contract, output);

    expect(output.output_type).toBe("report");
    expect(output.suggestion_inbox.target).toBe("suggestion_inbox");
    expect(output.suggestion_inbox.direct_execution_allowed).toBe(false);
    expect(output.direct_execution_attempted).toBe(false);
    expect(output.action_executed).toBe(false);
    expect(validation).toMatchObject({
      valid: true,
      agent_id: "build_monitor",
      output_id: "agent-output:build-monitor-report",
      reasons: ["valid_output"],
      suggestion_inbox_target: "suggestion_inbox",
      execution_authority: false,
      write_attempted: false,
      network_called: false,
      model_called: false,
    });
  });

  it("rejects undeclared source reads and cross-agent source kinds", () => {
    const contract = createAgentRuntimeContract(buildMonitorContract());
    const output = createAgentOutput({
      ...buildMonitorOutput(),
      source_refs: [
        {
          source_kind: "google_gmail",
          source_id: "google:gmail",
          content_hash: HASH,
          declared_in_contract: true,
          raw_body_included: false,
          metadata_only: true,
        },
      ],
    });

    const validation = validateAgentOutputAgainstContract(contract, output);
    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain("undeclared_source");
    expect(() =>
      createAgentRuntimeContract({
        ...buildMonitorContract(),
        declared_sources: [
          {
            source_kind: "agent_output",
            source_id: "agent:other",
            read_scope: "metadata_only",
            raw_body_allowed: false,
            secret_access_allowed: false,
            network_call_allowed: false,
            write_access_allowed: false,
            cross_agent_read_allowed: false,
          },
        ],
      }),
    ).toThrow();
  });

  it("requires Suggestion Inbox routing for every output", () => {
    expect(() =>
      createAgentOutput({
        ...buildMonitorOutput(),
        suggestion_inbox: {
          target: "direct_execution",
          output_routed_to_inbox: false,
          direct_execution_allowed: true,
          inbox_only: false,
          metadata_only: true,
        },
      }),
    ).toThrow();
  });

  it("requires proposal outputs to include Phase 18 approval metadata", () => {
    const contract = createAgentRuntimeContract({
      ...buildMonitorContract(),
      authority: "proposal_only",
      requires_approval: true,
      output_type: "recommendation",
    });

    expect(() =>
      createAgentRuntimeContract({
        ...buildMonitorContract(),
        authority: "proposal_only",
        requires_approval: false,
      }),
    ).toThrow("proposal_only agents require approval metadata");

    expect(() =>
      createAgentOutput({
        ...buildMonitorOutput(),
        output_type: "recommendation",
        authority: "proposal_only",
        implies_action: true,
        approval: {
          phase18_lifecycle_required: false,
          requires_approval: false,
          approval_status: "not_requested",
          approval_bypass_allowed: false,
          approval_created: false,
          execution_enabled: false,
          metadata_only: true,
        },
      }),
    ).toThrow("proposal outputs require Phase 18 approval lifecycle metadata");

    const output = createAgentOutput({
      ...buildMonitorOutput(),
      output_type: "recommendation",
      authority: "proposal_only",
      implies_action: true,
      approval: {
        phase18_lifecycle_required: true,
        requires_approval: true,
        approval_status: "pending",
        approval_bypass_allowed: false,
        approval_created: false,
        execution_enabled: false,
        metadata_only: true,
      },
    });
    const validation = validateAgentOutputAgainstContract(contract, output);
    expect(validation.valid).toBe(true);
  });

  it("requires verification metadata when contract requires verification", () => {
    expect(() =>
      createAgentRuntimeContract({
        ...buildMonitorContract(),
        risk_class: "critical",
        requires_verification: false,
      }),
    ).toThrow("critical-risk agents require verification metadata");

    const contract = createAgentRuntimeContract({
      ...buildMonitorContract(),
      requires_verification: true,
    });
    const output = createAgentOutput({
      ...buildMonitorOutput(),
      verification: {
        verification_supported: true,
        verification_required: false,
        verification_requested: false,
        verification_status: "not_required",
        verifier_ref_id: null,
        raw_verifier_response_included: false,
        metadata_only: true,
      },
    });

    const validation = validateAgentOutputAgainstContract(contract, output);
    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain("verification_metadata_required");
  });

  it("has no execution, scheduling, write, network, model, Google, or vault implementation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/contract.ts"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/index.ts"),
      "utf8",
    );

    for (const text of [source, index]) {
      expect(text).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
      expect(text).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
      expect(text).not.toMatch(
        /fetch\s*\(|googleapis|readGmail|readCalendar|readDrive/i,
      );
      expect(text).not.toMatch(
        /DeepSeek|Ollama|OpenAI|Anthropic|modelRuntime/i,
      );
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/from\s+["'].*approval-runtime/i);
      expect(text).not.toMatch(/from\s+["'].*routines/i);
      expect(text).not.toMatch(/backgroundDaemon|worker|queue/i);
    }
  });
});

function buildMonitorContract() {
  return {
    id: "build_monitor",
    version: "phase21h.agent-runtime-contract.v1",
    owner: "Prince Anozie",
    schedule_class: "manual_only",
    declared_sources: [
      {
        source_kind: "github",
        source_id: "github:jarvis",
        read_scope: "metadata_only",
        raw_body_allowed: false,
        secret_access_allowed: false,
        network_call_allowed: false,
        write_access_allowed: false,
        cross_agent_read_allowed: false,
      },
      {
        source_kind: "project_registry",
        source_id: "project:jarvis",
        read_scope: "metadata_only",
        raw_body_allowed: false,
        secret_access_allowed: false,
        network_call_allowed: false,
        write_access_allowed: false,
        cross_agent_read_allowed: false,
      },
    ],
    output_type: "report",
    risk_class: "medium",
    authority: "suggest_only",
    requires_verification: false,
    requires_approval: false,
    inbox_target: "suggestion_inbox",
    governance: AGENT_RUNTIME_GOVERNANCE_DEFAULTS,
  };
}

function buildMonitorOutput() {
  return {
    output_id: "agent-output:build-monitor-report",
    agent_id: "build_monitor",
    contract_version: "phase21h.agent-runtime-contract.v1",
    output_type: "report",
    authority: "suggest_only",
    risk_class: "medium",
    implies_action: false,
    summary_hash: HASH,
    source_refs: [
      {
        source_kind: "github",
        source_id: "github:jarvis",
        content_hash: HASH,
        declared_in_contract: true,
        raw_body_included: false,
        metadata_only: true,
      },
    ],
    suggestion_inbox: {
      target: "suggestion_inbox",
      output_routed_to_inbox: true,
      direct_execution_allowed: false,
      inbox_only: true,
      metadata_only: true,
    },
    approval: {
      phase18_lifecycle_required: false,
      requires_approval: false,
      approval_status: "not_required",
      approval_bypass_allowed: false,
      approval_created: false,
      execution_enabled: false,
      metadata_only: true,
    },
    verification: {
      verification_supported: true,
      verification_required: false,
      verification_requested: false,
      verification_status: "not_required",
      verifier_ref_id: null,
      raw_verifier_response_included: false,
      metadata_only: true,
    },
    created_at: NOW,
    metadata_only: true,
    raw_output_body_included: false,
    direct_execution_attempted: false,
    action_executed: false,
    schedule_created: false,
    model_called: false,
    network_called: false,
    obsidian_written: false,
  };
}
