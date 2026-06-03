import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * UI.4 static guard. Fails if the root route reintroduces any of the
 * AI-slop / chatbot composition tells the UI Polish Plan was opened to
 * eliminate. Scoped to `app/page.tsx` only — `app/converse/page.tsx`
 * retains the conversational lane and must not be checked here.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const rootPageSource = readFileSync(resolve(ROOT, "app", "page.tsx"), "utf8");

const FORBIDDEN_CHATBOT_TELLS = [
  // Chat-bubble palette anti-pattern from `DESIGN.md`.
  { needle: "bg-blue-600", reason: "user chat bubble class" },
  { needle: "bg-gray-900", reason: "assistant chat bubble class" },
  { needle: "bg-gray-950", reason: "legacy panel chat-stack class" },
  // Generic chatbot placeholder copy.
  { needle: "Message JARVIS", reason: "chat input placeholder copy" },
  // Provider selector — a routing concern, not a top-level UI control.
  { needle: "SUPPORTED_PROVIDERS", reason: "provider selector data source" },
  { needle: "SupportedProvider", reason: "provider selector type" },
  // Chat transport — root surface must not initiate chat requests.
  { needle: "/api/chat", reason: "chat API call from root surface" },
  { needle: "parseSseEvents", reason: "chat SSE stream parser" },
  // Composition signal: chat thread layout containers.
  { needle: "max-w-3xl", reason: "chat thread container width" },
] as const;

const FORBIDDEN_REGEXES = [
  { regex: /<textarea\b/i, reason: "chat input textarea" },
  { regex: /<select\b/i, reason: "provider <select> dropdown" },
  { regex: /placeholder\s*=/i, reason: "input placeholder attribute" },
  { regex: /"use client"|'use client'/, reason: "client component on root" },
] as const;

describe("UI.4 no-chatbot-tells guard for app/page.tsx", () => {
  for (const { needle, reason } of FORBIDDEN_CHATBOT_TELLS) {
    it(`does not contain "${needle}" (${reason})`, () => {
      expect(rootPageSource).not.toContain(needle);
    });
  }

  for (const { regex, reason } of FORBIDDEN_REGEXES) {
    it(`does not match ${regex.source} (${reason})`, () => {
      expect(rootPageSource).not.toMatch(regex);
    });
  }

  it("declares the command-center surface marker as a positive signal", () => {
    expect(rootPageSource).toContain('data-surface="command-center"');
  });

  it("scopes guarding to the root route — the chat composition lives at /converse", () => {
    const conversePagePath = resolve(ROOT, "app", "converse", "page.tsx");
    const converseSource = readFileSync(conversePagePath, "utf8");
    expect(converseSource).toContain('"use client"');
  });
});
