import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildTelegramBotConfig,
  buildTelegramInboundAdapterResult,
  parseTelegramBotUpdate,
  routeTelegramUpdateToEnvelope,
} from ".";

const config = buildTelegramBotConfig({
  bot_token: "123456:secret-token",
  authorized_user_ids: [1001],
  chat_mode: "direct",
});

describe("Telegram inbound adapter", () => {
  it("accepts direct 1:1 authorized text updates and creates router envelope", () => {
    const result = buildTelegramInboundAdapterResult(textUpdate(), config);

    expect(result.accepted).toBe(true);
    expect(result.update_id).toBe("9001");
    expect(result.rejection_reasons).toEqual([]);
    expect(result.envelope?.inbound_message.content).toBe("Hello JARVIS");
    expect(result.router_input?.intent_envelope).toMatchObject({
      transport: "telegram",
      input_kind: "user_text",
      authority: "transport_only",
      approval_bypass_attempted: false,
      execution_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
    });
    expect(result.governance.authorized_single_user).toBe(true);
    expect(result.governance.raw_token_exposed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("routes accepted updates to existing Telegram router envelope", () => {
    const routed = routeTelegramUpdateToEnvelope(textUpdate(), config);

    expect(routed.router_input_id).toBe(
      "telegram-router:telegram:direct:1001:1001:42",
    );
    expect(routed.summary.transport_only).toBe(true);
    expect(routed.summary.authority_elevated).toBe(false);
  });

  it("rejects unauthorized users", () => {
    const result = buildTelegramInboundAdapterResult(
      textUpdate({ userId: 2002 }),
      config,
    );

    expect(result.accepted).toBe(false);
    expect(result.rejection_reasons).toContain("unauthorized_sender");
    expect(result.router_input).toBeNull();
  });

  it("rejects media, file, voice, and image updates", () => {
    for (const patch of [
      { photo: [{ file_id: "photo-1" }] },
      { document: { file_id: "doc-1" } },
      { voice: { file_id: "voice-1" } },
      { video: { file_id: "video-1" } },
    ]) {
      const result = buildTelegramInboundAdapterResult(
        textUpdate({ messagePatch: patch }),
        config,
      );

      expect(result.accepted).toBe(false);
      expect(result.rejection_reasons).toContain(
        "media_file_voice_or_image_forbidden",
      );
    }
  });

  it("rejects group and channel updates", () => {
    for (const type of ["group", "channel"] as const) {
      const parsed = parseTelegramBotUpdate(
        textUpdate({ chatType: type, chatId: -1001 }),
      );

      expect(parsed.accepted).toBe(false);
      expect(parsed.rejection_reasons).toContain("group_or_channel_forbidden");
      expect(parsed.raw_token_exposed).toBe(false);
    }
  });

  it("throws when routing rejected updates", () => {
    expect(() =>
      routeTelegramUpdateToEnvelope(textUpdate({ userId: 2002 }), config),
    ).toThrow("Telegram update rejected");
  });

  it("has no provider, network, daemon, approval, execution, or token paths", () => {
    const source = readFileSync("src/lib/telegram/inbound-adapter.ts", "utf8");

    expect(source).not.toMatch(/\bfetch\s*\(|googleapis|openai|anthropic/i);
    expect(source).not.toMatch(/setInterval|setTimeout|new\s+Worker/);
    expect(source).not.toMatch(/writeFile|appendFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
    expect(source).not.toMatch(/bot_token|secret-token/);
  });
});

function textUpdate(
  options: {
    readonly userId?: number;
    readonly chatId?: number;
    readonly chatType?: "private" | "group" | "channel";
    readonly messagePatch?: Record<string, unknown>;
  } = {},
) {
  const userId = options.userId ?? 1001;
  return {
    update_id: 9001,
    message: {
      message_id: 42,
      date: 1_766_666_000,
      text: "Hello JARVIS",
      from: {
        id: userId,
        is_bot: false,
        username: "prince",
        first_name: "Prince",
      },
      chat: {
        id: options.chatId ?? userId,
        type: options.chatType ?? "private",
        username: "prince",
        first_name: "Prince",
      },
      ...options.messagePatch,
    },
  };
}
