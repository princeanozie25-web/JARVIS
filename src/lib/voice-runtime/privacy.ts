export const VOICE_PRIVACY_CONTENT_CLASSES = [
  "assistant_prose",
  "tool_output",
  "code_block",
  "approval_prompt",
  "personal_context",
  "file_content",
  "error_stack",
  "audit_log",
  "transcript",
] as const;

export const VOICE_PRIVACY_SPEAKABLE_CONTENT_CLASSES = [
  "assistant_prose",
] as const;

export const VOICE_PRIVACY_DENIAL_REASONS = [
  "unknown_content_class",
  "tool_output_blocked",
  "code_block_blocked",
  "approval_prompt_blocked",
  "personal_context_blocked",
  "file_content_blocked",
  "error_stack_blocked",
  "audit_log_blocked",
  "transcript_blocked",
] as const;

export type VoicePrivacyContentClass =
  (typeof VOICE_PRIVACY_CONTENT_CLASSES)[number];
export type VoicePrivacyDenialReason =
  (typeof VOICE_PRIVACY_DENIAL_REASONS)[number];

export type VoicePrivacyDecision =
  | {
      readonly allowed: true;
      readonly content_class: "assistant_prose";
      readonly reason: null;
      readonly redaction_status: "metadata_only";
    }
  | {
      readonly allowed: false;
      readonly content_class: Exclude<
        VoicePrivacyContentClass,
        "assistant_prose"
      > | null;
      readonly reason: VoicePrivacyDenialReason;
      readonly redaction_status: "withheld";
    };

export function classifyVoiceContentPrivacy(
  contentClass: unknown,
): VoicePrivacyDecision {
  if (!isVoicePrivacyContentClass(contentClass)) {
    return deny(null, "unknown_content_class");
  }
  if (contentClass === "assistant_prose") {
    return {
      allowed: true,
      content_class: "assistant_prose",
      reason: null,
      redaction_status: "metadata_only",
    };
  }
  return deny(contentClass, reasonFor(contentClass));
}

export function isVoiceContentSpeakableByDefault(
  contentClass: unknown,
): contentClass is "assistant_prose" {
  return classifyVoiceContentPrivacy(contentClass).allowed;
}

export function assertVoiceContentSpeakableByDefault(
  contentClass: unknown,
): VoicePrivacyDecision {
  const decision = classifyVoiceContentPrivacy(contentClass);
  if (!decision.allowed) {
    throw new TypeError(`Unsafe voice content class: ${decision.reason}`);
  }
  return decision;
}

function isVoicePrivacyContentClass(
  value: unknown,
): value is VoicePrivacyContentClass {
  return (
    typeof value === "string" &&
    (VOICE_PRIVACY_CONTENT_CLASSES as readonly string[]).includes(value)
  );
}

function reasonFor(
  contentClass: Exclude<VoicePrivacyContentClass, "assistant_prose">,
): VoicePrivacyDenialReason {
  switch (contentClass) {
    case "tool_output":
      return "tool_output_blocked";
    case "code_block":
      return "code_block_blocked";
    case "approval_prompt":
      return "approval_prompt_blocked";
    case "personal_context":
      return "personal_context_blocked";
    case "file_content":
      return "file_content_blocked";
    case "error_stack":
      return "error_stack_blocked";
    case "audit_log":
      return "audit_log_blocked";
    case "transcript":
      return "transcript_blocked";
  }
}

function deny(
  contentClass: Exclude<VoicePrivacyContentClass, "assistant_prose"> | null,
  reason: VoicePrivacyDenialReason,
): VoicePrivacyDecision {
  return {
    allowed: false,
    content_class: contentClass,
    reason,
    redaction_status: "withheld",
  };
}
