import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT_PAGE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "page.tsx",
);
const rootPageSource = readFileSync(ROOT_PAGE_PATH, "utf8");

describe("UI.4 root surface — command center identity", () => {
  it("is a server component with no client directive", () => {
    expect(rootPageSource.startsWith('"use client"')).toBe(false);
    expect(rootPageSource).not.toContain("'use client'");
  });

  it("declares the command-center surface marker", () => {
    expect(rootPageSource).toMatch(/RestCommandCenter/);
  });

  it("renders the shared pipeline rest surface as the system presence", () => {
    expect(rootPageSource).toMatch(
      /from "@\/components\/command-center\/RestCommandCenter"/,
    );
    expect(rootPageSource).toContain('activeRoute="home"');
    expect(rootPageSource).not.toContain("SYNTHETIC_REST_ORB_TOKENS");
  });

  it("delegates route navigation and suggestion inbox to the shared shell", () => {
    expect(rootPageSource).toContain("SYNTHETIC_OBSERVABILITY_MARKER");
    expect(rootPageSource).not.toMatch(/<button\b|<form\b|<input\b/i);
  });

  it("keeps /converse out of the command-center spine for this pass", () => {
    expect(rootPageSource).not.toContain("/converse");
  });

  it("surfaces a governance-posture region with metadata-only rules", () => {
    expect(rootPageSource).toContain("SYNTHETIC_OBSERVABILITY_MARKER");
    expect(rootPageSource).not.toContain("SYNTHETIC_REST_ORB_TOKENS");
  });

  it("uses JARVIS semantic tokens, not raw chat-bubble palette", () => {
    expect(rootPageSource).toContain("RestCommandCenter");
    expect(rootPageSource).not.toContain("bg-blue-600");
    expect(rootPageSource).not.toContain("bg-gray-900");
    expect(rootPageSource).not.toContain("bg-gray-950");
  });
});

describe("UI.4 root surface — no chatbot composition", () => {
  it("does not render a chat input or chat placeholder", () => {
    expect(rootPageSource).not.toMatch(/Message JARVIS/i);
    expect(rootPageSource).not.toMatch(/<textarea\b/i);
    expect(rootPageSource).not.toMatch(/placeholder=/i);
  });

  it("does not render a provider selector", () => {
    expect(rootPageSource).not.toMatch(/<select\b/i);
    expect(rootPageSource).not.toContain("SUPPORTED_PROVIDERS");
    expect(rootPageSource).not.toContain("SupportedProvider");
  });

  it("does not call /api/chat or stream SSE events", () => {
    expect(rootPageSource).not.toContain("/api/chat");
    expect(rootPageSource).not.toContain("parseSseEvents");
  });

  it("does not import any of the chat-only panels", () => {
    for (const panel of [
      "ApprovalCard",
      "RuntimeCommandPanel",
      "VoiceControlPanel",
      "ConversationCuratorPanel",
      "MemoryCandidateReviewPanel",
      "HumanReviewQueuePanel",
    ]) {
      expect(rootPageSource).not.toContain(`@/components/${panel}`);
    }
  });
});
