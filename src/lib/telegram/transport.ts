import { z } from "zod";

export const TELEGRAM_TRANSPORT_VERSION =
  "phase21d.telegram-transport.v1" as const;

export const TELEGRAM_SUPPORTED_MESSAGE_TYPES = ["text"] as const;

const BoundedIdSchema = z.string().trim().min(1).max(180);
const BoundedTextSchema = z.string().trim().min(1).max(4000);
const TelegramIdSchema = z
  .union([z.string(), z.number().int()])
  .transform(String);

export const TelegramConversationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .startsWith("telegram:direct:");

export const TelegramSenderSchema = z.strictObject({
  sender_id: BoundedIdSchema,
  username: z.string().trim().min(1).max(80).nullable().default(null),
  display_name: z.string().trim().min(1).max(120).nullable().default(null),
  is_bot: z.boolean().default(false),
});

export const TelegramChatSchema = z.strictObject({
  chat_id: BoundedIdSchema,
  chat_type: z.literal("private"),
  title: z.string().trim().min(1).max(120).nullable().default(null),
});

export const TelegramTransportMetadataSchema = z.strictObject({
  transport: z.literal("telegram"),
  transport_version: z.literal(TELEGRAM_TRANSPORT_VERSION),
  supported_message_type: z.enum(TELEGRAM_SUPPORTED_MESSAGE_TYPES),
  direct_message_only: z.literal(true),
  media_supported: z.literal(false),
  outbound_supported: z.literal(false),
  network_call_attempted: z.literal(false),
  authority: z.literal("transport_only"),
});

export const TelegramInboundMessageSchema = z.strictObject({
  message_id: BoundedIdSchema,
  conversation_id: TelegramConversationIdSchema,
  sender: TelegramSenderSchema,
  chat: TelegramChatSchema,
  timestamp: z.string().datetime(),
  content: BoundedTextSchema,
  content_type: z.enum(TELEGRAM_SUPPORTED_MESSAGE_TYPES),
  source_metadata: TelegramTransportMetadataSchema,
});

export const TelegramMessageEnvelopeSchema = z.strictObject({
  envelope_id: BoundedIdSchema,
  inbound_message: TelegramInboundMessageSchema,
  normalized_at: z.string().datetime(),
  malformed_payload_rejected: z.literal(false),
  unsupported_payload_rejected: z.literal(false),
  transport_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
});

export const TelegramRawSenderSchema = z
  .object({
    id: TelegramIdSchema,
    is_bot: z.boolean().optional(),
    username: z.string().trim().min(1).max(80).optional(),
    first_name: z.string().trim().min(1).max(80).optional(),
    last_name: z.string().trim().min(1).max(80).optional(),
  })
  .passthrough();

