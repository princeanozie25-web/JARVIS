import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES,
  COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES,
  DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
  CommandCenterObservabilitySourceAdapterDescriptorSchema,
  findCommandCenterObservabilitySourceAdapterByCategory,
  listCommandCenterObservabilitySourceAdapters,
  resolveCommandCenterObservabilityAdapterMaxItems,
  validateCommandCenterObservabilitySourceAdapterDescriptor,
  validateCommandCenterObservabilitySourceAdapterRegistry,
  type CommandCenterObservabilityQueryCategory,
} from "./index";

describe("Phase 9B3 command center observability source adapter contracts", () => {
  it("provides one default adapter descriptor for every allowed query category", () => {
    const adapters = listCommandCenterObservabilitySourceAdapters();

    expect(adapters.map((adapter) => adapter.category)).toEqual([
      ...COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES,
    ]);
    expect(adapters).toHaveLength(
      COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES.length,
    );
    expect(
      validateCommandCenterObservabilitySourceAdapterRegistry().passed,
    ).toBe(true);
  });

  it("keeps every adapter read-only, metadata-only, redaction-required, and descriptor-only", () => {
    for (const adapter of listCommandCenterObservabilitySourceAdapters()) {
      expect(adapter).toMatchObject({
        read_only: true,
        metadata_only: true,
        redaction_required: true,
        descriptor_only: true,
        source_reads_wired: false,
        db_read_performed: false,
        telemetry_read_performed: false,
        live_stream_wired: false,
        can_mutate: false,
        can_execute: false,
        can_collect_new_data: false,
      });
      expect(
        validateCommandCenterObservabilitySourceAdapterDescriptor(adapter),
      ).toMatchObject({
        passed: true,
        reasons: ["adapter_valid"],
        read_only: true,
        metadata_only: true,
        redaction_required: true,
      });
    }
  });

  it("rejects duplicate categories in a registry", () => {
    const adapters = listCommandCenterObservabilitySourceAdapters();
    const validation = validateCommandCenterObservabilitySourceAdapterRegistry({
      ...DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
      adapters: [...adapters, adapters[0]],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["duplicate_category"]),
      duplicate_categories: [adapters[0].category],
      descriptor_only: true,
      source_reads_wired: false,
    });
  });

  it("rejects mutating adapters", () => {
    const adapter = listCommandCenterObservabilitySourceAdapters()[0];
    const validation =
      validateCommandCenterObservabilitySourceAdapterDescriptor({
        ...adapter,
        read_only: false,
        can_mutate: true,
      });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "mutating_adapter"]),
      category: adapter.category,
      read_only: false,
      can_mutate: false,
      can_execute: false,
    });
  });

  it("rejects adapters declaring forbidden raw payload fields as allowed classes", () => {
    const adapter = listCommandCenterObservabilitySourceAdapters()[0];
    const validation =
      validateCommandCenterObservabilitySourceAdapterDescriptor({
        ...adapter,
        allowed_field_classes: [
          ...adapter.allowed_field_classes,
          COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES[0],
        ],
      });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_declared",
      ]),
      category: adapter.category,
    });
  });

  it("rejects replay-safe support on non-replay-compatible categories", () => {
    const adapter = listCommandCenterObservabilitySourceAdapters().find(
      (item) =>
        !(
          COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES as readonly string[]
        ).includes(item.category),
    );
    expect(adapter).toBeDefined();

    const validation =
      validateCommandCenterObservabilitySourceAdapterDescriptor({
        ...adapter!,
        supports_replay_safe: true,
      });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["replay_safe_not_allowed"]),
      category: adapter!.category,
    });
  });

  it("enforces hard caps deterministically", () => {
    const adapter = listCommandCenterObservabilitySourceAdapters()[0];

    expect(
      resolveCommandCenterObservabilityAdapterMaxItems({
        adapter,
        requested_max_items: 1_000,
      }),
    ).toBe(adapter.max_items_hard_cap);
    expect(
      resolveCommandCenterObservabilityAdapterMaxItems({
        adapter,
        requested_max_items: -10,
      }),
    ).toBe(1);
    expect(
      validateCommandCenterObservabilitySourceAdapterDescriptor({
        ...adapter,
        max_items_default: adapter.max_items_hard_cap + 1,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["hard_cap_exceeded"]),
    });
  });

  it("fails closed for unknown category lookup", () => {
    expect(
      findCommandCenterObservabilitySourceAdapterByCategory("unknown"),
    ).toEqual({
      found: false,
      category: null,
      adapter: null,
      reason: "unknown_category",
      descriptor_only: true,
      source_reads_wired: false,
    });
  });

  it("keeps all descriptors serializable", () => {
    for (const adapter of listCommandCenterObservabilitySourceAdapters()) {
      expect(JSON.parse(JSON.stringify(adapter))).toEqual(adapter);
      expect(
        CommandCenterObservabilitySourceAdapterDescriptorSchema.parse(adapter),
      ).toEqual(adapter);
    }
  });

  it("exports registry helpers from the command-center index", () => {
    const category: CommandCenterObservabilityQueryCategory = "traces";
    const lookup =
      findCommandCenterObservabilitySourceAdapterByCategory(category);

    expect(typeof listCommandCenterObservabilitySourceAdapters).toBe(
      "function",
    );
    expect(typeof validateCommandCenterObservabilitySourceAdapterRegistry).toBe(
      "function",
    );
    expect(lookup).toMatchObject({
      found: true,
      category,
      reason: "adapter_valid",
      adapter: {
        category,
        supports_replay_safe: true,
      },
    });
  });
});
