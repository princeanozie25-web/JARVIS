import { budget } from "./config";
import { usage } from "./usage";
import type { BudgetPeriod, GuardResult } from "./types";

export function canExecuteRequest(): GuardResult {
  const current = usage.windows();

  const checks: Array<[BudgetPeriod, number, number]> = [
    ["daily", current.daily, budget.daily],
    ["weekly", current.weekly, budget.weekly],
    ["monthly", current.monthly, budget.monthly],
  ];

  for (const [period, spent, limit] of checks) {
    if (spent >= limit) {
      return {
        ok: false,
        reason: "budget_exceeded",
        period,
        spent,
        limit,
        message: `${period} budget exceeded: $${spent.toFixed(4)} of $${limit.toFixed(2)}`,
      };
    }
  }

  return { ok: true, usage: current, budget };
}
