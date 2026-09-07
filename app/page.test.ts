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

  it("is not a chatbot: no bubbles, no placeholder, no typing indicator", () => {
    expect(screenSource).not.toMatch(/placeholder=/i);
    const code = screenSource.replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/bubble|typing…|is typing/i);
    expect(screenSource).not.toMatch(/<select\b/i);
  });

  it("has exactly one interruption, the needs-you sheet, with two answers", () => {
    expect(screenSource.match(/role="dialog"/g)).toHaveLength(1);
    expect(screenSource).toMatch(/Yes, go ahead/);
    expect(screenSource).toMatch(/>\s*No\s*</);
  });
});
