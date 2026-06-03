import { z } from "zod";
import {
  TelegramBotConfigSchema,
  isTelegramSenderAuthorized,
  type TelegramBotConfig,
} from "./config";
import {
  TelegramMessageEnvelopeSchema,
  TelegramRawInboundMessageSchema,
  TelegramRouterInputSchema,
  buildTelegramRouterEnvelope,
  normalizeTelegramInboundMessage,
  type TelegramMessageEnvelope,
  type TelegramRouterInput,
} from "./transport";

export const TELEGRAM_INBOUND_ADAPTER_VERSION =
  "phase21d-r.telegram-inbound-adapter.v1" as const;

export const TELEGRAM_INBOUND_REJECTION_REASONS = [
  "missing_message",
  "non_text_message",
  "media_file_voice_or_image_forbidden",
  "group_or_channel_forbidden",
  "unauthorized_sender",
  "malformed_update",
] as const;

const TelegramBotUpdateSchema = z
  .object({
    update_id: z.union([z.string(), z.number().int()]).transform(String),
    message: z.unknown().optional(),
  })
  .passthrough();

export const TelegramInboundRejectionReasonSchema = z.enum(
  TELEGRAM_INBOUND_REJECTION_REASONS,
);

export const TelegramBotUpdateParseResultSchema = z.strictObject({
  adapter_version: z.literal(TELEGRAM_INBOUND_ADAPTER_VERSION),
  accepted: z.boolean(),
  update_id: z.string().trim().min(1).max(120).nullable(),
  message: TelegramRawInboundMessageSchema.nullable(),
  rejection_reasons: z.array(TelegramInboundRejectionReasonSchema),
  metadata_only: z.literal(true),
  raw_token_exposed: z.literal(false),
});

export const TelegramInboundAdapterResultSchema = z.strictObject({
  adapter_version: z.literal(TELEGRAM_INBOUND_ADAPTER_VERSION),
  accepted: z.boolean(),
  update_id: z.string().trim().min(1).max(120).nullable(),
  envelope: TelegramMessageEnvelopeSchema.nullable(),
  router_input: TelegramRouterInputSchema.nullable(),
  rejection_reasons: z.array(TelegramInboundRejectionReasonSchema),
  governance: z.strictObject({
    transport_only: z.literal(true),
    authorized_single_user: z.boolean(),
    direct_text_only: z.literal(true),
    media_supported: z.literal(false),
    group_channel_supported: z.literal(false),
    approval_authority: z.literal(false),
    action_execution_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    raw_token_exposed: z.literal(false),
    metadata_only: z.literal(true),
  }),
});

export type TelegramInboundRejectionReason = z.infer<
  typeof TelegramInboundRejectionReasonSchema
>;
export type TelegramBotUpdateParseResult = z.infer<
  typeof TelegramBotUpdateParseResultSchema
>;
export type TelegramInboundAdapterResult = z.infer<
  typeof TelegramInboundAdapterResultSchema
>;

export function parseTelegramBotUpdate(
  update: unknown,
): TelegramBotUpdateParseResult {
  const parsed = TelegramBotUpdateSchema.safeParse(update);
  if (!parsed.success) {
    return parseResult({
      accepted: false,
      update_id: null,
      message: null,
      rejection_reasons: ["malformed_update"],
    });
  }
  if (!parsed.data.message) {
    return parseResult({
      accepted: false,
      update_id: parsed.data.update_id,
      message: null,
      rejection_reasons: ["missing_message"],
    });
  }

  const messageRecord =
    parsed.data.message && typeof parsed.data.message === "object"
      ? (parsed.data.message as Record<string, unknown>)
      : null;
  const reasons = rejectionReasonsForMessage(messageRecord);
  const rawMessage = TelegramRawInboundMessageSchema.safeParse(
    parsed.data.message,
  );
  if (!rawMessage.success) {
    return parseResult({
      accepted: false,
      update_id: parsed.data.update_id,
      message: null,
      rejection_reasons: reasons.length ? reasons : ["malformed_update"],
    });
  }

  return parseResult({
    accepted: reasons.length === 0,
    update_id: parsed.data.update_id,
    message: reasons.length === 0 ? rawMessage.data : null,
    rejection_reasons: reasons,
  });
}

