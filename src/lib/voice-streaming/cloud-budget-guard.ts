import type {
  VoiceCloudBudgetDecision,
  VoiceCloudBudgetDimension,
  VoiceCloudBudgetGuardRecord,
  VoiceCloudBudgetGuardRequest,
  VoiceCloudBudgetGuardResult,
  VoiceCloudBudgetLimit,
  VoiceCloudBudgetUsage,
  VoiceCloudBudgetWindow,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

export interface VoiceCloudBudgetGuardOptions {
  enabled?: boolean;
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

interface BudgetEvaluation {
  decision: VoiceCloudBudgetDecision;
  exceededWindow?: VoiceCloudBudgetWindow;
  exceededDimension?: VoiceCloudBudgetDimension;
  exceededLimit?: number;
  projectedUsage?: number;
}

export class VoiceCloudBudgetGuard {
  constructor(private readonly opts: VoiceCloudBudgetGuardOptions = {}) {}

  async evaluate(
    request: VoiceCloudBudgetGuardRequest,
  ): Promise<VoiceCloudBudgetGuardResult> {
    const safeRequest = copyBudgetGuardRequest(request);
    const evaluation = this.evaluateBudget(safeRequest);
    const record: VoiceCloudBudgetGuardRecord = {
      id: this.newId(),
      requestId: safeRequest.id,
      sessionId: safeRequest.sessionId,
      providerId: safeRequest.providerId,
      requestedCapability: safeRequest.requestedCapability,
      decision: evaluation.decision,
      allowed: evaluation.decision === "allowed_metadata_only",
      estimatedMinutes: safeRequest.estimatedMinutes,
      estimatedCostUnits: safeRequest.estimatedCostUnits,
      requestCount: 1,
      currentSessionUsage: copyUsage(safeRequest.currentSessionUsage),
      currentDailyUsage: copyUsage(safeRequest.currentDailyUsage),
      currentMonthlyUsage: copyUsage(safeRequest.currentMonthlyUsage),
      configuredLimitCount: safeRequest.configuredLimits.length,
      createdAt: this.now(),
      exceededWindow: evaluation.exceededWindow,
      exceededDimension: evaluation.exceededDimension,
      exceededLimit: evaluation.exceededLimit,
      projectedUsage: evaluation.projectedUsage,
    };

    await this.emit(safeRequest, "voice_cloud_budget_evaluated", record, true);
    await this.emit(
      safeRequest,
      telemetryEventForDecision(record.decision),
      record,
      record.allowed,
    );
    return { request: safeRequest, record };
  }

  private evaluateBudget(
    request: VoiceCloudBudgetGuardRequest,
  ): BudgetEvaluation {
    if (this.opts.enabled !== true) {
      return { decision: "denied_budget_missing" };
    }
    if (request.providerId === "disabled") {
      return { decision: "denied_provider_disabled" };
    }
    if (!hasValidEstimates(request)) {
      return { decision: "denied_invalid_estimate" };
    }

    const matchingLimits = request.configuredLimits.filter((limit) =>
      limitApplies(limit, request),
    );
    if (matchingLimits.length === 0) {
      return { decision: "denied_budget_missing" };
    }

    for (const limit of matchingLimits) {
      const projectedUsage =
        usageForLimit(request, limit) + estimateForLimit(request, limit);
      if (projectedUsage > limit.limit) {
        return {
          decision: "denied_budget_exceeded",
          exceededWindow: limit.window,
          exceededDimension: limit.dimension,
          exceededLimit: limit.limit,
          projectedUsage,
        };
      }
    }

    return { decision: "allowed_metadata_only" };
  }

  private async emit(
    request: VoiceCloudBudgetGuardRequest,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    record: VoiceCloudBudgetGuardRecord,
    success: boolean,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: request.sessionId,
      state: request.voiceTurnState ?? "waiting_for_send",
      success,
      cloudBudgetRequestId: request.id,
      cloudBudgetRecordId: record.id,
      cloudProviderId: request.providerId,
      cloudRequestedCapability: request.requestedCapability,
      cloudBudgetDecision: record.decision,
      cloudBudgetAllowed: record.allowed,
      cloudEstimatedMinutes: request.estimatedMinutes,
      cloudEstimatedCostUnits: request.estimatedCostUnits,
      cloudRequestCount: 1,
      cloudConfiguredLimitCount: request.configuredLimits.length,
      cloudBudgetWindow: record.exceededWindow,
      cloudBudgetDimension: record.exceededDimension,
      cloudBudgetLimit: record.exceededLimit,
      cloudProjectedUsage: record.projectedUsage,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `cloud-budget-${this.now()}`;
  }
}

function hasValidEstimates(request: VoiceCloudBudgetGuardRequest): boolean {
  return (
    isNonNegativeFinite(request.estimatedMinutes) &&
    isNonNegativeFinite(request.estimatedCostUnits) &&
    usageIsValid(request.currentSessionUsage) &&
    usageIsValid(request.currentDailyUsage) &&
    usageIsValid(request.currentMonthlyUsage) &&
    request.configuredLimits.every((limit) => isNonNegativeFinite(limit.limit))
  );
}

function usageIsValid(usage: VoiceCloudBudgetUsage): boolean {
  return (
    isNonNegativeFinite(usage.estimatedMinutes) &&
    isNonNegativeFinite(usage.estimatedCostUnits) &&
    Number.isInteger(usage.requestCount) &&
    usage.requestCount >= 0
  );
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function limitApplies(
  limit: VoiceCloudBudgetLimit,
  request: VoiceCloudBudgetGuardRequest,
): boolean {
  return (
    (limit.providerId === undefined ||
      limit.providerId === request.providerId) &&
    (limit.requestedCapability === undefined ||
      limit.requestedCapability === request.requestedCapability)
  );
}

function usageForLimit(
  request: VoiceCloudBudgetGuardRequest,
  limit: VoiceCloudBudgetLimit,
): number {
  const usage = usageForWindow(request, limit.window);
  if (limit.dimension === "estimated_minutes") return usage.estimatedMinutes;
  if (limit.dimension === "estimated_cost_units") {
    return usage.estimatedCostUnits;
  }
  return usage.requestCount;
}

function estimateForLimit(
  request: VoiceCloudBudgetGuardRequest,
  limit: VoiceCloudBudgetLimit,
): number {
  if (limit.dimension === "estimated_minutes") return request.estimatedMinutes;
  if (limit.dimension === "estimated_cost_units") {
    return request.estimatedCostUnits;
  }
  return 1;
}

function usageForWindow(
  request: VoiceCloudBudgetGuardRequest,
  window: VoiceCloudBudgetWindow,
): VoiceCloudBudgetUsage {
  if (window === "per_session") return request.currentSessionUsage;
  if (window === "daily") return request.currentDailyUsage;
  return request.currentMonthlyUsage;
}

function telemetryEventForDecision(
  decision: VoiceCloudBudgetDecision,
): VoiceOrchestrationTelemetryEvent["eventType"] {
  if (decision === "allowed_metadata_only") return "voice_cloud_budget_allowed";
  if (decision === "denied_budget_exceeded") {
    return "voice_cloud_budget_exceeded";
  }
  if (decision === "denied_invalid_estimate") {
    return "voice_cloud_budget_invalid_estimate";
  }
  return "voice_cloud_budget_denied";
}

function copyBudgetGuardRequest(
  request: VoiceCloudBudgetGuardRequest,
): VoiceCloudBudgetGuardRequest {
  return {
    id: request.id,
    sessionId: request.sessionId,
    providerId: request.providerId,
    requestedCapability: request.requestedCapability,
    estimatedMinutes: request.estimatedMinutes,
    estimatedCostUnits: request.estimatedCostUnits,
    currentSessionUsage: copyUsage(request.currentSessionUsage),
    currentDailyUsage: copyUsage(request.currentDailyUsage),
    currentMonthlyUsage: copyUsage(request.currentMonthlyUsage),
    configuredLimits: request.configuredLimits.map(copyLimit),
    createdAt: request.createdAt,
    voiceTurnState: request.voiceTurnState,
  };
}

function copyUsage(usage: VoiceCloudBudgetUsage): VoiceCloudBudgetUsage {
  return {
    estimatedMinutes: usage.estimatedMinutes,
    estimatedCostUnits: usage.estimatedCostUnits,
    requestCount: usage.requestCount,
  };
}

function copyLimit(limit: VoiceCloudBudgetLimit): VoiceCloudBudgetLimit {
  return { ...limit };
}