export const TelegramRawChatSchema = z
  .object({
    id: TelegramIdSchema,
    type: z.literal("private"),
    username: z.string().trim().min(1).max(80).optional(),
    first_name: z.string().trim().min(1).max(80).optional(),
    last_name: z.string().trim().min(1).max(80).optional(),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .passthrough();

export const TelegramRawInboundMessageSchema = z
  .object({
    message_id: z.number().int().positive(),
    date: z.number().int().nonnegative(),
    text: BoundedTextSchema,
    from: TelegramRawSenderSchema,
    chat: TelegramRawChatSchema,
  })
  .passthrough();

export const TelegramIntentEnvelopeSchema = z.strictObject({
  intent_envelope_id: BoundedIdSchema,
  source_envelope_id: BoundedIdSchema,
  transport: z.literal("telegram"),
  conversation_id: TelegramConversationIdSchema,
  input_kind: z.literal("user_text"),
  content: BoundedTextSchema,
  sender: TelegramSenderSchema,
  chat: TelegramChatSchema,
  received_at: z.string().datetime(),
  classification_path: z.literal("normal_user_text"),
  authority: z.literal("transport_only"),
  approval_bypass_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
});

export const TelegramTransportSummarySchema = z.strictObject({
  transport: z.literal("telegram"),
  conversation_id: TelegramConversationIdSchema,
  message_id: BoundedIdSchema,
  sender_id: BoundedIdSchema,
  chat_id: BoundedIdSchema,
  content_type: z.enum(TELEGRAM_SUPPORTED_MESSAGE_TYPES),
  content_length: z.number().int().nonnegative(),
  transport_only: z.literal(true),
  authority_elevated: z.literal(false),
});

export const TelegramRouterInputSchema = z.strictObject({
  router_input_id: BoundedIdSchema,
  message_envelope: TelegramMessageEnvelopeSchema,
  intent_envelope: TelegramIntentEnvelopeSchema,
  summary: TelegramTransportSummarySchema,
});

export const TelegramConversationStateSchema = z.strictObject({
  conversation_id: TelegramConversationIdSchema,
  sender_id: BoundedIdSchema,
  chat_id: BoundedIdSchema,
  message_count: z.number().int().nonnegative(),
  first_activity_at: z.string().datetime().nullable(),
  last_activity_at: z.string().datetime().nullable(),
  last_message_id: BoundedIdSchema.nullable(),
  content_character_count: z.number().int().nonnegative(),
  summary_metadata: z.strictObject({
    direct_message_only: z.literal(true),
    media_messages_seen: z.literal(0),
    outbound_messages_attempted: z.literal(0),
    memory_write_attempted: z.literal(false),
    persistence_attempted: z.literal(false),
  }),
});

export const TelegramConversationSummarySchema = z.strictObject({
  conversation_id: TelegramConversationIdSchema,
  message_count: z.number().int().nonnegative(),
  last_activity_at: z.string().datetime().nullable(),
  summary: z.string().trim().min(1).max(220),
  metadata_only: z.literal(true),
  memory_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
});

export const TelegramInletCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(TELEGRAM_TRANSPORT_VERSION),
  title: z.literal("Telegram inbound transport complete"),
  status: z.literal("transport_complete"),
  components: z.array(
    z.enum([
      "transport_contract",
      "message_normalization",
      "router_envelope",
      "conversation_state",
    ]),
  ),
  governance: z.strictObject({
    transport_only: z.literal(true),
    no_authority_elevation: z.literal(true),
    no_approval_execution: z.literal(true),
    no_provider_model_calls: z.literal(true),
    no_network_execution: z.literal(true),
    no_outbound_messaging: z.literal(true),
    no_telegram_writes: z.literal(true),
    no_auto_actions: z.literal(true),
    no_scheduler_integration: z.literal(true),
    no_memory_writes: z.literal(true),
    no_file_uploads: z.literal(true),
    no_media_processing: z.literal(true),
    no_new_authority_surface: z.literal(true),
  }),
  readme_safe_wording: z.array(z.string().trim().min(1).max(220)),
  future_work: z.array(z.string().trim().min(1).max(220)),
});

export type TelegramConversationId = z.infer<
  typeof TelegramConversationIdSchema
>;
export type TelegramSender = z.infer<typeof TelegramSenderSchema>;
export type TelegramChat = z.infer<typeof TelegramChatSchema>;
export type TelegramTransportMetadata = z.infer<
  typeof TelegramTransportMetadataSchema
>;
export type TelegramInboundMessage = z.infer<
  typeof TelegramInboundMessageSchema
>;
export type TelegramMessageEnvelope = z.infer<
  typeof TelegramMessageEnvelopeSchema
>;
export type TelegramRawInboundMessage = z.input<
  typeof TelegramRawInboundMessageSchema
>;
export type TelegramIntentEnvelope = z.infer<
  typeof TelegramIntentEnvelopeSchema
>;
export type TelegramTransportSummary = z.infer<
  typeof TelegramTransportSummarySchema
>;
export type TelegramRouterInput = z.infer<typeof TelegramRouterInputSchema>;
export type TelegramConversationState = z.infer<
  typeof TelegramConversationStateSchema
