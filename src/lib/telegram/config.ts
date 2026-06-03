import { z } from "zod";

export const TELEGRAM_BOT_CONFIG_VERSION =
  "phase21d-r.telegram-bot-config.v1" as const;

export const TELEGRAM_BOT_API_MODES = ["webhook", "polling"] as const;
export const TELEGRAM_CHAT_MODES = ["direct", "group", "channel"] as const;

const TelegramIdSchema = z
  .union([z.string().trim().min(1).max(80), z.number().int()])
  .transform(String);

export const TelegramBotApiModeSchema = z.enum(TELEGRAM_BOT_API_MODES);
export const TelegramChatModeSchema = z.enum(TELEGRAM_CHAT_MODES);

export const TelegramBotConfigInputSchema = z.strictObject({
  bot_token: z.string().trim().min(1).max(240).optional(),
  authorized_user_ids: z.array(TelegramIdSchema).min(1),
  chat_mode: TelegramChatModeSchema.default("direct"),
  api_mode: TelegramBotApiModeSchema.default("webhook"),
  disabled_by_default: z.literal(true).default(true),
});

export const TelegramBotConfigSchema = z.strictObject({
  config_version: z.literal(TELEGRAM_BOT_CONFIG_VERSION),
  bot_token_present: z.boolean(),
  raw_bot_token_exposed: z.literal(false),
  authorized_user_ids: z.array(z.string().trim().min(1).max(80)).min(1),
  authorized_user_count: z.number().int().positive(),
  single_user_direct_chat_only: z.literal(true),
  chat_mode: z.literal("direct"),
  api_mode: TelegramBotApiModeSchema,
  disabled_by_default: z.literal(true),
  webhook_server_started: z.literal(false),
  polling_loop_started: z.literal(false),
  background_daemon_started: z.literal(false),
  network_call_attempted: z.literal(false),
  approval_authority: z.literal(false),
  execution_authority: z.literal(false),
  metadata_only: z.literal(true),
});

export const TelegramBotConfigValidationSchema = z.strictObject({
  valid: z.boolean(),
  reasons: z.array(
    z.enum([
      "valid_config",
      "missing_authorized_user_allowlist",
      "group_or_channel_mode_forbidden",
      "unauthorized_sender",
      "invalid_config",
    ]),
  ),
  authorized_user_count: z.number().int().nonnegative(),
  bot_token_present: z.boolean(),
  raw_bot_token_exposed: z.literal(false),
  metadata_only: z.literal(true),
});

export const TelegramBotConfigSummarySchema = z.strictObject({
  bot_token_present: z.boolean(),
  authorized_user_count: z.number().int().nonnegative(),
  api_mode: TelegramBotApiModeSchema,
  single_user_direct_chat_only: z.literal(true),
  disabled_by_default: z.literal(true),
  raw_bot_token_exposed: z.literal(false),
  metadata_only: z.literal(true),
});

export type TelegramBotConfigInput = z.input<
  typeof TelegramBotConfigInputSchema
>;
export type TelegramBotConfig = z.infer<typeof TelegramBotConfigSchema>;
export type TelegramBotConfigValidation = z.infer<
  typeof TelegramBotConfigValidationSchema
>;
export type TelegramBotConfigSummary = z.infer<
  typeof TelegramBotConfigSummarySchema
>;

export function buildTelegramBotConfig(
  input: TelegramBotConfigInput,
): TelegramBotConfig {
  const parsed = TelegramBotConfigInputSchema.parse(input);
  if (parsed.chat_mode !== "direct") {
    throw new Error("Telegram group/channel mode is forbidden.");
  }

  return TelegramBotConfigSchema.parse({
    config_version: TELEGRAM_BOT_CONFIG_VERSION,
    bot_token_present: Boolean(parsed.bot_token),
    raw_bot_token_exposed: false,
    authorized_user_ids: unique(parsed.authorized_user_ids),
    authorized_user_count: unique(parsed.authorized_user_ids).length,
    single_user_direct_chat_only: true,
    chat_mode: "direct",
    api_mode: parsed.api_mode,
    disabled_by_default: true,
    webhook_server_started: false,
    polling_loop_started: false,
    background_daemon_started: false,
    network_call_attempted: false,
    approval_authority: false,
    execution_authority: false,
    metadata_only: true,
  });
}

export function validateTelegramBotConfig(
  input: unknown,
  senderUserId?: string | number | null,
): TelegramBotConfigValidation {
  const parsed = TelegramBotConfigInputSchema.safeParse(input);
  if (!parsed.success) {
    return validationResult({
      valid: false,
      reasons: ["invalid_config", "missing_authorized_user_allowlist"],
      authorizedUserCount: 0,
      botTokenPresent: false,
    });
  }

  const reasons: TelegramBotConfigValidation["reasons"] = [];
  const authorized = unique(parsed.data.authorized_user_ids);
  if (authorized.length === 0) {
    reasons.push("missing_authorized_user_allowlist");
  }
  if (parsed.data.chat_mode !== "direct") {
    reasons.push("group_or_channel_mode_forbidden");
  }
  if (
    senderUserId !== undefined &&
    senderUserId !== null &&
    !authorized.includes(String(senderUserId))
  ) {
    reasons.push("unauthorized_sender");
  }

  return validationResult({
    valid: reasons.length === 0,
    reasons: reasons.length ? reasons : ["valid_config"],
    authorizedUserCount: authorized.length,
    botTokenPresent: Boolean(parsed.data.bot_token),
  });
}

export function summarizeTelegramBotConfig(
  config: TelegramBotConfig,
): TelegramBotConfigSummary {
  const parsed = TelegramBotConfigSchema.parse(config);
  return TelegramBotConfigSummarySchema.parse({
    bot_token_present: parsed.bot_token_present,
    authorized_user_count: parsed.authorized_user_count,
    api_mode: parsed.api_mode,
    single_user_direct_chat_only: true,
    disabled_by_default: true,
    raw_bot_token_exposed: false,
    metadata_only: true,
  });
}

export function isTelegramSenderAuthorized(
  config: TelegramBotConfig,
  senderUserId: string | number,
): boolean {
  const parsed = TelegramBotConfigSchema.parse(config);
  return parsed.authorized_user_ids.includes(String(senderUserId));
}

function validationResult(input: {
  readonly valid: boolean;
  readonly reasons: TelegramBotConfigValidation["reasons"];
  readonly authorizedUserCount: number;
  readonly botTokenPresent: boolean;
}): TelegramBotConfigValidation {
  return TelegramBotConfigValidationSchema.parse({
    valid: input.valid,
    reasons: [...new Set(input.reasons)],
    authorized_user_count: input.authorizedUserCount,
    bot_token_present: input.botTokenPresent,
    raw_bot_token_exposed: false,
    metadata_only: true,
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(String))];
}
