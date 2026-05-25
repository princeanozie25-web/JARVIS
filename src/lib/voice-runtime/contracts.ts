import type {
  VoiceAudioBufferMetadata,
  VoiceAudioChunkMetadata,
  VoiceCancellationToken,
  VoiceProviderHealth,
  VoiceProviderRequestProvenance,
} from "./types";

export interface VoiceSttTranscribeRequest {
  readonly request_id: string;
  readonly provider_id: string;
  readonly audio: VoiceAudioBufferMetadata;
  readonly abort_signal?: AbortSignal;
  readonly timeout_ms: number;
  readonly provenance: VoiceProviderRequestProvenance;
  readonly metadata_only: true;
}

export interface VoiceSttTranscribeResult {
  readonly request_id: string;
  readonly provider_id: string;
  readonly transcript: string;
  readonly language: string | null;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface VoiceTtsSynthesizeRequest {
  readonly request_id: string;
  readonly provider_id: string;
  readonly text_metadata: VoiceTextSynthesisMetadata;
  readonly abort_signal?: AbortSignal;
  readonly timeout_ms: number;
  readonly provenance: VoiceProviderRequestProvenance;
  readonly metadata_only: true;
}

export interface VoiceTextSynthesisMetadata {
  readonly text_id: string;
  readonly character_count: number;
  readonly language?: string;
  readonly metadata_only: true;
}

export interface VoiceTtsSynthesizeResult {
  readonly request_id: string;
  readonly provider_id: string;
  readonly audio: VoiceAudioChunkMetadata;
  readonly duration_ms: number;
  readonly chunk_id: string;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface VoiceSttProvider {
  readonly id: string;
  readonly kind: "stt";
  readonly metadata_only: true;
  transcribe(
    request: VoiceSttTranscribeRequest,
  ): Promise<VoiceSttTranscribeResult>;
  cancel(token: VoiceCancellationToken): Promise<void>;
  health(): Promise<VoiceProviderHealth>;
}

export interface VoiceTtsProvider {
  readonly id: string;
  readonly kind: "tts";
  readonly metadata_only: true;
  synthesize(
    request: VoiceTtsSynthesizeRequest,
  ): Promise<VoiceTtsSynthesizeResult>;
  cancel(token: VoiceCancellationToken): Promise<void>;
  health(): Promise<VoiceProviderHealth>;
}

export type VoiceProvider = VoiceSttProvider | VoiceTtsProvider;
