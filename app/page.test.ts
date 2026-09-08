import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const rootPageSource = readFileSync(resolve(HERE, "page.tsx"), "utf8");
const screenSource = readFileSync(
  resolve(HERE, "..", "src", "components", "presence", "PresenceScreen.tsx"),
  "utf8",
);
const tokensCss = readFileSync(
  resolve(HERE, "..", "src", "lib", "presence", "presence.css"),
  "utf8",
);
const thesis = readFileSync(
  resolve(HERE, "..", "docs", "design", "PRESENCE_THESIS.md"),
  "utf8",
);

describe("root surface — the presence", () => {
  it("is a server component that renders the presence screen", () => {
    expect(rootPageSource.startsWith('"use client"')).toBe(false);
    expect(rootPageSource).toMatch(
      /from "@\/components\/presence\/PresenceScreen"/,
    );
    expect(rootPageSource).toMatch(/<PresenceScreen \/>/);
    expect(rootPageSource).toMatch(
      /<main aria-label="JARVIS" data-surface="presence">/,
    );
  });

  it("keeps the cockpit out", () => {
    expect(rootPageSource).not.toMatch(/RestCommandCenter|command-center/);
    expect(screenSource).not.toMatch(/command-center|cockpit|orb\//i);
  });

  it("puts no governance vocabulary on screen", () => {
    // Strings a person would read. Identifiers that talk to the backend
    // (route paths, decision enums) are allowed; copy is not.
    const copy = screenSource
      .split("\n")
      .filter((l) => /(>[^<]*<|"[^"]*[a-z] [a-z][^"]*")/.test(l))
      .join("\n");
    for (const word of thesis.match(/Never ([a-z, ]+)/)?.[1]?.split(/,\s*/) ?? [
      "gate",
      "pipeline",
      "mandate",
      "approval",
      "execution",
      "tier",
      "mutation",
    ]) {
      expect(copy.toLowerCase()).not.toMatch(
        new RegExp(`\\b${word.trim()}\\b`),
      );
    }
  });

  it("is iMessage-shaped: sidebar with JARVIS and the threads, the thread, an activity panel", () => {
    expect(screenSource).toMatch(
      /<nav className="p-side" aria-label="Threads">/,
    );
    expect(screenSource).toMatch(/aria-label="Conversation"/);
    expect(screenSource).toMatch(
      /<aside className="p-panel" aria-label="Activity"/,
    );
    // JARVIS is the one roster entry: a status light and a line, no mascot.
    expect(screenSource).toMatch(/className="p-me-name">JARVIS</);
    expect(screenSource).not.toMatch(/<img\b|\/presence\/mark/);
  });

  it("rests on the standing brief JARVIS posts, not on a splash or a greeting box", () => {
    expect(screenSource).toMatch(/\/api\/presence\/brief/);
    expect(screenSource).toMatch(/className="p-jarvis p-brief"/);
    expect(screenSource).not.toMatch(/p-empty|What can I help|How can I help/);
    expect(
      readFileSync(
        resolve(HERE, "api", "presence", "brief", "route.ts"),
        "utf8",
      ),
    ).toMatch(/Nothing needs you\./);
  });

  it("is Apple-simple: system font, system light/dark, no brand serif", () => {
    expect(tokensCss).toMatch(/color-scheme:\s*light dark/);
    expect(tokensCss).toMatch(/-apple-system/);
    expect(tokensCss).not.toMatch(/Fraunces|--font-jarvis-display/);
  });

  it("is not a chatbot: no typing indicator, no provider menu, no generic prompt copy", () => {
    const code = screenSource.replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/typing…|is typing/i);
    expect(screenSource).not.toMatch(/<select\b/i);
    expect(screenSource).not.toMatch(
      /Message JARVIS|Ask anything|How can I help|Ask me anything/i,
    );
  });

  it("has exactly one interruption, the inline needs-you card, with two answers", () => {
    expect(screenSource.match(/data-needs-you/g)).toHaveLength(1);
    expect(screenSource).not.toMatch(/aria-modal|role="dialog"/);
    expect(screenSource).toMatch(/Yes, go ahead/);
    expect(screenSource).toMatch(/>\s*No\s*</);
  });
});
