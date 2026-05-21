import { emitMetadataOnlyVoiceTelemetry } from "./telemetry-hygiene";
import type {
  VoiceOrchestrationTelemetryEvent,
  VoiceRestrictedContentBoundaryResult,
  VoiceRestrictedContentDecision,
  VoiceRestrictedContentDecisionRecord,
  VoiceRestrictedContentDescriptor,
} from "./types";

export interface VoiceRestrictedContentBoundaryOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export class VoiceRestrictedContentBoundary {
  private readonly decisionByDescriptorId = new Map<
    string,
    VoiceRestrictedContentDecisionRecord
  >();

  constructor(private readonly opts: VoiceRestrictedContentBoundaryOptions) {}

  async evaluateDescriptor(
    descriptor: VoiceRestrictedContentDescriptor,
  ): Promise<VoiceRestrictedContentBoundaryResult> {
    const safeDescriptor = copyRestrictedContentDescriptor(descriptor);
    await this.emit(
      safeDescriptor,
      "voice_restricted_content_descriptor_received",
      true,
    );

    const existing = this.decisionByDescriptorId.get(safeDescriptor.id);
    if (existing) {
      const noop = this.createDecisionRecord(safeDescriptor, "no_op");
      await this.emitDecision(
        safeDescriptor,
        noop,
        "voice_restricted_content_noop",
        true,
      );
      return { descriptor: safeDescriptor, record: noop };
    }

    if (safeDescriptor.terminal === true) {
      const noop = this.createDecisionRecord(safeDescriptor, "no_op");
      await this.emitDecision(
        safeDescriptor,
        noop,
        "voice_restricted_content_noop",
        true,
      );
      return { descriptor: safeDescriptor, record: noop };
    }

    const decision = decisionForDescriptor(safeDescriptor);
    const record = this.createDecisionRecord(safeDescriptor, decision);
    this.decisionByDescriptorId.set(safeDescriptor.id, record);
    await this.emitDecision(
      safeDescriptor,
      record,
      decision === "allowed_for_speech_metadata"
        ? "voice_restricted_content_allowed"
        : "voice_restricted_content_blocked",
      decision === "allowed_for_speech_metadata",
    );
    return { descriptor: safeDescriptor, record };
  }

  getDecisions(sessionId?: string): VoiceRestrictedContentDecisionRecord[] {
    return Array.from(this.decisionByDescriptorId.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyDecisionRecord);
  }

  private createDecisionRecord(
    descriptor: VoiceRestrictedContentDescriptor,
    decision: VoiceRestrictedContentDecision,
  ): VoiceRestrictedContentDecisionRecord {
    return {
      id: this.newId(),
      descriptorId: descriptor.id,
      sessionId: descriptor.sessionId,
      classification: descriptor.classification,
      decision,
      createdAt: this.now(),
      turnId: descriptor.turnId,
      contentRefId: descriptor.contentRefId,
      sourceId: descriptor.sourceId,
    };
  }

  private async emitDecision(
    descriptor: VoiceRestrictedContentDescriptor,
    record: VoiceRestrictedContentDecisionRecord,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
  ): Promise<void> {
    await this.emit(descriptor, eventType, success, {
      restrictedContentDecisionRecordId: record.id,
      restrictedContentDecision: record.decision,
    });
  }

  private async emit(
    descriptor: VoiceRestrictedContentDescriptor,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
  ): Promise<void> {
    await emitMetadataOnlyVoiceTelemetry(this.opts.emitTelemetry, {
      eventType,
      sessionId: descriptor.sessionId,
      state: descriptor.voiceTurnState ?? "waiting_for_send",
      success,
      turnId: descriptor.turnId,
      restrictedContentDescriptorId: descriptor.id,
      restrictedContentClassification: descriptor.classification,
      contentRefId: descriptor.contentRefId,
      restrictedContentSourceId: descriptor.sourceId,
      ...fields,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `restricted-content-${this.now()}`;
  }
}

function decisionForDescriptor(
  descriptor: VoiceRestrictedContentDescriptor,
): VoiceRestrictedContentDecision {
  if (descriptor.classification === "assistant_prose_metadata") {
    return "allowed_for_speech_metadata";
  }
  return "blocked_from_speech";
}

function copyRestrictedContentDescriptor(
  descriptor: VoiceRestrictedContentDescriptor,
): VoiceRestrictedContentDescriptor {
  return {
    id: descriptor.id,
    sessionId: descriptor.sessionId,
    classification: descriptor.classification,
    createdAt: descriptor.createdAt,
    turnId: descriptor.turnId,
    contentRefId: descriptor.contentRefId,
    sourceId: descriptor.sourceId,
    terminal: descriptor.terminal,
    voiceTurnState: descriptor.voiceTurnState,
  };
}

function copyDecisionRecord(
  record: VoiceRestrictedContentDecisionRecord,
): VoiceRestrictedContentDecisionRecord {
  return { ...record };
}
