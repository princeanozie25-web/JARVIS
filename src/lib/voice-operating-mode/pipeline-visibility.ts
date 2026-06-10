import type { VoiceAuthorityTier } from "./authority";
import type { VoiceConversationState } from "./conversation-state";

export type VoicePipelineSurface =
  | "/rest"
  | "/working"
  | "/audit"
  | "/audit/pipeline";
export type VoicePipelineEventKind =
  | "wake_event"
  | "conversation_active"
  | "t0_route"
  | "t1_request"
  | "t2_proposal"
  | "approval_pending";

export interface VoicePipelineEvent {
  readonly event_id: string;
  readonly kind: VoicePipelineEventKind;
  readonly state: VoiceConversationState;
  readonly tier: VoiceAuthorityTier;
  readonly label: string;
  readonly surfaces: readonly VoicePipelineSurface[];
  readonly metadata_only: true;
  readonly raw_audio_included: false;
  readonly transcript_included: false;
  readonly executable_payload_included: false;
}

export interface VoicePipelineVisibilityModel {
  readonly model_id: "phase22.voice.pipeline.visibility";
  readonly authoritative_surface: "/audit/pipeline";
  readonly events: readonly VoicePipelineEvent[];
  readonly surfaces: readonly VoicePipelineSurface[];
  readonly metadata_only: true;
  readonly read_only: true;
}

export function buildVoicePipelineVisibilityModel(): VoicePipelineVisibilityModel {
  const surfaces: readonly VoicePipelineSurface[] = [
    "/rest",
    "/working",
    "/audit",
    "/audit/pipeline",
  ];
  return {
    model_id: "phase22.voice.pipeline.visibility",
    authoritative_surface: "/audit/pipeline",
    surfaces,
    events: [
      event("voice-wake", "wake_event", "wake", "T0", "Wake event", surfaces),
      event(
        "voice-active",
        "conversation_active",
        "active",
        "T0",
        "Conversation active",
        surfaces,
      ),
      event(
        "voice-t0",
        "t0_route",
        "active",
        "T0",
        "T0 read-only route",
        surfaces,
      ),
      event(
        "voice-t1",
        "t1_request",
        "active",
        "T1",
        "T1 standing-consent request",
        surfaces,
      ),
      event(
        "voice-t2",
        "t2_proposal",
        "idle",
        "T2",
        "T2 proposal prepared",
        surfaces,
      ),
      event(
        "voice-approval",
        "approval_pending",
        "idle",
        "T2",
        "Approval pending",
        surfaces,
      ),
    ],
    metadata_only: true,
    read_only: true,
  };
}

function event(
  eventId: string,
  kind: VoicePipelineEventKind,
  state: VoiceConversationState,
  tier: VoiceAuthorityTier,
  label: string,
  surfaces: readonly VoicePipelineSurface[],
): VoicePipelineEvent {
  return {
    event_id: eventId,
    kind,
    state,
    tier,
    label,
    surfaces: [...surfaces],
    metadata_only: true,
    raw_audio_included: false,
    transcript_included: false,
    executable_payload_included: false,
  };
}
