import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInMemorySuggestionInboxAdapter } from "../suggestion-inbox";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_OUTPUT_FACTORY_VERSION,
  AGENT_PLANNER_VERSION,
  AGENT_SCHEDULED_INVOCATION_VERSION,
  buildAgentScheduledInvocation,
  createAgentOutputPreview,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  runAgentScheduledInvocation,
  type AgentOutputPreview,
} from ".";

describe("Agent scheduled invocation boundary", () => {
  it("builds a scheduler-callable invocation boundary", () => {
    const invocation = buildAgentScheduledInvocation("build_monitor");

    expect(invocation.invocation_version).toBe(
      AGENT_SCHEDULED_INVOCATION_VERSION,
    );
    expect(invocation.agent_id).toBe("build_monitor");
    expect(invocation.job_id).toBe(
      "agent-suite:build_monitor:suggestion-inbox-delivery",
    );
    expect(invocation.delivery_target).toBe("suggestion_inbox");
    expect(invocation.input_contract).toBe("supplied_agent_output_preview");
    expect(invocation.kill_switch.supported).toBe(true);
    expect(invocation.kill_switch.default_enabled).toBe(true);
    expect(invocation.idempotency.key_strategy).toBe(
      "agent_id_plus_preview_output_id",
    );
    expect(invocation.governance.no_daemon).toBe(true);
    expect(invocation.governance.no_autonomous_execution).toBe(true);
    expect(invocation.governance.no_filesystem_reads).toBe(true);
  });

  it("runs from supplied preview input through an injected adapter", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const preview = previewFor("build_monitor");

    const result = await runAgentScheduledInvocation(
      {
        agent_id: "build_monitor",
        preview,
        invoked_at: "2026-06-03T08:00:00.000Z",
      },
      { adapter },
    );

    expect(result.status).toBe("delivered");
    expect(result.delivered).toBe(true);
    expect(result.delivery?.agent_id).toBe("build_monitor");
    expect(result.metadata.idempotency_key).toBe(
      "agent:build_monitor:preview:build_monitor:report",
    );
    expect(result.no_daemon_started).toBe(true);
    expect(result.provider_call_attempted).toBe(false);
    expect(result.network_call_attempted).toBe(false);
    expect(result.filesystem_read_attempted).toBe(false);
    expect(adapter.listItems()).toHaveLength(1);
  });

  it("dedupes repeated invocations through the adapter idempotency key", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const preview = previewFor("health_agent");

    const first = await runAgentScheduledInvocation(
      {
        agent_id: "health_agent",
        preview,
        invoked_at: "2026-06-03T08:00:00.000Z",
      },
      { adapter },
    );
    const second = await runAgentScheduledInvocation(
      {
        agent_id: "health_agent",
        preview,
        invoked_at: "2026-06-03T08:00:00.000Z",
      },
      { adapter },
    );

    expect(first.status).toBe("delivered");
    expect(second.status).toBe("deduplicated");
    expect(second.delivered).toBe(false);
    expect(second.delivery?.deduplicated).toBe(true);
    expect(adapter.listItems()).toHaveLength(1);
  });

  it("supports kill switch skip without delivery", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const result = await runAgentScheduledInvocation(
      {
        agent_id: "deadline_agent",
        preview: previewFor("deadline_agent"),
        invoked_at: "2026-06-03T08:00:00.000Z",
      },
      { adapter, kill_switch_enabled: true },
    );

    expect(result.status).toBe("killed");
    expect(result.killed_by_switch).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.delivery).toBeNull();
    expect(result.failure_reason).toBe("kill_switch_enabled");
    expect(adapter.listItems()).toHaveLength(0);
  });

  it("rejects missing or mismatched supplied preview input", async () => {
    const missing = await runAgentScheduledInvocation({
      agent_id: "research_agent",
      invoked_at: "2026-06-03T08:00:00.000Z",
    });
    const mismatch = await runAgentScheduledInvocation({
      agent_id: "research_agent",
      preview: previewFor("build_monitor"),
      invoked_at: "2026-06-03T08:00:00.000Z",
    });

    expect(missing.status).toBe("rejected");
    expect(missing.failure_reason).toBe("supplied_preview_required");
    expect(mismatch.status).toBe("rejected");
    expect(mismatch.failure_reason).toBe("preview_agent_mismatch");
    expect(missing.action_execution_attempted).toBe(false);
    expect(mismatch.cross_agent_execution_attempted).toBe(false);
  });

  it("does not introduce daemon, provider, network, filesystem, or execution code", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/scheduled-invocation.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /cron|node-schedule|googleapis|google-auth-library|openai|anthropic|fetch|fs|path/i,
    );
    expect(source).not.toMatch(
      /setInterval|setTimeout|new\s+Worker|backgroundDaemon/i,
    );
    expect(source).not.toMatch(/readFile|writeFile|appendFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
    expect(source).not.toMatch(/crossAgentExecute|selfModify|authorityToken/i);
  });
});

function previewFor(
  agentId: Parameters<typeof getAgentRegistryEntry>[0],
): AgentOutputPreview {
  const entry = getAgentRegistryEntry(agentId);
  return createAgentOutputPreview({
    factory_version: AGENT_OUTPUT_FACTORY_VERSION,
    dry_run: executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan: planAgentRun({
        planner_version: AGENT_PLANNER_VERSION,
        agent_id: agentId,
        registry_entry: entry,
        run_context: "manual",
        available_metadata_sources: entry.declared_sources.map((source) => ({
          source_kind: source.source_kind,
          source_id: source.source_id,
          available: true,
          metadata_only: true,
          raw_body_included: false,
        })),
        requested_source_ids: [],
        requested_output_type: entry.output_type,
        trigger_metadata: null,
        metadata_only: true,
        execution_requested: false,
        scheduling_requested: false,
        write_requested: false,
      }),
      registry_entry: entry,
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    }),
    registry_entry: entry,
    fixture_metadata: null,
    metadata_only: true,
    inbox_write_requested: false,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    model_call_requested: false,
  });
}
