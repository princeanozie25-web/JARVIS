import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  TELEGRAM_REALIZATION_CLOSEOUT_VERSION,
  buildTelegramRealizationCloseoutReport,
} from ".";

describe("Telegram realization closeout", () => {
  it("reports required realization wording", () => {
    const report = buildTelegramRealizationCloseoutReport();

    expect(report.closeout_version).toBe(TELEGRAM_REALIZATION_CLOSEOUT_VERSION);
    expect(report.status).toBe(
      "Telegram realized as governed single-user text transport",
    );
    expect(report.realized).toBe(true);
  });

  it("verifies all realization components", () => {
    const report = buildTelegramRealizationCloseoutReport();

    expect(report.components).toEqual([
      "bot_configuration_boundary",
      "authorized_user_allowlist",
      "inbound_update_parser",
      "direct_text_normalization",
      "router_envelope_handoff",
      "outbound_reply_planning",
      "injected_sender_boundary",
      "dry_run_default_sender",
    ]);
  });

  it("verifies prohibited capabilities are absent", () => {
    const governance = buildTelegramRealizationCloseoutReport().governance;

    expect(governance.transport_only).toBe(true);
    expect(governance.no_approval_authority).toBe(true);
    expect(governance.no_approval_finalization).toBe(true);
    expect(governance.no_action_execution).toBe(true);
    expect(governance.no_provider_model_calls).toBe(true);
    expect(governance.no_network_calls_default_path).toBe(true);
    expect(governance.injected_sender_boundary_only).toBe(true);
    expect(governance.no_background_daemon).toBe(true);
    expect(governance.no_polling_loop).toBe(true);
    expect(governance.no_webhook_server).toBe(true);
    expect(governance.no_media_files_voice_images).toBe(true);
    expect(governance.no_group_channel_support).toBe(true);
    expect(governance.no_raw_token_exposure).toBe(true);
    expect(governance.no_new_authority_surface).toBe(true);
  });

  it("uses README-safe wording without overclaiming authority", () => {
    const report = buildTelegramRealizationCloseoutReport();
    const wording = report.readme_safe_wording.join(" ");

    expect(wording).toMatch(
      /Telegram realized as governed single-user text transport/i,
    );
    expect(wording).toMatch(/dry-run outbound reply planning/i);
    expect(wording).not.toMatch(
      /can approve actions|can execute tools|runs a daemon/i,
    );
    expect(report.future_work.join(" ")).toMatch(/Webhook server/);
  });

  it("does not add provider, network, daemon, approval, execution, media, or token paths", () => {
    const source = readFileSync(
      "src/lib/telegram/phase-21d-realization-closeout.ts",
      "utf8",
    );

    expect(source).not.toMatch(/\bfetch\s*\(|googleapis|openai|anthropic/i);
    expect(source).not.toMatch(/setInterval|setTimeout|new\s+Worker/);
    expect(source).not.toMatch(/writeFile|appendFile|new Database/);
    expect(source).not.toMatch(/finalizeApproval|executeApproval/);
    expect(source).not.toMatch(/sendPhoto|sendDocument|sendVoice|sendMedia/i);
    expect(source).not.toMatch(/bot_token|secret-token/);
  });
});
