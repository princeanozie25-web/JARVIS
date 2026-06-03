import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  TELEGRAM_BOT_CONFIG_VERSION,
  buildTelegramBotConfig,
  summarizeTelegramBotConfig,
  validateTelegramBotConfig,
} from ".";

describe("Telegram bot configuration boundary", () => {
  it("accepts valid disabled direct-chat config without exposing raw token", () => {
    const config = buildTelegramBotConfig({
      bot_token: "123456:secret-token",
      authorized_user_ids: [1001],
      chat_mode: "direct",
      api_mode: "webhook",
    });
    const summary = summarizeTelegramBotConfig(config);

    expect(config.config_version).toBe(TELEGRAM_BOT_CONFIG_VERSION);
    expect(config.bot_token_present).toBe(true);
    expect(config.raw_bot_token_exposed).toBe(false);
    expect(config.authorized_user_ids).toEqual(["1001"]);
    expect(config.single_user_direct_chat_only).toBe(true);
    expect(config.disabled_by_default).toBe(true);
    expect(config.webhook_server_started).toBe(false);
    expect(config.polling_loop_started).toBe(false);
    expect(config.background_daemon_started).toBe(false);
    expect(JSON.stringify(config)).not.toContain("secret-token");
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });

  it("rejects missing authorized user allowlist", () => {
    const validation = validateTelegramBotConfig({
      bot_token: "123456:secret-token",
      authorized_user_ids: [],
      chat_mode: "direct",
    });

    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain("missing_authorized_user_allowlist");
    expect(validation.raw_bot_token_exposed).toBe(false);
  });

  it("rejects group or channel mode", () => {
    expect(() =>
      buildTelegramBotConfig({
        bot_token: "123456:secret-token",
        authorized_user_ids: [1001],
        chat_mode: "group",
      }),
    ).toThrow("group/channel mode is forbidden");

    const validation = validateTelegramBotConfig({
      bot_token: "123456:secret-token",
      authorized_user_ids: [1001],
      chat_mode: "channel",
    });

    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain("group_or_channel_mode_forbidden");
  });

  it("rejects unauthorized sender metadata", () => {
    const validation = validateTelegramBotConfig(
      {
        bot_token: "123456:secret-token",
        authorized_user_ids: [1001],
        chat_mode: "direct",
      },
      2002,
    );

    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain("unauthorized_sender");
  });

  it("has no token, provider, network, daemon, or execution code paths", () => {
    const source = readFileSync("src/lib/telegram/config.ts", "utf8");

    expect(source).not.toMatch(/\bfetch\s*\(|googleapis|openai|anthropic/i);
    expect(source).not.toMatch(/setInterval|setTimeout|new\s+Worker/);
    expect(source).not.toMatch(/writeFile|appendFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
  });
});
