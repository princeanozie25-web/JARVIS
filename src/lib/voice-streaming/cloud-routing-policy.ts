import type {
  VoiceCloudProviderId,
  VoiceCloudRoutingCapability,
  VoiceCloudRoutingDecision,
  VoiceCloudRoutingDenialReason,
  VoiceCloudRoutingPolicyRecord,
  VoiceCloudRoutingPolicyRequest,
  VoiceCloudRoutingPolicyResult,
  VoiceCloudRoutingPolicyState,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

export interface VoiceCloudRoutingPolicyOptions {
  enabled?: boolean;
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export class VoiceCloudRoutingPolicy {
  constructor(private readonly opts: VoiceCloudRoutingPolicyOptions = {}) {}

  async evaluate(
    request: VoiceCloudRoutingPolicyRequest,
  ): Promise<VoiceCloudRoutingPolicyResult> {
    const safeRequest = copyCloudRoutingPolicyRequest(request);
    const state = this.resolveState(safeRequest);
    const denialReason = denialReasonForState(state);
    const decision: VoiceCloudRoutingDecision =
      state === "eligible_metadata_only"
        ? "allow_metadata_only"
        : "deny_metadata_only";
    const record: VoiceCloudRoutingPolicyRecord = {
      id: this.newId(),
      requestId: safeRequest.id,
      sessionId: safeRequest.sessionId,
      providerId: safeRequest.providerId,
      requestedCapability: safeRequest.requestedCapability,
      state,
      decision,
      allowed: decision === "allow_metadata_only",
      consentGranted: safeRequest.consentGranted,
      costDisclosureAccepted: safeRequest.costDisclosureAccepted,
      budgetAvailable: safeRequest.budgetAvailable,
      localFallbackAvailable: safeRequest.localFallbackAvailable,
      createdAt: this.now(),
      denialReason,
    };

    await this.emit(
      safeRequest,
      "voice_cloud_routing_policy_evaluated",
      record,
      true,
    );
    await this.emit(
      safeRequest,
      telemetryEventForState(state),
      record,
      record.allowed,
    );
    return { request: safeRequest, record };
  }

  private resolveState(
    request: VoiceCloudRoutingPolicyRequest,
  ): VoiceCloudRoutingPolicyState {
    if (this.opts.enabled !== true) return "disabled";
    if (request.providerId === "disabled") return "disabled";
    if (!request.consentGranted) return "consent_required";
    if (!request.costDisclosureAccepted) return "cost_disclosure_required";
    if (!request.budgetAvailable) return "budget_required";
    if (
      !capabilityMatchesProvider(
        request.providerId,
        request.requestedCapability,
      )
    ) {
      return "denied";
    }
    return "eligible_metadata_only";
  }

  private async emit(
    request: VoiceCloudRoutingPolicyRequest,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    record: VoiceCloudRoutingPolicyRecord,
    success: boolean,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: request.sessionId,
      state: request.voiceTurnState ?? "waiting_for_send",
      success,
      cloudRoutingRequestId: request.id,
      cloudRoutingPolicyRecordId: record.id,
      cloudProviderId: request.providerId,
      cloudRequestedCapability: request.requestedCapability,
      cloudRoutingPolicyState: record.state,
      cloudRoutingDecision: record.decision,
      cloudRoutingDenialReason: record.denialReason,
      cloudRoutingAllowed: record.allowed,
      cloudConsentGranted: request.consentGranted,
      cloudCostDisclosureAccepted: request.costDisclosureAccepted,
      cloudBudgetAvailable: request.budgetAvailable,
      cloudLocalFallbackAvailable: request.localFallbackAvailable,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `cloud-routing-policy-${this.now()}`;
  }
}

function capabilityMatchesProvider(
  providerId: VoiceCloudProviderId,
  requestedCapability: VoiceCloudRoutingCapability,
): boolean {
  if (providerId === "openai_realtime") {
    return requestedCapability === "realtime_voice";
  }
  if (providerId === "cloud_stt") {
    return requestedCapability === "speech_to_text";
  }
  if (providerId === "cloud_tts") {
    return requestedCapability === "text_to_speech";
  }
  return false;
}

function denialReasonForState(
  state: VoiceCloudRoutingPolicyState,
): VoiceCloudRoutingDenialReason | undefined {
  if (state === "disabled") return "policy_disabled";
  if (state === "consent_required") return "consent_required";
  if (state === "cost_disclosure_required") {
    return "cost_disclosure_required";
  }
  if (state === "budget_required") return "budget_required";
  if (state === "denied") return "capability_not_supported";
  return undefined;
}

function telemetryEventForState(
  state: VoiceCloudRoutingPolicyState,
): VoiceOrchestrationTelemetryEvent["eventType"] {
  if (state === "eligible_metadata_only") {
    return "voice_cloud_routing_policy_allowed";
  }
  if (state === "consent_required") {
    return "voice_cloud_routing_policy_consent_required";
  }
  if (state === "cost_disclosure_required") {
    return "voice_cloud_routing_policy_cost_disclosure_required";
  }
  if (state === "budget_required") {
    return "voice_cloud_routing_policy_budget_required";
  }
  return "voice_cloud_routing_policy_denied";
}

function copyCloudRoutingPolicyRequest(
  request: VoiceCloudRoutingPolicyRequest,
): VoiceCloudRoutingPolicyRequest {
  return {
    id: request.id,
    sessionId: request.sessionId,
    providerId: request.providerId,
    requestedCapability: request.requestedCapability,
    consentGranted: request.consentGranted,
    costDisclosureAccepted: request.costDisclosureAccepted,
    budgetAvailable: request.budgetAvailable,
    localFallbackAvailable: request.localFallbackAvailable,
    createdAt: request.createdAt,
    voiceTurnState: request.voiceTurnState,
  };
}
