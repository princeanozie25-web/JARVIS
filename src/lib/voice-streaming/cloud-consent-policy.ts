import type {
  VoiceCloudConsentPolicyDecision,
  VoiceCloudConsentPolicyRecord,
  VoiceCloudConsentPolicyRequest,
  VoiceCloudConsentPolicyResult,
  VoiceCloudConsentState,
  VoiceCloudDisclosureState,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

export interface VoiceCloudConsentPolicyOptions {
  enabled?: boolean;
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

interface ConsentEvaluation {
  consentState: VoiceCloudConsentState;
  disclosureState: VoiceCloudDisclosureState;
  decision: VoiceCloudConsentPolicyDecision;
}

export class VoiceCloudConsentPolicy {
  constructor(private readonly opts: VoiceCloudConsentPolicyOptions = {}) {}

  async evaluate(
    request: VoiceCloudConsentPolicyRequest,
  ): Promise<VoiceCloudConsentPolicyResult> {
    const safeRequest = copyConsentPolicyRequest(request);
    const evaluation = this.evaluateConsent(safeRequest);
    const record: VoiceCloudConsentPolicyRecord = {
      id: this.newId(),
      requestId: safeRequest.id,
      sessionId: safeRequest.sessionId,
      providerId: safeRequest.providerId,
      requestedCapability: safeRequest.requestedCapability,
      consentState: evaluation.consentState,
      disclosureState: evaluation.disclosureState,
      decision: evaluation.decision,
      allowed: evaluation.decision === "allowed_metadata_only",
      consentGranted: safeRequest.consentGranted,
      costDisclosureAccepted: safeRequest.costDisclosureAccepted,
      providerRetentionDisclosureAccepted:
        safeRequest.providerRetentionDisclosureAccepted,
      audioLeavesDeviceDisclosureAccepted:
        safeRequest.audioLeavesDeviceDisclosureAccepted,
      transcriptLeavesDeviceDisclosureAccepted:
        safeRequest.transcriptLeavesDeviceDisclosureAccepted,
      createdAt: this.now(),
    };

    await this.emit(safeRequest, "voice_cloud_consent_evaluated", record, true);
    await this.emit(
      safeRequest,
      telemetryEventForDecision(record.decision),
      record,
      record.allowed,
    );
    return { request: safeRequest, record };
  }

  private evaluateConsent(
    request: VoiceCloudConsentPolicyRequest,
  ): ConsentEvaluation {
    if (this.opts.enabled !== true) {
      return {
        consentState: "disabled",
        disclosureState: "not_evaluated",
        decision: "denied_consent_missing",
      };
    }
    if (request.providerId === "disabled") {
      return {
        consentState: "provider_disabled",
        disclosureState: "provider_disabled",
        decision: "denied_provider_disabled",
      };
    }
    if (!request.consentGranted) {
      return {
        consentState: "consent_missing",
        disclosureState: "not_evaluated",
        decision: "denied_consent_missing",
      };
    }
    if (!request.costDisclosureAccepted) {
      return {
        consentState: "consent_granted_metadata_only",
        disclosureState: "cost_disclosure_missing",
        decision: "denied_cost_disclosure_missing",
      };
    }
    if (!request.providerRetentionDisclosureAccepted) {
      return {
        consentState: "consent_granted_metadata_only",
        disclosureState: "provider_retention_disclosure_missing",
        decision: "denied_retention_disclosure_missing",
      };
    }
    if (!request.audioLeavesDeviceDisclosureAccepted) {
      return {
        consentState: "consent_granted_metadata_only",
        disclosureState: "audio_leaves_device_disclosure_missing",
        decision: "denied_audio_disclosure_missing",
      };
    }
    if (!request.transcriptLeavesDeviceDisclosureAccepted) {
      return {
        consentState: "consent_granted_metadata_only",
        disclosureState: "transcript_leaves_device_disclosure_missing",
        decision: "denied_transcript_disclosure_missing",
      };
    }
    return {
      consentState: "consent_granted_metadata_only",
      disclosureState: "disclosures_complete_metadata_only",
      decision: "allowed_metadata_only",
    };
  }

  private async emit(
    request: VoiceCloudConsentPolicyRequest,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    record: VoiceCloudConsentPolicyRecord,
    success: boolean,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: request.sessionId,
      state: request.voiceTurnState ?? "waiting_for_send",
      success,
      cloudConsentPolicyRequestId: request.id,
      cloudConsentPolicyRecordId: record.id,
      cloudProviderId: request.providerId,
      cloudRequestedCapability: request.requestedCapability,
      cloudConsentState: record.consentState,
      cloudDisclosureState: record.disclosureState,
      cloudConsentDecision: record.decision,
      cloudConsentAllowed: record.allowed,
      cloudConsentGranted: request.consentGranted,
      cloudCostDisclosureAccepted: request.costDisclosureAccepted,
      cloudProviderRetentionDisclosureAccepted:
        request.providerRetentionDisclosureAccepted,
      cloudAudioLeavesDeviceDisclosureAccepted:
        request.audioLeavesDeviceDisclosureAccepted,
      cloudTranscriptLeavesDeviceDisclosureAccepted:
        request.transcriptLeavesDeviceDisclosureAccepted,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `cloud-consent-${this.now()}`;
  }
}

function telemetryEventForDecision(
  decision: VoiceCloudConsentPolicyDecision,
): VoiceOrchestrationTelemetryEvent["eventType"] {
  if (decision === "allowed_metadata_only") {
    return "voice_cloud_consent_allowed";
  }
  if (
    decision === "denied_cost_disclosure_missing" ||
    decision === "denied_retention_disclosure_missing" ||
    decision === "denied_audio_disclosure_missing" ||
    decision === "denied_transcript_disclosure_missing"
  ) {
    return "voice_cloud_consent_disclosure_missing";
  }
  return "voice_cloud_consent_denied";
}

function copyConsentPolicyRequest(
  request: VoiceCloudConsentPolicyRequest,
): VoiceCloudConsentPolicyRequest {
  return {
    id: request.id,
    sessionId: request.sessionId,
    providerId: request.providerId,
    requestedCapability: request.requestedCapability,
    consentGranted: request.consentGranted,
    costDisclosureAccepted: request.costDisclosureAccepted,
    providerRetentionDisclosureAccepted:
      request.providerRetentionDisclosureAccepted,
    audioLeavesDeviceDisclosureAccepted:
      request.audioLeavesDeviceDisclosureAccepted,
    transcriptLeavesDeviceDisclosureAccepted:
      request.transcriptLeavesDeviceDisclosureAccepted,
    createdAt: request.createdAt,
    voiceTurnState: request.voiceTurnState,
  };
}
