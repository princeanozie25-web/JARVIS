import type {
  TranscriptionResult,
  VoiceTranscriptChatPayload,
  VoiceTranscriptDraft,
  VoiceTranscriptDraftTelemetryEvent,
} from "./types";

export interface VoiceTranscriptDraftManagerOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceTranscriptDraftTelemetryEvent,
  ) => void | Promise<void>;
}

export interface CreateVoiceTranscriptDraftInput {
  result: TranscriptionResult;
  sourceJobId: string;
}

export class InMemoryVoiceTranscriptDraftManager {
  private draft: VoiceTranscriptDraft | null = null;

  constructor(private readonly opts: VoiceTranscriptDraftManagerOptions = {}) {}

  async createDraft(
    input: CreateVoiceTranscriptDraftInput,
  ): Promise<VoiceTranscriptDraft | null> {
    if (input.result.status !== "completed") {
      await this.emit({
        eventType: "transcript_draft_rejected",
        sourceJobId: input.sourceJobId,
        success: false,
        reason: "not_completed",
      });
      return null;
    }

    const text = input.result.text.trim();
    if (!text) {
      await this.emit({
        eventType: "transcript_draft_rejected",
        sourceJobId: input.sourceJobId,
        success: false,
        reason: "empty_transcript",
      });
      return null;
    }

    const draft: VoiceTranscriptDraft = {
      id: this.newId(),
      text,
      sourceJobId: input.sourceJobId,
      createdAt: this.now(),
      confidence: input.result.confidence,
      language: input.result.language,
      status: "draft",
    };
    this.draft = draft;
    await this.emit({
      eventType: "transcript_draft_created",
      draftId: draft.id,
      sourceJobId: draft.sourceJobId,
      status: draft.status,
      success: true,
    });
    return { ...draft };
  }

  async editDraft(text: string): Promise<VoiceTranscriptDraft | null> {
    if (!this.draft || this.draft.status !== "draft") return null;
    this.draft = {
      ...this.draft,
      text,
    };
    return { ...this.draft };
  }

  async discardDraft(): Promise<VoiceTranscriptDraft | null> {
    if (!this.draft) {
      await this.emit({
        eventType: "transcript_draft_rejected",
        success: false,
        reason: "no_active_draft",
      });
      return null;
    }

    const discarded: VoiceTranscriptDraft = {
      ...this.draft,
      status: "discarded",
    };
    this.draft = null;
    await this.emit({
      eventType: "transcript_draft_discarded",
      draftId: discarded.id,
      sourceJobId: discarded.sourceJobId,
      status: discarded.status,
      success: true,
    });
    return discarded;
  }

  async submitDraft(): Promise<VoiceTranscriptChatPayload | null> {
    if (!this.draft || this.draft.status !== "draft") {
      await this.emit({
        eventType: "transcript_draft_rejected",
        success: false,
        reason: "no_active_draft",
      });
      return null;
    }

    const submitted: VoiceTranscriptDraft = {
      ...this.draft,
      status: "submitted",
    };
    this.draft = null;
    await this.emit({
      eventType: "transcript_draft_submitted",
      draftId: submitted.id,
      sourceJobId: submitted.sourceJobId,
      status: submitted.status,
      success: true,
    });
    return {
      target: "chat_input",
      source: "voice",
      text: submitted.text,
      sourceDraftId: submitted.id,
      sourceJobId: submitted.sourceJobId,
      canApproveRuntimeActions: false,
    };
  }

  getDraft(): VoiceTranscriptDraft | null {
    return this.draft ? { ...this.draft } : null;
  }

  hasDraft(): boolean {
    return this.draft?.status === "draft";
  }

  private async emit(event: VoiceTranscriptDraftTelemetryEvent): Promise<void> {
    await this.opts.emitTelemetry?.(event);
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}
