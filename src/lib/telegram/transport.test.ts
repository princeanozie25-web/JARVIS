import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildTelegramConversationState,
  buildTelegramInletCloseoutReport,
  buildTelegramRouterEnvelope,
  normalizeTelegramInboundMessage,
  summarizeTelegramConversation,
  validateTelegramInboundMessage,
  type TelegramMessageEnvelope,
  type TelegramRawInboundMessage,
} from "./transport";

const rawTelegramMessage: TelegramRawInboundMessage = {
  message_id: 42,
  date: 1_766_666_000,
  text: "Can you summarize my morning brief?",
  from: {
    id: 1001,
    is_bot: false,
    username: "prince",
    first_name: "Prince",
  },
  chat: {
    id: 1001,
    type: "private",
    username: "prince",
    first_name: "Prince",
  },
};

function normalized(): TelegramMessageEnvelope {
  return normalizeTelegramInboundMessage(rawTelegramMessage);
}

describe("Telegram inbound transport", () => {
  it("validates supported direct text message structures", () => {
    expect(validateTelegramInboundMessage(rawTelegramMessage)).toBe(true);
    expect(
      validateTelegramInboundMessage({
        ...rawTelegramMessage,
        text: "",
      }),
    ).toBe(false);
    expect(
      validateTelegramInboundMessage({
        ...rawTelegramMessage,
        chat: { ...rawTelegramMessage.chat, type: "group" },
      }),
    ).toBe(false);
  });

  it("normalizes Telegram text messages deterministically and preserves metadata", () => {
    const first = normalized();
    const second = normalizeTelegramInboundMessage({ ...rawTelegramMessage });

    expect(first).toEqual(second);
    expect(first.envelope_id).toBe(
      "telegram-envelope:telegram:direct:1001:1001:42",
    );
    expect(first.inbound_message).toMatchObject({
      message_id: "42",
      conversation_id: "telegram:direct:1001:1001",
      timestamp: "2025-12-25T12:33:20.000Z",
      content: "Can you summarize my morning brief?",
      content_type: "text",
      sender: {
        sender_id: "1001",
        username: "prince",
        display_name: "Prince",
        is_bot: false,
      },
      chat: {
        chat_id: "1001",
        chat_type: "private",
        title: "Prince",
      },
    });
    expect(first.inbound_message.source_metadata).toEqual({
      transport: "telegram",
      transport_version: "phase21d.telegram-transport.v1",
      supported_message_type: "text",
      direct_message_only: true,
      media_supported: false,
      outbound_supported: false,
      network_call_attempted: false,
      authority: "transport_only",
    });
    expect(first.execution_attempted).toBe(false);
    expect(first.write_attempted).toBe(false);
  });

  it("rejects malformed and unsupported Telegram payloads", () => {
    expect(() =>
      normalizeTelegramInboundMessage({
        ...rawTelegramMessage,
        text: undefined,
      }),
    ).toThrow();
    expect(() =>
      normalizeTelegramInboundMessage({
        ...rawTelegramMessage,
        photo: [{ file_id: "photo-1" }],
      }),
    ).toThrow("Unsupported Telegram payload");
    expect(
      validateTelegramInboundMessage({
        ...rawTelegramMessage,
        document: { file_id: "doc-1" },
      }),
    ).toBe(false);
  });

  it("builds a router envelope that follows normal user text classification", () => {
    const routerEnvelope = buildTelegramRouterEnvelope(normalized());

    expect(routerEnvelope.router_input_id).toBe(
      "telegram-router:telegram:direct:1001:1001:42",
    );
    expect(routerEnvelope.intent_envelope).toMatchObject({
      transport: "telegram",
      conversation_id: "telegram:direct:1001:1001",
      input_kind: "user_text",
      classification_path: "normal_user_text",
      authority: "transport_only",
      approval_bypass_attempted: false,
      execution_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
    });
    expect(routerEnvelope.summary).toEqual({
      transport: "telegram",
      conversation_id: "telegram:direct:1001:1001",
      message_id: "42",
      sender_id: "1001",
      chat_id: "1001",
      content_type: "text",
      content_length: 35,
      transport_only: true,
      authority_elevated: false,
    });
  });

  it("tracks conversation state deterministically without persistence or memory writes", () => {
    const later = normalizeTelegramInboundMessage({
      ...rawTelegramMessage,
      message_id: 43,
      date: rawTelegramMessage.date + 60,
      text: "Keep this transport only.",
    });
    const state = buildTelegramConversationState([later, normalized()]);
    const summary = summarizeTelegramConversation(state);

    expect(state).toEqual({
      conversation_id: "telegram:direct:1001:1001",
      sender_id: "1001",
      chat_id: "1001",
      message_count: 2,
      first_activity_at: "2025-12-25T12:33:20.000Z",
      last_activity_at: "2025-12-25T12:34:20.000Z",
      last_message_id: "43",
      content_character_count: 60,
      summary_metadata: {
        direct_message_only: true,
        media_messages_seen: 0,
        outbound_messages_attempted: 0,
        memory_write_attempted: false,
        persistence_attempted: false,
      },
    });
    expect(summary).toEqual({
      conversation_id: "telegram:direct:1001:1001",
      message_count: 2,
      last_activity_at: "2025-12-25T12:34:20.000Z",
      summary:
        "Telegram direct text conversation with 2 normalized message(s).",
      metadata_only: true,
      memory_write_attempted: false,
      database_write_attempted: false,
    });
  });

  it("reports closeout as inbound transport, not automation or execution", () => {
    const report = buildTelegramInletCloseoutReport();

    expect(report.title).toBe("Telegram inbound transport complete");
    expect(report.components).toEqual([
      "transport_contract",
      "message_normalization",
      "router_envelope",
      "conversation_state",
    ]);
    expect(report.governance).toEqual({
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
    });
    expect(report.readme_safe_wording.join(" ")).toContain(
      "Telegram inbound transport complete.",
    );
    expect(report.future_work).toEqual(
      expect.arrayContaining([
        "Outbound messaging remains future work.",
        "Approval actions and agent execution over Telegram remain future work.",
      ]),
    );
  });

  it("does not include network, provider, outbound, automation, or persistence paths", () => {
    const source = readFileSync("src/lib/telegram/transport.ts", "utf8");

    expect(source).not.toMatch(/from\s+["'](?:node:)?fs/);
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:openai|anthropic|deepseek)/i,
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\b(?:axios|WebSocket|XMLHttpRequest)\b/);
    expect(source).not.toMatch(
      /\b(?:sendMessage|sendPhoto|sendDocument|replyWith|telegramApi)\b/i,
    );
    expect(source).not.toMatch(/\b(?:writeFile|appendFile|mkdir|rm|unlink)\b/);
    expect(source).not.toMatch(/\b(?:sqlite|better-sqlite3|db\.)\b/i);
    expect(source).not.toMatch(
      /\b(?:setInterval|setTimeout|cron|scheduleJob)\b/i,
    );
  });
});
