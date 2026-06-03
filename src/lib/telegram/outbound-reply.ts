import { z } from "zod";
import { TELEGRAM_TRANSPORT_VERSION } from "./transport";

export const TELEGRAM_OUTBOUND_REPLY_VERSION =
  "phase21d-r.telegram-outbound-reply.v1" as const;

export const TELEGRAM_REPLY_SEND_STATUSES = [
  "dry_run",
  "sent",
  "rejected",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(180);
const ReplyTextSchema = z.string().trim().min(1).max(4000);

export const TelegramReplySendStatusSchema = z.enum(
  TELEGRAM_REPLY_SEND_STATUSES,
);

export const TelegramReplyPlanSchema = z.strictObject({
  reply_version: z.literal(TELEGRAM_OUTBOUND_REPLY_VERSION),
  transport_version: z.literal(TELEGRAM_TRANSPORT_VERSION),
  plan_id: BoundedIdSchema,
  chat_id: BoundedIdSchema,
  reply_to_message_id: BoundedIdSchema,
  correlation_id: BoundedIdSchema,
  reply_text: ReplyTextSchema,
  chat_type: z.literal("private"),
  dry_run_default: z.literal(true),
  media_send_supported: z.literal(false),
  file_send_supported: z.literal(false),
  approval_authority: z.literal(false),
  action_execution_supported: z.literal(false),
  metadata_only: z.literal(true),
});

export const TelegramReplyGovernanceSchema = z.strictObject({
  transport_only: z.literal(true),
  dry_run_default: z.literal(true),
  direct_private_chat_only: z.literal(true),
  approval_authority: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  action_execution_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  media_send_attempted: z.literal(false),
  file_send_attempted: z.literal(false),
  group_reply_attempted: z.literal(false),
  raw_token_exposed: z.literal(false),
  metadata_only: z.literal(true),
});

export const TelegramReplySendResultSchema = z.strictObject({
  reply_version: z.literal(TELEGRAM_OUTBOUND_REPLY_VERSION),
  status: TelegramReplySendStatusSchema,
  sent: z.boolean(),
  plan_id: BoundedIdSchema,
  adapter_id: BoundedIdSchema,
  chat_id: BoundedIdSchema,
  reply_to_message_id: BoundedIdSchema,
  correlation_id: BoundedIdSchema,
  provider_message_id: BoundedIdSchema.nullable(),
  reasons: z.array(z.string().trim().min(1).max(180)),
  governance: TelegramReplyGovernanceSchema,
  metadata_only: z.literal(true),
  raw_token_exposed: z.literal(false),
});

export type TelegramReplyPlan = z.infer<typeof TelegramReplyPlanSchema>;
export type TelegramReplySendStatus = z.infer<
  typeof TelegramReplySendStatusSchema
>;
export type TelegramReplyGovernance = z.infer<
  typeof TelegramReplyGovernanceSchema
>;
export type TelegramReplySendResult = z.infer<
  typeof TelegramReplySendResultSchema
>;

export interface TelegramSenderAdapter {
  readonly adapter_id: string;
  sendReply(
    plan: TelegramReplyPlan,
  ): TelegramReplySendResult | Promise<TelegramReplySendResult>;
}

export function buildTelegramReplyPlan(input: {
  readonly chat_id: string | number;
  readonly reply_to_message_id: string | number;
  readonly correlation_id: string;
  readonly reply_text: string;
  readonly chat_type?: "private" | "group" | "channel";
}): TelegramReplyPlan {
  if ((input.chat_type ?? "private") !== "private") {
    throw new Error("Telegram group/channel replies are forbidden.");
  }
  const chatId = String(input.chat_id);
  const replyTo = String(input.reply_to_message_id);

  return TelegramReplyPlanSchema.parse({
    reply_version: TELEGRAM_OUTBOUND_REPLY_VERSION,
    transport_version: TELEGRAM_TRANSPORT_VERSION,
    plan_id: `telegram-reply:${chatId}:${replyTo}`,
    chat_id: chatId,
    reply_to_message_id: replyTo,
    correlation_id: input.correlation_id,
    reply_text: input.reply_text,
    chat_type: "private",
    dry_run_default: true,
    media_send_supported: false,
    file_send_supported: false,
    approval_authority: false,
    action_execution_supported: false,
    metadata_only: true,
  });
}

export async function sendTelegramReplyWithAdapter(
  planInput: TelegramReplyPlan,
  adapter: TelegramSenderAdapter = createDryRunTelegramSender(),
): Promise<TelegramReplySendResult> {
  const plan = TelegramReplyPlanSchema.parse(planInput);
  const result = await adapter.sendReply(plan);
  return TelegramReplySendResultSchema.parse(result);
}

export function createDryRunTelegramSender(): TelegramSenderAdapter {
  return {
    adapter_id: "telegram-dry-run-sender",
    sendReply(plan) {
      const parsed = TelegramReplyPlanSchema.parse(plan);
      return replyResult(parsed, {
        status: "dry_run",
        sent: false,
        adapter_id: "telegram-dry-run-sender",
        provider_message_id: null,
        reasons: ["dry_run_default_no_network_send"],
      });
    },
  };
}

export function createInjectedTelegramSender(
  sender: (
    plan: TelegramReplyPlan,
  ) => TelegramReplySendResult | Promise<TelegramReplySendResult>,
  adapterId = "telegram-injected-sender",
): TelegramSenderAdapter {
  return {
    adapter_id: adapterId,
    sendReply(plan) {
      return sender(TelegramReplyPlanSchema.parse(plan));
    },
  };
}

export function buildTelegramReplyGovernance(): TelegramReplyGovernance {
  return TelegramReplyGovernanceSchema.parse({
    transport_only: true,
    dry_run_default: true,
    direct_private_chat_only: true,
    approval_authority: false,
    approval_finalization_attempted: false,
    action_execution_attempted: false,
    provider_call_attempted: false,
    media_send_attempted: false,
    file_send_attempted: false,
    group_reply_attempted: false,
    raw_token_exposed: false,
    metadata_only: true,
  });
}

export function buildInjectedTelegramSendResult(
  plan: TelegramReplyPlan,
  input: {
    readonly adapter_id?: string;
    readonly provider_message_id: string;
    readonly reasons?: readonly string[];
  },
): TelegramReplySendResult {
  return replyResult(TelegramReplyPlanSchema.parse(plan), {
    status: "sent",
    sent: true,
    adapter_id: input.adapter_id ?? "telegram-injected-sender",
    provider_message_id: input.provider_message_id,
    reasons: input.reasons ?? ["sent_by_injected_adapter"],
  });
}

function replyResult(
  plan: TelegramReplyPlan,
  input: {
    readonly status: TelegramReplySendStatus;
    readonly sent: boolean;
    readonly adapter_id: string;
    readonly provider_message_id: string | null;
    readonly reasons: readonly string[];
  },
): TelegramReplySendResult {
  return TelegramReplySendResultSchema.parse({
    reply_version: TELEGRAM_OUTBOUND_REPLY_VERSION,
    status: input.status,
    sent: input.sent,
    plan_id: plan.plan_id,
    adapter_id: input.adapter_id,
    chat_id: plan.chat_id,
    reply_to_message_id: plan.reply_to_message_id,
    correlation_id: plan.correlation_id,
    provider_message_id: input.provider_message_id,
    reasons: input.reasons,
    governance: buildTelegramReplyGovernance(),
    metadata_only: true,
    raw_token_exposed: false,
  });
}