>;
export type TelegramConversationSummary = z.infer<
  typeof TelegramConversationSummarySchema
>;
export type TelegramInletCloseoutReport = z.infer<
  typeof TelegramInletCloseoutReportSchema
>;

export function validateTelegramInboundMessage(raw: unknown): boolean {
  return (
    TelegramRawInboundMessageSchema.safeParse(raw).success &&
    !hasUnsupportedPayload(raw)
  );
}

export function normalizeTelegramInboundMessage(
  raw: unknown,
): TelegramMessageEnvelope {
  const parsed = TelegramRawInboundMessageSchema.parse(raw);
  if (hasUnsupportedPayload(raw)) {
    throw new Error(
      "Unsupported Telegram payload: only direct 1:1 text messages are supported.",
    );
  }

  const timestamp = unixSecondsToIso(parsed.date);
  const sender = normalizeSender(parsed.from);
  const chat = normalizeChat(parsed.chat);
  const conversationId = buildConversationId(chat.chat_id, sender.sender_id);
  const messageId = String(parsed.message_id);

  return TelegramMessageEnvelopeSchema.parse({
    envelope_id: `telegram-envelope:${conversationId}:${messageId}`,
    inbound_message: {
      message_id: messageId,
      conversation_id: conversationId,
      sender,
      chat,
      timestamp,
      content: parsed.text,
      content_type: "text",
      source_metadata: buildTelegramTransportMetadata(),
    },
    normalized_at: timestamp,
    malformed_payload_rejected: false,
    unsupported_payload_rejected: false,
    transport_only: true,
    execution_attempted: false,
    write_attempted: false,
  });
}

export function buildTelegramRouterEnvelope(
  messageEnvelope: TelegramMessageEnvelope,
): TelegramRouterInput {
  const parsed = TelegramMessageEnvelopeSchema.parse(messageEnvelope);
  const message = parsed.inbound_message;
  const intentEnvelope = TelegramIntentEnvelopeSchema.parse({
    intent_envelope_id: `telegram-intent:${message.conversation_id}:${message.message_id}`,
    source_envelope_id: parsed.envelope_id,
    transport: "telegram",
    conversation_id: message.conversation_id,
    input_kind: "user_text",
    content: message.content,
    sender: message.sender,
    chat: message.chat,
    received_at: message.timestamp,
    classification_path: "normal_user_text",
    authority: "transport_only",
    approval_bypass_attempted: false,
    execution_attempted: false,
    provider_call_attempted: false,
    network_call_attempted: false,
  });
  const summary = TelegramTransportSummarySchema.parse({
    transport: "telegram",
    conversation_id: message.conversation_id,
    message_id: message.message_id,
    sender_id: message.sender.sender_id,
    chat_id: message.chat.chat_id,
    content_type: message.content_type,
    content_length: message.content.length,
    transport_only: true,
    authority_elevated: false,
  });

  return TelegramRouterInputSchema.parse({
    router_input_id: `telegram-router:${message.conversation_id}:${message.message_id}`,
    message_envelope: parsed,
    intent_envelope: intentEnvelope,
    summary,
  });
}

export function buildTelegramConversationState(
  envelopes: readonly TelegramMessageEnvelope[],
): TelegramConversationState {
  const messages = envelopes
    .map(
      (envelope) =>
        TelegramMessageEnvelopeSchema.parse(envelope).inbound_message,
    )
    .sort((left, right) => {
      const timeOrder = left.timestamp.localeCompare(right.timestamp);
      if (timeOrder !== 0) return timeOrder;
      return left.message_id.localeCompare(right.message_id);
    });
  const first = messages[0] ?? null;
  const last = messages[messages.length - 1] ?? null;

  return TelegramConversationStateSchema.parse({
    conversation_id: first?.conversation_id ?? "telegram:direct:empty:empty",
    sender_id: first?.sender.sender_id ?? "empty",
    chat_id: first?.chat.chat_id ?? "empty",
    message_count: messages.length,
    first_activity_at: first?.timestamp ?? null,
    last_activity_at: last?.timestamp ?? null,
    last_message_id: last?.message_id ?? null,
    content_character_count: messages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    ),
    summary_metadata: {
      direct_message_only: true,
      media_messages_seen: 0,
      outbound_messages_attempted: 0,
      memory_write_attempted: false,
      persistence_attempted: false,
    },
  });
}

