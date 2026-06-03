import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUGGESTION_INBOX_BRIDGE_VERSION,
  assertSafeSuggestionInboxItem,
  buildSuggestionInboxItem,
  createDryRunSuggestionInboxAdapter,
  createInMemorySuggestionInboxAdapter,
  deliverSuggestionInboxItem,
  type SuggestionInboxDeliveryAdapter,
} from ".";

describe("Suggestion Inbox delivery bridge", () => {
  it("builds governed inbox items for future agent delivery", () => {
    const item = buildItem();

    expect(item.bridge_version).toBe(SUGGESTION_INBOX_BRIDGE_VERSION);
    expect(item.kind).toBe("morning_brief");
    expect(item.user_visible).toBe(true);
    expect(item.metadata_only).toBe(true);
    expect(item.raw_body_included).toBe(false);
    expect(item.no_action_execution).toBe(true);
    expect(item.no_approval_finalization).toBe(true);
    expect(item.governance.action_execution_supported).toBe(false);
    expect(item.governance.approval_finalization_supported).toBe(false);
    expect(item.governance.provider_call_attempted).toBe(false);
    expect(item.governance.network_call_attempted).toBe(false);
  });

  it("defaults to dry-run delivery without writing", async () => {
    const result = await deliverSuggestionInboxItem(buildItem());

    expect(result.delivered).toBe(false);
    expect(result.inbox_item_id).toBeNull();
    expect(result.delivery_mode).toBe("dry_run");
    expect(result.reasons).toContain("dry_run_default_no_write");
    expect(result.execution_status).toBe("not_supported");
    expect(result.approval_status).toBe("not_supported");
  });

  it("supports an injected adapter while preserving governance metadata", async () => {
    const adapter: SuggestionInboxDeliveryAdapter = {
      adapter_id: "test-injected-inbox",
      mode: "injected",
      deliverItem(item) {
        return {
          bridge_version: SUGGESTION_INBOX_BRIDGE_VERSION,
          delivered: true,
          inbox_item_id: item.id,
          source_ids: item.source_ids,
          readiness_status: item.readiness_status,
          degraded: item.degraded,
          delivery_mode: "injected",
          adapter_id: "test-injected-inbox",
          idempotency_key: item.idempotency_key,
          deduplicated: false,
          reasons: ["test_adapter_delivered"],
          governance: item.governance,
          execution_status: "not_supported",
          approval_status: "not_supported",
          metadata_only: true,
          raw_body_included: false,
        };
      },
    };

    const result = await deliverSuggestionInboxItem(buildItem(), { adapter });

    expect(result.delivered).toBe(true);
    expect(result.delivery_mode).toBe("injected");
    expect(result.governance.metadata_only).toBe(true);
    expect(result.governance.action_execution_attempted).toBe(false);
    expect(result.governance.approval_finalization_attempted).toBe(false);
  });

  it("can deliver locally in memory and dedupe by idempotency key", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const item = buildItem();

    const first = await deliverSuggestionInboxItem(item, { adapter });
    const second = await deliverSuggestionInboxItem(item, { adapter });

    expect(first.delivered).toBe(true);
    expect(first.inbox_item_id).toBe(item.id);
    expect(second.delivered).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.inbox_item_id).toBe(item.id);
    expect(adapter.listItems()).toHaveLength(1);
  });

  it("rejects execution or approval affordances", () => {
    const item = buildItem();

    const unsafeAction = {
      ...item,
      no_action_execution: false,
    } as unknown as typeof item;
    const unsafeApproval = {
      ...item,
      governance: {
        ...item.governance,
        approval_finalization_attempted: true,
      },
    } as unknown as typeof item;

    expect(() => assertSafeSuggestionInboxItem(unsafeAction)).toThrow();
    expect(() => assertSafeSuggestionInboxItem(unsafeApproval)).toThrow();
  });

  it("does not export forbidden action helper names or call providers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/suggestion-inbox/index.ts"),
      "utf8",
    );
    const exports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("export "));

    expect(exports.join("\n")).not.toMatch(
      /\b(execute|send|apply|approve)[A-Z][A-Za-z0-9_]*/i,
    );
    expect(source).not.toMatch(/fetch|googleapis|openai|anthropic/i);
    expect(source).not.toMatch(/writeFile|appendFile|insert|update|delete/i);
    expect(createDryRunSuggestionInboxAdapter().mode).toBe("dry_run");
  });
});

function buildItem() {
  return buildSuggestionInboxItem({
    kind: "morning_brief",
    title: "Morning Brief",
    summary: "Metadata-only digest summary.",
    sections: [
      {
        section_id: "morning-brief:gmail",
        title: "Gmail metadata",
        summary: "Two Gmail metadata records.",
        item_count: 2,
        metadata_only: true,
        raw_body_included: false,
      },
    ],
    source_ids: ["suggestion:morning-brief:test"],
    readiness_status: "ready",
    degraded: false,
    created_at: "2026-06-03T08:00:00.000Z",
    idempotency_key: "morning-brief:test:2026-06-03",
  });
}
