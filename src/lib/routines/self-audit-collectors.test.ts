import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELF_AUDIT_COLLECTOR_CONTRACTS,
  SELF_AUDIT_COLLECTOR_SURFACES,
  SelfAuditCollectorResultSchema,
  SelfAuditCollectorTelemetryEventSchema,
  createSelfAuditCollectorTelemetryEvent,
  validateSelfAuditCollectorContract,
  type SelfAuditCollectorContract,
} from "./index";

function cloneContract(): SelfAuditCollectorContract {
  return structuredClone(DEFAULT_SELF_AUDIT_COLLECTOR_CONTRACTS[0]);
}

describe("Phase 8C.1 self-audit read-only collector contracts", () => {
  it("validates all supported collector surfaces as read-only contracts", () => {
    expect(
      DEFAULT_SELF_AUDIT_COLLECTOR_CONTRACTS.map((item) => item.surface),
    ).toEqual(SELF_AUDIT_COLLECTOR_SURFACES);

    for (const contract of DEFAULT_SELF_AUDIT_COLLECTOR_CONTRACTS) {
      expect(contract).toMatchObject({
        read_only: true,
        writes_allowed: false,
        network_allowed: false,
        cloud_allowed: false,
        tools_allowed: false,
        actions_allowed: false,
        approvals_allowed: false,
        mutations_allowed: false,
        metadata_only: true,
      });
      expect(validateSelfAuditCollectorContract(contract)).toMatchObject({
        pass: true,
        surface: contract.surface,
        violation_count: 0,
        db_read_performed: false,
        db_write_performed: false,
      });
    }
  });

  it("rejects collectors with writes_allowed true", () => {
    const contract = { ...cloneContract(), writes_allowed: true };

    expect(validateSelfAuditCollectorContract(contract)).toMatchObject({
      pass: false,
      violations: ["writes_forbidden"],
      db_write_performed: false,
    });
  });

  it("rejects collectors with network, tools, actions, or approvals allowed", () => {
    const contract = {
      ...cloneContract(),
      network_allowed: true,
      cloud_allowed: true,
      tools_allowed: true,
      actions_allowed: true,
      approvals_allowed: true,
    };

    expect(validateSelfAuditCollectorContract(contract)).toMatchObject({
      pass: false,
      violations: expect.arrayContaining([
        "network_forbidden",
        "cloud_forbidden",
        "tools_forbidden",
        "actions_forbidden",
        "approvals_forbidden",
      ]),
      network_called: false,
      cloud_called: false,
      tool_called: false,
      action_executed: false,
      approval_triggered: false,
    });
  });

  it("rejects mutation-capable collectors", () => {
    const contract = { ...cloneContract(), mutations_allowed: true };

    expect(validateSelfAuditCollectorContract(contract)).toMatchObject({
      pass: false,
      violations: ["mutations_forbidden"],
      project_mutated: false,
      environment_mutated: false,
      runtime_mutated: false,
    });
  });

  it("rejects raw text, body, content, frame, OCR, screen, person, PII, and secret fields", () => {
    for (const field of [
      "raw_text",
      "body",
      "content",
      "frame",
      "ocr_text",
      "screen_text",
      "person_name",
      "pii",
      "secret",
      "api_key",
    ]) {
      expect(
        validateSelfAuditCollectorContract({
          ...cloneContract(),
          allowed_fields: ["counts", field],
        }),
      ).toMatchObject({
        pass: false,
        violations: ["invalid_contract_shape"],
      });
    }
  });

  it("keeps result schemas to counts, bins, classes, and metadata only", () => {
    const result = SelfAuditCollectorResultSchema.parse({
      surface: "failures",
      counts: [{ class: "timeout", count: 2 }],
      bins: [{ bin: "recent", count: 2 }],
      classes: ["timeout"],
      duration_ms: 10,
      rows_read_bin: "1_10",
      truncated: true,
      error_class: "none",
      redaction_status: "metadata_only",
      read_only: true,
      metadata_only: true,
      raw_content_included: false,
      writes_performed: false,
      tools_called: false,
      network_called: false,
      actions_executed: false,
      approvals_triggered: false,
      mutations_performed: false,
    });

    expect(result).toMatchObject({
      counts: [{ class: "timeout", count: 2 }],
      bins: [{ bin: "recent", count: 2 }],
      classes: ["timeout"],
      raw_content_included: false,
      writes_performed: false,
    });
    expect(
      SelfAuditCollectorResultSchema.safeParse({
        ...result,
        raw_text: "private",
      }).success,
    ).toBe(false);
    expect(
      SelfAuditCollectorResultSchema.safeParse({
        ...result,
        ocr_text: "screen text",
      }).success,
    ).toBe(false);
  });

  it("represents truncation and error_class as metadata only", () => {
    expect(
      SelfAuditCollectorResultSchema.parse({
        surface: "cost_telemetry",
        counts: [],
        bins: [],
        classes: ["collector_unavailable"],
        duration_ms: 0,
        rows_read_bin: "none",
        truncated: true,
        error_class: "collector_unavailable",
        redaction_status: "redacted",
        read_only: true,
        metadata_only: true,
        raw_content_included: false,
        writes_performed: false,
        tools_called: false,
        network_called: false,
        actions_executed: false,
        approvals_triggered: false,
        mutations_performed: false,
      }),
    ).toMatchObject({
      truncated: true,
      error_class: "collector_unavailable",
      metadata_only: true,
      raw_content_included: false,
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const validations = DEFAULT_SELF_AUDIT_COLLECTOR_CONTRACTS.map((contract) =>
      validateSelfAuditCollectorContract(contract),
    );
    const event = createSelfAuditCollectorTelemetryEvent({ validations });

    expect(event).toEqual({
      event_type: "self_audit_collector_validated",
      pass: true,
      collector_count: SELF_AUDIT_COLLECTOR_SURFACES.length,
      violation_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      db_read_performed: false,
      db_write_performed: false,
      tool_called: false,
      action_executed: false,
      approval_triggered: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      runtime_mutated: false,
      network_called: false,
      cloud_called: false,
    });
    expect(
      SelfAuditCollectorTelemetryEventSchema.safeParse({
        ...event,
        db_read_performed: true,
        tool_called: true,
        network_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB reads, writes, tools, network, or execution paths", () => {
    const validation = validateSelfAuditCollectorContract(cloneContract());

    expect({
      dbRead: validation.db_read_performed,
      dbWrite: validation.db_write_performed,
      toolCalled: validation.tool_called,
      actionExecuted: validation.action_executed,
      approvalTriggered: validation.approval_triggered,
      memoryWritten: validation.memory_written,
      networkCalled: validation.network_called,
      cloudCalled: validation.cloud_called,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      toolCalled: false,
      actionExecuted: false,
      approvalTriggered: false,
      memoryWritten: false,
      networkCalled: false,
      cloudCalled: false,
    });
  });
});
