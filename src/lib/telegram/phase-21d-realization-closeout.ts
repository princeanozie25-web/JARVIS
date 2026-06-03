import { z } from "zod";
import { TELEGRAM_BOT_CONFIG_VERSION } from "./config";
import { TELEGRAM_INBOUND_ADAPTER_VERSION } from "./inbound-adapter";
import { TELEGRAM_OUTBOUND_REPLY_VERSION } from "./outbound-reply";
import { TELEGRAM_TRANSPORT_VERSION } from "./transport";

export const TELEGRAM_REALIZATION_CLOSEOUT_VERSION =
  "phase21d-r.telegram-realization-closeout.v1" as const;

export const TelegramRealizationCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(TELEGRAM_REALIZATION_CLOSEOUT_VERSION),
  status: z.literal("Telegram realized as governed single-user text transport"),
  realized: z.literal(true),
  components: z.array(
    z.enum([
      "bot_configuration_boundary",
      "authorized_user_allowlist",
      "inbound_update_parser",
      "direct_text_normalization",
      "router_envelope_handoff",
      "outbound_reply_planning",
      "injected_sender_boundary",
      "dry_run_default_sender",
    ]),
  ),
  versions: z.strictObject({
    transport: z.literal(TELEGRAM_TRANSPORT_VERSION),
    config: z.literal(TELEGRAM_BOT_CONFIG_VERSION),
    inbound_adapter: z.literal(TELEGRAM_INBOUND_ADAPTER_VERSION),
    outbound_reply: z.literal(TELEGRAM_OUTBOUND_REPLY_VERSION),
  }),
  governance: z.strictObject({
    transport_only: z.literal(true),
    no_approval_authority: z.literal(true),
    no_approval_finalization: z.literal(true),
    no_action_execution: z.literal(true),
    no_provider_model_calls: z.literal(true),
    no_network_calls_default_path: z.literal(true),
    injected_sender_boundary_only: z.literal(true),
    no_background_daemon: z.literal(true),
    no_polling_loop: z.literal(true),
    no_webhook_server: z.literal(true),
    no_media_files_voice_images: z.literal(true),
    no_group_channel_support: z.literal(true),
    no_raw_token_exposure: z.literal(true),
    no_new_authority_surface: z.literal(true),
    metadata_only: z.literal(true),
  }),
  readme_safe_wording: z.array(z.string().trim().min(1).max(260)),
  future_work: z.array(z.string().trim().min(1).max(220)),
});

export type TelegramRealizationCloseoutReport = z.infer<
  typeof TelegramRealizationCloseoutReportSchema
>;

export function buildTelegramRealizationCloseoutReport(): TelegramRealizationCloseoutReport {
  return TelegramRealizationCloseoutReportSchema.parse({
    closeout_version: TELEGRAM_REALIZATION_CLOSEOUT_VERSION,
    status: "Telegram realized as governed single-user text transport",
    realized: true,
    components: [
      "bot_configuration_boundary",
      "authorized_user_allowlist",
      "inbound_update_parser",
      "direct_text_normalization",
      "router_envelope_handoff",
      "outbound_reply_planning",
      "injected_sender_boundary",
      "dry_run_default_sender",
    ],
    versions: {
      transport: TELEGRAM_TRANSPORT_VERSION,
      config: TELEGRAM_BOT_CONFIG_VERSION,
      inbound_adapter: TELEGRAM_INBOUND_ADAPTER_VERSION,
      outbound_reply: TELEGRAM_OUTBOUND_REPLY_VERSION,
    },
    governance: {
      transport_only: true,
      no_approval_authority: true,
      no_approval_finalization: true,
      no_action_execution: true,
      no_provider_model_calls: true,
      no_network_calls_default_path: true,
      injected_sender_boundary_only: true,
      no_background_daemon: true,
      no_polling_loop: true,
      no_webhook_server: true,
      no_media_files_voice_images: true,
      no_group_channel_support: true,
      no_raw_token_exposure: true,
      no_new_authority_surface: true,
      metadata_only: true,
    },
    readme_safe_wording: [
      "Telegram realized as governed single-user text transport",
      "Telegram supports bot configuration metadata, authorized single-user direct text parsing, router envelope handoff, dry-run outbound reply planning, and an injected sender boundary for future runtime integration.",
      "Telegram does not approve actions, execute tools, handle groups/media/files/voice/images, run a daemon, or bypass desktop approval.",
    ],
    future_work: [
      "Webhook server remains future work.",
      "Polling daemon remains future work.",
      "Media, voice, files, images, groups, and channels remain future work.",
      "Telegram approval authority and remote execution remain forbidden.",
    ],
  });
}
