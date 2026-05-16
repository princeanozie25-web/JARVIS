import type { Message } from "../types";
import type { ProviderId } from "../providers/types";

export interface EvalCase {
  id: string;
  label: string;
  messages: Message[];
}

export interface EvalTarget {
  providerId: ProviderId;
  modelId: string;
}

export interface EvalResult {
  id: string;
  runId: string;
  caseId: string;
  caseLabel: string;
  providerId: ProviderId;
  modelId: string;
  modelName: string;
  output: string;
  latencyMs: number;
  timeToFirstTokenMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  success: boolean;
  errorMessage?: string;
  createdAt: number;
}

export interface EvalRun {
  id: string;
  label?: string;
  createdAt: number;
  completedAt?: number;
  caseCount: number;
  targetCount: number;
}
