import type { VoiceOrchestrationTelemetryEvent } from "./types";

export const VOICE_TELEMETRY_ALLOWED_KEY_LIST = [
  "eventType",
  "sessionId",
  "state",
  "success",
  "pipelineStage",
  "terminalAction",
  "failureClass",
  "failureReason",
  "readinessState",
  "previousReadinessState",
  "latencyStage",
  "bargeInIntentId",
  "bargeInIntentCategory",
  "bargeInAction",
  "bargeInRejectionReason",
  "bargeInState",
  "previousBargeInState",
  "nextBargeInState",
  "preemptionRecordId",
  "turnId",
  "interruptedAt",
  "lastReadyChunkIndex",
  "lastSequencedChunkIndex",
  "pendingChunkCount",
  "preemptionReason",
  "captureRearmIntentId",
  "captureRearmResultId",
  "captureRearmState",
  "previousCaptureRearmState",
  "nextCaptureRearmState",
  "captureRearmBlockedReason",
  "runtimeBoundaryEventId",
  "runtimeBoundaryEventType",
  "runtimeBoundaryAdvisoryId",
  "runtimeBoundaryAction",
  "runtimeBoundaryState",
  "previousRuntimeBoundaryState",
  "nextRuntimeBoundaryState",
  "runtimeBoundaryReason",
  "runtimeBoundaryOperationId",
  "runtimeBoundaryOrderingIssue",
  "voiceApprovalAttemptCategory",
  "voiceApprovalRefusalId",
  "voiceApprovalRefusalAction",
  "runtimeCallId",
  "toolName",
  "restrictedContentDescriptorId",
  "restrictedContentDecisionRecordId",
  "restrictedContentClassification",
  "restrictedContentDecision",
  "contentRefId",
  "restrictedContentSourceId",
  "cloudRoutingRequestId",
  "cloudRoutingPolicyRecordId",
  "cloudProviderId",
  "cloudRequestedCapability",
  "cloudRoutingPolicyState",
  "cloudRoutingDecision",
  "cloudRoutingDenialReason",
  "cloudRoutingAllowed",
  "cloudConsentGranted",
  "cloudCostDisclosureAccepted",
  "cloudBudgetAvailable",
  "cloudLocalFallbackAvailable",
  "cloudBudgetRequestId",
  "cloudBudgetRecordId",
  "cloudBudgetDecision",
  "cloudBudgetAllowed",
  "cloudEstimatedMinutes",
  "cloudEstimatedCostUnits",
  "cloudRequestCount",
  "cloudConfiguredLimitCount",
  "cloudBudgetWindow",
  "cloudBudgetDimension",
  "cloudBudgetLimit",
  "cloudProjectedUsage",
  "cloudConsentPolicyRequestId",
  "cloudConsentPolicyRecordId",
  "cloudConsentState",
  "cloudDisclosureState",
  "cloudConsentDecision",
  "cloudConsentAllowed",
  "cloudProviderRetentionDisclosureAccepted",
  "cloudAudioLeavesDeviceDisclosureAccepted",
  "cloudTranscriptLeavesDeviceDisclosureAccepted",
  "voicePrivacyDescriptorId",
  "voicePrivacyRecordId",
  "voicePrivacyClassification",
  "voicePrivacyDecision",
  "voicePrivacyAllowed",
  "voicePrivacySourceId",
  "orderingIssue",
  "streamId",
  "responseId",
  "chunkId",
  "intentId",
  "queueItemId",
  "playbackIntentId",
  "chunkIndex",
  "expectedChunkIndex",
  "pendingIntentCount",
  "clearedIntentCount",
  "maxPendingIntents",
  "pendingSynthesisItemCount",
  "clearedSynthesisItemCount",
  "maxPendingSynthesisItems",
  "pendingPlaybackIntentCount",
  "clearedPlaybackIntentCount",
  "maxPendingPlaybackIntents",
  "scheduledAt",
  "queuedAt",
  "synthesizedAt",
  "readyToPlayAt",
  "blockedAt",
  "terminalAt",
  "stageStartedAt",
  "stageCompletedAt",
  "latencyMs",
  "readinessTimeoutMs",
  "starvationAgeMs",
  "firstReady",
  "durationMs",
  "error",
] as const;