export function buildTelegramInboundAdapterResult(
  update: unknown,
  configInput: TelegramBotConfig,
): TelegramInboundAdapterResult {
  const config = TelegramBotConfigSchema.parse(configInput);
  const parsed = parseTelegramBotUpdate(update);
  const senderId = parsed.message?.from.id ?? null;
  const authorized =
    senderId !== null && isTelegramSenderAuthorized(config, senderId);
  const rejectionReasons = [...parsed.rejection_reasons];
  if (parsed.accepted && !authorized) {
    rejectionReasons.push("unauthorized_sender");
  }

  if (parsed.accepted && authorized && parsed.message) {
    const envelope = normalizeTelegramInboundMessage(parsed.message);
    const routerInput = buildTelegramRouterEnvelope(envelope);
    return adapterResult({
      accepted: true,
      update_id: parsed.update_id,
      envelope,
      router_input: routerInput,
      rejection_reasons: [],
      authorized_single_user: true,
    });
  }

  return adapterResult({
    accepted: false,
    update_id: parsed.update_id,
    envelope: null,
    router_input: null,
    rejection_reasons: rejectionReasons,
    authorized_single_user: false,
  });
}

export function routeTelegramUpdateToEnvelope(
  update: unknown,
  config: TelegramBotConfig,
): TelegramRouterInput {
  const result = buildTelegramInboundAdapterResult(update, config);
  if (!result.accepted || !result.router_input) {
    throw new Error(
      `Telegram update rejected: ${result.rejection_reasons.join(",")}`,
    );
  }
  return result.router_input;
}

function parseResult(input: {
  readonly accepted: boolean;
  readonly update_id: string | null;
  readonly message: z.infer<typeof TelegramRawInboundMessageSchema> | null;
  readonly rejection_reasons: readonly TelegramInboundRejectionReason[];
}): TelegramBotUpdateParseResult {
  return TelegramBotUpdateParseResultSchema.parse({
    adapter_version: TELEGRAM_INBOUND_ADAPTER_VERSION,
    accepted: input.accepted,
    update_id: input.update_id,
    message: input.message,
    rejection_reasons: [...new Set(input.rejection_reasons)],
    metadata_only: true,
    raw_token_exposed: false,
  });
}

function adapterResult(input: {
  readonly accepted: boolean;
  readonly update_id: string | null;
  readonly envelope: TelegramMessageEnvelope | null;
  readonly router_input: TelegramRouterInput | null;
  readonly rejection_reasons: readonly TelegramInboundRejectionReason[];
  readonly authorized_single_user: boolean;
}): TelegramInboundAdapterResult {
  return TelegramInboundAdapterResultSchema.parse({
    adapter_version: TELEGRAM_INBOUND_ADAPTER_VERSION,
    accepted: input.accepted,
    update_id: input.update_id,
    envelope: input.envelope,
    router_input: input.router_input,
    rejection_reasons: [...new Set(input.rejection_reasons)],
    governance: {
      transport_only: true,
      authorized_single_user: input.authorized_single_user,
      direct_text_only: true,
      media_supported: false,
      group_channel_supported: false,
      approval_authority: false,
      action_execution_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
      raw_token_exposed: false,
      metadata_only: true,
    },
  });
}

function rejectionReasonsForMessage(
  message: Record<string, unknown> | null,
): TelegramInboundRejectionReason[] {
  if (!message) return ["malformed_update"];
  const reasons: TelegramInboundRejectionReason[] = [];
  const chat = message.chat;
  const chatType =
    chat && typeof chat === "object"
      ? (chat as Record<string, unknown>).type
      : null;
  if (chatType !== "private") {
    reasons.push("group_or_channel_forbidden");
  }
  if (typeof message.text !== "string" || message.text.trim().length === 0) {
    reasons.push("non_text_message");
  }
  if (
    [
      "photo",
      "voice",
      "document",
      "video",
      "audio",
      "sticker",
      "animation",
    ].some((key) => key in message)
  ) {
    reasons.push("media_file_voice_or_image_forbidden");
  }
  return reasons;
}
