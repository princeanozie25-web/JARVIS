import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  enableFailure,
  expectNoSideEffects,
  roomCommand,
} from "./harness";

describe("room adapter conformance: partial success failure", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} exposes deterministic partial success through the adapter contract`, async () => {
      const adapter = subject.create();
      enableFailure(adapter, "partial_success", subject.devices.power);

      const result = await adapter.executeCommand({
        command: {
          ...roomCommand({
            commandId: "command-partial-success",
            deviceId: subject.devices.power,
            capability: "power.switch",
            value: true,
          }),
          mode: "approved_execution",
        },
        context: approvedContext("approval-partial-success-1"),
      });

      expect(result).toMatchObject({
        ok: false,
        operation: "execute_command",
        mode: "approved_execution",
        failure_class: "partial_success",
        state: { power: "on" },
        provenance: {
          adapter_id: adapter.descriptor.identity.adapter_id,
          device_id: subject.devices.power,
          capability: "power.switch",
          approval_id: "approval-partial-success-1",
          metadata_only: true,
        },
        partial_success: {
          result_status: "partial_success",
          automatic_retry: false,
          fallback_adapter_used: false,
          audit_event_required: true,
          future_real_hue_parity: true,
          metadata_only: true,
          successful_operations: [
            {
              operation_type: "adapter_write",
              device_id: subject.devices.power,
              capability: "power.switch",
              status: "success",
              failure_class: null,
              reason: null,
              metadata_only: true,
            },
          ],
          failed_operations: [
            {
              operation_type: "verification_read",
              device_id: subject.devices.power,
              capability: "power.switch",
              status: "failed",
              failure_class: "verification_failed",
              metadata_only: true,
            },
          ],
        },
      });
      expect(result.partial_success?.failed_operations[0]?.reason).toContain(
        "verification failed",
      );
      expectNoSideEffects(result);

      const events = adapter.getEvents?.() ?? [];
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            result_status: "partial_success",
            failure_class: "partial_success",
            network_called: false,
            hardware_io_performed: false,
            persisted: false,
            metadata_only: true,
          }),
        ]),
      );
      expect(
        events.filter(
          (event) =>
            event.result_status === "ok" &&
            event.failure_class === "partial_success",
        ),
      ).toHaveLength(0);
    });
  }
});
