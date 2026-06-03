import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInMemorySuggestionInboxAdapter } from "../suggestion-inbox";
import {
  AGENT_DELIVERY_VERSION,
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_OUTPUT_FACTORY_VERSION,
  AGENT_PLANNER_VERSION,
  EXPANSION_ERA_AGENT_IDS,
  buildAgentInboxItem,
  createAgentOutputPreview,
  deliverAgentDigest,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  summarizeAgentDelivery,
  type AgentOutputPreview,
} from ".";

describe("Agent Suite Suggestion Inbox delivery realization", () => {
  it("builds source-attributed inbox items from agent previews", () => {
    const preview = previewFor("build_monitor");
    const item = buildAgentInboxItem(preview, {
      created_at: "2026-06-03T08:00:00.000Z",
    });

    expect(item.kind).toBe("agent_digest");
    expect(item.id).toBe(
      "inbox_item:agent:build_monitor:preview:build_monitor:report",
    );
    expect(item.title).toBe(preview.title);
    expect(item.source_ids).toContain(preview.output_id);
    expect(item.source_ids).toContain("agent:build_monitor");
    expect(item.sections[0]?.title).toBe("Source attribution");
    expect(item.user_visible).toBe(true);
    expect(item.governance.metadata_only).toBe(true);
    expect(item.governance.action_execution_supported).toBe(false);
    expect(item.governance.approval_finalization_supported).toBe(false);
  });

  it("maps alert outputs to alert inbox items", () => {
    const preview = previewFor("deadline_agent");
    const item = buildAgentInboxItem(preview);

    expect(preview.output_type).toBe("alert");
    expect(item.kind).toBe("system_alert");
    expect(item.raw_body_included).toBe(false);
  });

  it("delivers through an injected adapter and preserves governance metadata", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const preview = previewFor("life_coach");

    const result = await deliverAgentDigest(preview, {
      adapter,
      created_at: "2026-06-03T08:00:00.000Z",
    });
    const summary = summarizeAgentDelivery(result);

    expect(result.delivery_version).toBe(AGENT_DELIVERY_VERSION);
    expect(result.status).toBe("delivered");
    expect(result.delivered).toBe(true);
    expect(result.agent_id).toBe("life_coach");
    expect(result.inbox_kind).toBe("agent_digest");
    expect(result.governance.source_attributed).toBe(true);
    expect(result.governance.action_execution_attempted).toBe(false);
    expect(result.governance.approval_finalization_attempted).toBe(false);
    expect(result.execution_status).toBe("not_supported");
    expect(result.approval_status).toBe("not_supported");
    expect(summary.source_count).toBeGreaterThan(1);
    expect(adapter.listItems()).toHaveLength(1);
  });

  it("delivers deterministic inbox items for all eight agents", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const deliveredIds: string[] = [];

    for (const agentId of EXPANSION_ERA_AGENT_IDS) {
      const preview = previewFor(agentId);
      const result = await deliverAgentDigest(preview, {
        adapter,
        created_at: "2026-06-03T08:00:00.000Z",
      });

      expect(result.delivered).toBe(true);
      expect(result.agent_id).toBe(agentId);
      expect(result.source_ids).toContain(`agent:${agentId}`);
      expect(result.metadata_only).toBe(true);
      deliveredIds.push(result.inbox_item_id ?? "");
    }

    expect(deliveredIds).toEqual([
      "inbox_item:agent:life_coach:preview:life_coach:recommendation",
      "inbox_item:agent:build_monitor:preview:build_monitor:report",
      "inbox_item:agent:research_agent:preview:research_agent:report",
      "inbox_item:agent:cv_maintenance:preview:cv_maintenance:draft",
      "inbox_item:agent:application_tracker:preview:application_tracker:report",
      "inbox_item:agent:deadline_agent:preview:deadline_agent:alert",
      "inbox_item:agent:cost_monitor:preview:cost_monitor:alert",
      "inbox_item:agent:health_agent:preview:health_agent:digest",
    ]);
    expect(adapter.listItems()).toHaveLength(8);
  });

  it("defaults to dry-run when no adapter is supplied", async () => {
    const result = await deliverAgentDigest(previewFor("health_agent"));

    expect(result.status).toBe("dry_run");
    expect(result.delivered).toBe(false);
    expect(result.inbox_item_id).toBeNull();
    expect(result.delivery.delivery_mode).toBe("dry_run");
  });

  it("does not introduce provider, network, filesystem, approval, or cross-agent execution paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/delivery.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch|fs|path/i,
    );
    expect(source).not.toMatch(/sendEmail|createEvent|downloadFile/);
    expect(source).not.toMatch(/writeFile|appendFile|readFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
    expect(source).not.toMatch(/crossAgentExecute|selfModify|authorityToken/i);
  });
});

function previewFor(
  agentId: (typeof EXPANSION_ERA_AGENT_IDS)[number],
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
