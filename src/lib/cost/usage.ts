import type { BudgetPeriod, UsageWindows } from "./types";

const WINDOW_MS: Record<BudgetPeriod, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

interface UsageEntry {
  at: number;
  costUsd: number;
}

export interface UsageStore {
  record(costUsd: number, at?: number): void;
  windows(at?: number): UsageWindows;
  reset(): void;
}

class InMemoryUsageStore implements UsageStore {
  private entries: UsageEntry[] = [];

  record(costUsd: number, at: number = Date.now()): void {
    this.entries.push({ at, costUsd });
    this.prune(at);
  }

  windows(at: number = Date.now()): UsageWindows {
    this.prune(at);
    return {
      daily: this.sumWithin(at, WINDOW_MS.daily),
      weekly: this.sumWithin(at, WINDOW_MS.weekly),
      monthly: this.sumWithin(at, WINDOW_MS.monthly),
    };
  }

  reset(): void {
    this.entries = [];
  }

  private sumWithin(now: number, windowMs: number): number {
    let total = 0;
    for (const entry of this.entries) {
      if (now - entry.at <= windowMs) {
        total += entry.costUsd;
      }
    }
    return total;
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS.monthly;
    this.entries = this.entries.filter((e) => e.at >= cutoff);
  }
}

export const usage: UsageStore = new InMemoryUsageStore();
