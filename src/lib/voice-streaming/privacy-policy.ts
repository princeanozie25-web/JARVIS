import { emitMetadataOnlyVoiceTelemetry } from "./telemetry-hygiene";
import type {
  VoiceOrchestrationTelemetryEvent,
  VoicePrivacyPolicyClassification,
  VoicePrivacyPolicyDecision,
  VoicePrivacyPolicyDescriptor,
  VoicePrivacyPolicyRecord,
  VoicePrivacyPolicyResult,
} from "./types";

export interface VoicePrivacyPolicyOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export class VoicePrivacyPolicy {
  constructor(private readonly opts: VoicePrivacyPolicyOptions = {}) {}

  async evaluate(
    descriptor: VoicePrivacyPolicyDescriptor,
  ): Promise<VoicePrivacyPolicyResult> {
    const safeDescriptor = copyPrivacyDescriptor(descriptor);
    const decision = decisionForClassification(safeDescriptor.classification);
    const record: VoicePrivacyPolicyRecord = {
      id: this.newId(),
      descriptorId: safeDescriptor.id,
      sessionId: safeDescriptor.sessionId,
      classification: safeDescriptor.classification,
      decision,
      allowed: decision === "allowed_metadata_only",
      createdAt: this.now(),
      turnId: safeDescriptor.turnId,
      sourceId: safeDescriptor.sourceId,
    };

    await this.emit(
      safeDescriptor,
      "voice_privacy_policy_evaluated",
      record,
      true,
    );
    await this.emit(
      safeDescriptor,
      telemetryEventForDecision(decision),
      record,
      record.allowed,
    );
    return { descriptor: safeDescriptor, record };
  }

  private async emit(
    descriptor: VoicePrivacyPolicyDescriptor,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    record: VoicePrivacyPolicyRecord,
    success: boolean,
  ): Promise<void> {
    await emitMetadataOnlyVoiceTelemetry(this.opts.emitTelemetry, {
      eventType,
      sessionId: descriptor.sessionId,
      state: descriptor.voiceTurnState ?? "waiting_for_send",
      success,
      turnId: descriptor.turnId,
      voicePrivacyDescriptorId: descriptor.id,
      voicePrivacyRecordId: record.id,
      voicePrivacyClassification: descriptor.classification,
      voicePrivacyDecision: record.decision,
      voicePrivacyAllowed: record.allowed,
      voicePrivacySourceId: descriptor.sourceId,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `voice-privacy-${this.now()}`;
  }
}

function decisionForClassification(
  classification: VoicePrivacyPolicyClassification,
): VoicePrivacyPolicyDecision {
  if (classification === "local_voice_metadata") {
    return "allowed_metadata_only";
  }
  if (classification === "raw_audio") return "denied_raw_audio_retention";
  if (classification === "transcript_text") {
    return "denied_transcript_upload";
  }
  if (classification === "assistant_speech_text") {
    return "denied_speech_text_retention";
  }
  if (
    classification === "synthesized_audio" ||
    classification === "audio_url"
  ) {
    return "denied_audio_upload";
  }
  if (classification === "cloud_voice_request") {
    return "denied_cloud_request";
  }
  return "denied_unknown_payload";
}

function telemetryEventForDecision(
  decision: VoicePrivacyPolicyDecision,
): VoiceOrchestrationTelemetryEvent["eventType"] {
  if (decision === "allowed_metadata_only") {
    return "voice_privacy_policy_allowed";
  }
  if (decision === "denied_unknown_payload") {
    return "voice_privacy_policy_unknown_payload";
  }
  return "voice_privacy_policy_denied";
}

function copyPrivacyDescriptor(
  descriptor: VoicePrivacyPolicyDescriptor,
): VoicePrivacyPolicyDescriptor {
  const classification = isKnownClassification(descriptor.classification)
    ? descriptor.classification
    : "unknown_payload";
  return {
    id: descriptor.id,
    sessionId: descriptor.sessionId,
    classification,
    createdAt: descriptor.createdAt,
    turnId: descriptor.turnId,
    sourceId: descriptor.sourceId,
    voiceTurnState: descriptor.voiceTurnState,
  };
}

function isKnownClassification(
  classification: VoicePrivacyPolicyClassification,
): boolean {
  return (
    classification === "raw_audio" ||
    classification === "transcript_text" ||
    classification === "assistant_speech_text" ||
    classification === "synthesized_audio" ||
    classification === "audio_url" ||
    classification === "cloud_voice_request" ||
    classification === "local_voice_metadata" ||
    classification === "unknown_payload"
  );
}
