import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildInjectedTelegramSendResult,
  buildTelegramReplyPlan,
  createDryRunTelegramSender,
  createInjectedTelegramSender,
  sendTelegramReplyWithAdapter,
} from ".";

describe("Telegram outbound reply adapter", () => {
  it("builds a transport-only reply plan", () => {
    const plan = replyPlan();

    expect(plan.plan_id).toBe("telegram-reply:1001:42");
    expect(plan.chat_id).toBe("1001");
    expect(plan.reply_to_message_id).toBe("42");
    expect(plan.correlation_id).toBe("telegram-router:direct:42");
    expect(plan.reply_text).toBe("Transport-only reply.");
    expect(plan.chat_type).toBe("private");
    expect(plan.dry_run_default).toBe(true);
    expect(plan.media_send_supported).toBe(false);
    expect(plan.file_send_supported).toBe(false);
    expect(plan.approval_authority).toBe(false);
    expect(plan.action_execution_supported).toBe(false);
  });

  it("defaults to dry-run and does not send", async () => {
    const result = await sendTelegramReplyWithAdapter(replyPlan());

    expect(result.status).toBe("dry_run");
    expect(result.sent).toBe(false);
    expect(result.adapter_id).toBe("telegram-dry-run-sender");
    expect(result.provider_message_id).toBeNull();
    expect(result.reasons).toContain("dry_run_default_no_network_send");
    expect(result.governance.dry_run_default).toBe(true);
    expect(result.governance.approval_authority).toBe(false);
    expect(result.governance.action_execution_attempted).toBe(false);
    expect(result.raw_token_exposed).toBe(false);
  });

  it("can send through an injected adapter in tests", async () => {
    const seenPlans: string[] = [];
    const adapter = createInjectedTelegramSender((plan) => {
      seenPlans.push(plan.plan_id);
      return buildInjectedTelegramSendResult(plan, {
        adapter_id: "test-injected-sender",
        provider_message_id: "telegram-message-99",
      });
    }, "test-injected-sender");

    const result = await sendTelegramReplyWithAdapter(replyPlan(), adapter);

    expect(seenPlans).toEqual(["telegram-reply:1001:42"]);
    expect(result.status).toBe("sent");
    expect(result.sent).toBe(true);
    expect(result.adapter_id).toBe("test-injected-sender");
    expect(result.provider_message_id).toBe("telegram-message-99");
    expect(result.governance.provider_call_attempted).toBe(false);
    expect(result.governance.approval_finalization_attempted).toBe(false);
  });

  it("rejects group or channel replies", () => {
    expect(() =>
      buildTelegramReplyPlan({
        chat_id: -1001,
        reply_to_message_id: 42,
        correlation_id: "telegram-router:group:42",
        reply_text: "No group replies.",
        chat_type: "group",
      }),
    ).toThrow("group/channel replies are forbidden");
  });

  it("has no default network, provider, media, approval, or execution path", () => {
    const source = readFileSync("src/lib/telegram/outbound-reply.ts", "utf8");
    const defaultSender = createDryRunTelegramSender();

    expect(defaultSender.adapter_id).toBe("telegram-dry-run-sender");
    expect(source).not.toMatch(/\bfetch\s*\(|googleapis|openai|anthropic/i);
    expect(source).not.toMatch(/setInterval|setTimeout|new\s+Worker/);
    expect(source).not.toMatch(/writeFile|appendFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
    expect(source).not.toMatch(/sendPhoto|sendDocument|sendVoice|sendMedia/i);
    expect(source).not.toMatch(/bot_token|secret-token/);
  });
});

function replyPlan() {
  return buildTelegramReplyPlan({
    chat_id: 1001,
    reply_to_message_id: 42,
    correlation_id: "telegram-router:direct:42",
    reply_text: "Transport-only reply.",
  });
}