export type VoiceTelemetryAllowedKey =
  (typeof VOICE_TELEMETRY_ALLOWED_KEY_LIST)[number];

export const VOICE_TELEMETRY_ALLOWED_KEYS: ReadonlySet<string> = new Set(
  VOICE_TELEMETRY_ALLOWED_KEY_LIST,
);

export const VOICE_TELEMETRY_FORBIDDEN_KEY_LIST = [
  "transcript",
  "transcriptText",
  "spokenText",
  "assistantText",
  "assistantBody",
  "toolOutput",
  "fileContent",
  "code",
  "codeBlock",
  "personalContext",
  "auditLog",
  "approvalPayload",
  "approvalRequestId",
  "apiKey",
  "providerSecret",
  "requestPayload",
  "rawAudio",
  "audioData",
  "audioBlob",
  "audioUrl",
  "pcm",
] as const;

const FORBIDDEN_KEYS = new Set<string>(
  VOICE_TELEMETRY_FORBIDDEN_KEY_LIST.map(normalizeTelemetryKey),
);

const SAFE_METADATA_STRING = /^[A-Za-z0-9_.:/@-]{1,256}$/;
const REDACTED_METADATA_VALUE = "redacted_metadata_only";

export interface VoiceTelemetryHygieneResult {
  event: Partial<VoiceOrchestrationTelemetryEvent>;
  removedKeys: string[];
  redactedKeys: string[];
}

export async function emitMetadataOnlyVoiceTelemetry(
  emitTelemetry:
    | ((event: VoiceOrchestrationTelemetryEvent) => void | Promise<void>)
    | undefined,
  event: VoiceOrchestrationTelemetryEvent,
): Promise<VoiceTelemetryHygieneResult> {
  const result = sanitizeVoiceTelemetryEvent(event);
  await emitTelemetry?.(result.event as VoiceOrchestrationTelemetryEvent);
  return result;
}

export function sanitizeVoiceTelemetryEvent(
  event: object,
): VoiceTelemetryHygieneResult {
  const sanitized: Record<string, unknown> = {};
  const removedKeys: string[] = [];
  const redactedKeys: string[] = [];

  for (const [key, value] of Object.entries(event)) {
    if (
      isForbiddenTelemetryKey(key) ||
      !VOICE_TELEMETRY_ALLOWED_KEYS.has(key)
    ) {
      removedKeys.push(key);
      collectNestedForbiddenKeys(value, key, removedKeys);
      continue;
    }

    const scalar = sanitizeTelemetryScalar(value);
    if (scalar === undefined) {
      if (value !== undefined) {
        removedKeys.push(key);
        collectNestedForbiddenKeys(value, key, removedKeys);
      }
      continue;
    }
    if (scalar === REDACTED_METADATA_VALUE && scalar !== value) {
      redactedKeys.push(key);
    }
    sanitized[key] = scalar;
  }

  return {
    event: sanitized as Partial<VoiceOrchestrationTelemetryEvent>,
    removedKeys: uniqueInOrder(removedKeys),
    redactedKeys: uniqueInOrder(redactedKeys),
  };
}

function sanitizeTelemetryScalar(
  value: unknown,
): string | number | boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    return SAFE_METADATA_STRING.test(value) ? value : REDACTED_METADATA_VALUE;
  }
  return undefined;
}

function collectNestedForbiddenKeys(
  value: unknown,
  path: string,
  removedKeys: string[],
): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectNestedForbiddenKeys(item, `${path}.${index}`, removedKeys);
    });
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (isForbiddenTelemetryKey(key)) {
      removedKeys.push(nestedPath);
    }
    collectNestedForbiddenKeys(nested, nestedPath, removedKeys);
  }
}

function isForbiddenTelemetryKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(normalizeTelemetryKey(key));
}

function normalizeTelemetryKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function uniqueInOrder(values: string[]): string[] {
  return Array.from(new Set(values));
}
