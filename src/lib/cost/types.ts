export type BudgetPeriod = "daily" | "weekly" | "monthly";

export interface Budget {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface UsageWindows {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface GuardAllow {
  ok: true;
  usage: UsageWindows;
  budget: Budget;
}

export interface GuardDeny {
  ok: false;
  reason: "budget_exceeded";
  period: BudgetPeriod;
  spent: number;
  limit: number;
  message: string;
}

export type GuardResult = GuardAllow | GuardDeny;
