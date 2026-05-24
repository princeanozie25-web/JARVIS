import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  dryRunContext,
  expectNoSideEffects,
  planDryRun,
  readState,
  roomCommand,
} from "./harness";

describe("room adapter conformance: on/off command", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} plans on/off without mutation and executes only with approval`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        deviceId: subject.devices.power,
        capability: "power.switch",
        value: true,
      });

      const plan = await planDryRun(adapter, command);
      expect(plan).toMatchObject({
        mode: "dry_run",
        executable_now: false,
        adapter_called: false,
        intended_state: { power: "on" },
      });
      expectNoSideEffects(plan);
      await expect(
        readState(adapter, subject.devices.power),
      ).resolves.toMatchObject({
        state: { power: "off" },
      });

      await expect(
        adapter.executeCommand({
          command,
          context: dryRunContext(),
        }),
      ).resolves.toMatchObject({
        ok: false,
        failure_class: "approval_missing",
      });

      const result = await adapter.executeCommand({
        command: { ...command, mode: "approved_execution" },
        context: approvedContext(),
      });
      expect(result).toMatchObject({
        ok: true,
        mode: "approved_execution",
        state: { power: "on" },
        approval: { required: true, auto_approval_allowed: false },
      });
      expectNoSideEffects(result);
    });
  }
});
