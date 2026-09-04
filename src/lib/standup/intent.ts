// Program U.5 (E-032) — the composer's three intents (brief A5), parsed by a
// PURE function so the routing can be tested without a DOM.
//   plain text  → the room (JARVIS answers; agents only if @-tagged)
//   @agent …    → summon that agent for one turn
//   /command …  → a command: /room /freeze /digest /theme
// Parsing never executes anything; the shell decides what a command does
// today (honestly: only /theme and /freeze are UI-resolvable in Program U).

export const COMPOSER_COMMANDS = ["room", "freeze", "unfreeze", "digest", "theme"] as const;
export type ComposerCommand = (typeof COMPOSER_COMMANDS)[number];

export type ComposerIntent =
  | { readonly kind: "empty" }
  | { readonly kind: "room"; readonly text: string }
  | { readonly kind: "summon"; readonly agent: string; readonly text: string }
  | { readonly kind: "command"; readonly command: ComposerCommand; readonly args: string }
  | { readonly kind: "unknown-command"; readonly command: string };

export function parseComposerIntent(raw: string): ComposerIntent {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (text.startsWith("/")) {
    const [head, ...rest] = text.slice(1).split(/\s+/);
    const command = (head ?? "").toLowerCase();
    if ((COMPOSER_COMMANDS as readonly string[]).includes(command)) {
      return { kind: "command", command: command as ComposerCommand, args: rest.join(" ") };
    }
    return { kind: "unknown-command", command: command.slice(0, 32) };
  }
  const summon = text.match(/^@([a-z][a-z0-9_-]*)\s*(.*)$/i);
  if (summon) {
    return { kind: "summon", agent: summon[1].toLowerCase(), text: summon[2] ?? "" };
  }
  return { kind: "room", text };
}
