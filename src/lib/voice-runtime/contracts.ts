import type {
  VoiceAudioBufferMetadata,
  VoiceAudioChunkMetadata,
  VoiceCancellationToken,
  VoiceProviderHealth,
  VoiceProviderKind,
  VoiceProviderRequestProvenance,
} from "./types";

export interface VoiceProvider {
  readonly id: string;
  readonly kind: VoiceProviderKind;
  readonly metadata_only: true;
  cancel(token: VoiceCancellationToken): Promise<void>;
  health(): Promise<VoiceProviderHealth>;
}

export interface VoiceSttTranscribeRequest {
  readonly request_id: string;
  readonly provider_id: string;
  readonly audio: VoiceAudioBufferMetadata;
  readonly timeout_ms: number;
  readonly abort_signal?: AbortSignal;
  readonly provenance: VoiceProviderRequestProvenance;
  readonly metadata_only: true;
}

export interface VoiceSttTranscribeResult {
  readonly request_id: string;
  readonly provider_id: string;
  readonly transcript: string;
  readonly language?: string;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface VoiceSttProvider extends VoiceProvider {
  readonly kind: "stt" | "mock";
  transcribe(
    request: VoiceSttTranscribeRequest,
  ): Promise<VoiceSttTranscribeResult>;
}

export interface VoiceTextSynthesisMetadata {
  readonly text_id: string;
  readonly character_count: number;
  readonly language?: string;
  readonly metadata_only: true;
}

export interface VoiceTtsSynthesizeRequest {
  readonly request_id: string;
  readonly provider_id: string;
  readonly text_metadata: VoiceTextSynthesisMetadata;
  readonly timeout_ms: number;
  readonly abort_signal?: AbortSignal;
  readonly provenance: VoiceProviderRequestProvenance;
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

export interface VoiceTtsProvider extends VoiceProvider {
  readonly kind: "tts" | "mock";
  synthesize(
    request: VoiceTtsSynthesizeRequest,
  ): Promise<VoiceTtsSynthesizeResult>;
}
