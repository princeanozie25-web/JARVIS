import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  enableFailure,
  expectNoSideEffects,
  planDryRun,
  readState,
  roomCommand,
} from "./harness";

describe("room adapter conformance: rollback compensation scaffold", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} describes compensation for supported mutating dry-runs without executing it`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        commandId: "command-compensation-plan",
        deviceId: subject.devices.power,
        capability: "power.switch",
        value: true,
      });

      const plan = await planDryRun(adapter, command);
      const stateAfterPlan = await readState(adapter, subject.devices.power);

      expect(plan.compensation).toMatchObject({
        compensation_id: "compensation-command-compensation-plan",
        source_command_id: "command-compensation-plan",
        source_operation: "plan_command",
        scope: "command",
        device_id: subject.devices.power,
        capability: "power.switch",
        restore_action: "set_power",
        restore_value: false,
        descriptive_only: true,
        requires_future_approval: true,
        approval_lifecycle: "future_approval_required",
        auto_execute: false,
        executed: false,
        rollback_execution_enabled: false,
        metadata_only: true,
        adapter_called: false,
        hardware_io_performed: false,
        network_called: false,
        persisted: false,
        ui_rendered: false,
        sub_operations: [
          {
            device_id: subject.devices.power,
            capability: "power.switch",
            source_status: "success",
            compensation_required: true,
            metadata_only: true,
          },
        ],
      });
      expect(stateAfterPlan.state).toMatchObject({ power: "off" });
      expectNoSideEffects(plan.compensation!);
    });

    it(`${subject.name} returns descriptive compensation after approved fake execution without auto-rollback`, async () => {
      const adapter = subject.create();
      const command = {
        ...roomCommand({
          commandId: "command-compensation-execute",
          deviceId: subject.devices.power,
          capability: "power.switch",
          value: true,
        }),
        mode: "approved_execution" as const,
      };

      const result = await adapter.executeCommand({
        command,
        context: approvedContext("approval-compensation-1"),
      });
      const stateAfterExecution = await readState(
        adapter,
        subject.devices.power,
      );

      expect(result).toMatchObject({
        ok: true,
        compensation: {
          source_operation: "execute_command",
          scope: "command",
          restore_action: "set_power",
          restore_value: false,
          descriptive_only: true,
          requires_future_approval: true,
          auto_execute: false,
          executed: false,
          rollback_execution_enabled: false,
          metadata_only: true,
        },
      });
      expect(stateAfterExecution.state).toMatchObject({ power: "on" });
      expectNoSideEffects(result);
      expectNoSideEffects(result.compensation!);

      expect(adapter.getEvents?.()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            result_status: "ok",
            compensation_available: true,
            compensation_requires_future_approval: true,
            compensation_executed: false,
            network_called: false,
            hardware_io_performed: false,
            persisted: false,
          }),
        ]),
      );
    });

    it(`${subject.name} separates compensation for successful and failed partial-success sub-operations`, async () => {
      const adapter = subject.create();
      enableFailure(adapter, "partial_success", subject.devices.power);

      const result = await adapter.executeCommand({
        command: {
          ...roomCommand({
            commandId: "command-compensation-partial",
            deviceId: subject.devices.power,
            capability: "power.switch",
            value: true,
          }),
          mode: "approved_execution",
        },
        context: approvedContext("approval-compensation-partial-1"),
      });
      const stateAfterPartial = await readState(adapter, subject.devices.power);

      expect(result).toMatchObject({
        ok: false,
        failure_class: "partial_success",
        compensation: {
          source_operation: "execute_command",
          scope: "partial_success",
          restore_action: "set_power",
          restore_value: false,
          descriptive_only: true,
          requires_future_approval: true,
          auto_execute: false,
          executed: false,
          rollback_execution_enabled: false,
          sub_operations: [
            {
              source_status: "success",
              compensation_required: true,
              metadata_only: true,
            },
            {
              source_status: "failed",
              compensation_required: false,
              metadata_only: true,
            },
          ],
        },
      });
      expect(stateAfterPartial.state).toMatchObject({ power: "on" });
      expectNoSideEffects(result.compensation!);
      expect(adapter.getEvents?.()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            result_status: "partial_success",
            compensation_available: true,
            compensation_requires_future_approval: true,
            compensation_executed: false,
          }),
        ]),
      );
    });
  }

  it("does not introduce real Hue, network, scene, schedule, or routine markers", () => {
    const adapterSource = readAdapterSource();
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(adapterSource).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });
});

function readAdapterSource(): string {
  const root = join(process.cwd(), "src/room/adapters");

  return readdirSync(root)
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => readFileSync(join(root, entry), "utf8"))
    .join("\n");
}