export function summarizeTelegramConversation(
  state: TelegramConversationState,
): TelegramConversationSummary {
  const parsed = TelegramConversationStateSchema.parse(state);
  return TelegramConversationSummarySchema.parse({
    conversation_id: parsed.conversation_id,
    message_count: parsed.message_count,
    last_activity_at: parsed.last_activity_at,
    summary: `Telegram direct text conversation with ${parsed.message_count} normalized message(s).`,
    metadata_only: true,
    memory_write_attempted: false,
    database_write_attempted: false,
  });
}

export function buildTelegramInletCloseoutReport(): TelegramInletCloseoutReport {
  return TelegramInletCloseoutReportSchema.parse({
    closeout_version: TELEGRAM_TRANSPORT_VERSION,
    title: "Telegram inbound transport complete",
    status: "transport_complete",
    components: [
      "transport_contract",
      "message_normalization",
      "router_envelope",
      "conversation_state",
    ],
    governance: {
      transport_only: true,
      no_authority_elevation: true,
      no_approval_execution: true,
      no_provider_model_calls: true,
      no_network_execution: true,
      no_outbound_messaging: true,
      no_telegram_writes: true,
      no_auto_actions: true,
      no_scheduler_integration: true,
      no_memory_writes: true,
      no_file_uploads: true,
      no_media_processing: true,
      no_new_authority_surface: true,
    },
    readme_safe_wording: [
      "Telegram inbound transport complete.",
      "It normalizes direct text messages into router envelopes without adding authority.",
      "Outbound messaging, media handling, voice, files, mobile workflows, and approval actions remain future work.",
    ],
    future_work: [
      "Telegram API connection and bot token handling remain future work.",
      "Outbound messaging remains future work.",
      "Media, voice, file, group, and channel handling remain future work.",
      "Approval actions and agent execution over Telegram remain future work.",
    ],
  });
}

function buildTelegramTransportMetadata(): TelegramTransportMetadata {
  return TelegramTransportMetadataSchema.parse({
    transport: "telegram",
    transport_version: TELEGRAM_TRANSPORT_VERSION,
    supported_message_type: "text",
    direct_message_only: true,
    media_supported: false,
    outbound_supported: false,
    network_call_attempted: false,
    authority: "transport_only",
  });
}

function normalizeSender(
  rawSender: z.infer<typeof TelegramRawSenderSchema>,
): TelegramSender {
  const displayName = [rawSender.first_name, rawSender.last_name]
    .filter(Boolean)
    .join(" ");
  return TelegramSenderSchema.parse({
    sender_id: rawSender.id,
    username: rawSender.username ?? null,
    display_name: displayName || rawSender.username || null,
    is_bot: rawSender.is_bot ?? false,
  });
}

function normalizeChat(
  rawChat: z.infer<typeof TelegramRawChatSchema>,
): TelegramChat {
  const title =
    rawChat.title ??
    [rawChat.first_name, rawChat.last_name].filter(Boolean).join(" ") ??
    rawChat.username ??
    null;
  return TelegramChatSchema.parse({
    chat_id: rawChat.id,
    chat_type: "private",
    title: title || null,
  });
}

function buildConversationId(
  chatId: string,
  senderId: string,
): TelegramConversationId {
  return TelegramConversationIdSchema.parse(
    `telegram:direct:${chatId}:${senderId}`,
  );
}

function unixSecondsToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function hasUnsupportedPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const record = raw as Record<string, unknown>;
  return [
    "photo",
    "voice",
    "document",
    "video",
    "audio",
    "sticker",
    "caption",
  ].some((key) => key in record);
}
