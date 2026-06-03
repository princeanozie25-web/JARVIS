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
    expect(rootPageSource).toContain('data-surface="command-center"');
  });

  it("renders the Orb as the system presence", () => {
    expect(rootPageSource).toMatch(/from "@\/components\/orb\/Orb"/);
    expect(rootPageSource).toMatch(/<Orb\s*\/?>/);
  });

  it("labels every primary region for accessibility", () => {
    for (const label of [
      "System orb",
      "System status",
      "Quick navigation",
      "Recent activity",
      "Suggestions summary",
      "Governance posture",
    ]) {
      expect(rootPageSource).toContain(`aria-label="${label}"`);
    }
  });

  it("links to /rest, /working, /audit, and /converse from quick navigation", () => {
    for (const href of ["/rest", "/working", "/audit", "/converse"]) {
      expect(rootPageSource).toContain(`href: "${href}"`);
    }
  });

  it("surfaces a governance-posture region with metadata-only rules", () => {
    expect(rootPageSource).toContain('aria-label="Governance posture"');
    expect(rootPageSource).toContain("No raw payload telemetry");
    expect(rootPageSource).toContain("No autonomous execution");
  });

  it("uses JARVIS semantic tokens, not raw chat-bubble palette", () => {
    expect(rootPageSource).toContain("bg-void");
    expect(rootPageSource).toContain("bg-panel");
    expect(rootPageSource).toContain("border-border-subtle");
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
