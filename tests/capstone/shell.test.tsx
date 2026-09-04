// E-031 — Program U.4 the shell. Invariants:
//  I-U4-1 keyboard map (brief A4) is a pure reducer: 1–5, Escape→Core
//         (palette first), ⌘K, `/`, `A` opens the BOARD (never approves), `M`.
//  I-U4-2 depth never exceeds 2; Escape always ends at depth 0.
//  I-U4-3 presence marks come from the REAL agent registry with static
//         provenance and are never "working" from static metadata.
//  I-U4-4 every control in the shell is navigation: no approve / deny /
//         execute / mutate affordance, no server action, no mutator import.
//  I-U4-5 the five-state empty copy (brief A7) is designed, not blank.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PanelBody, PANEL_COPY } from "@/components/shell/panels";
import { CommandCenterShell } from "@/components/shell/CommandCenterShell";
import { EXPANSION_ERA_AGENT_IDS } from "@/lib/agent-runtime/contract";
import { resolveCoreState } from "@/lib/core";
import {
  INITIAL_SHELL_STATE,
  PILL_ITEMS,
  SHELL_PANELS,
  buildPresenceRail,
  keyToShellAction,
  shellReducer,
  type ShellAction,
  type ShellState,
} from "@/lib/shell";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      out.push(full);
  }
  return out;
}

function run(
  actions: ShellAction[],
  from: ShellState = INITIAL_SHELL_STATE,
): ShellState {
  return actions.reduce(shellReducer, from);
}

describe("I-U4-1 keyboard map", () => {
  it("maps 1–5 to the pill items in brief order", () => {
    expect(PILL_ITEMS.map((p) => p.label)).toEqual([
      "Core",
      "Standup",
      "Board",
      "Rooms",
      "Evidence",
    ]);
    for (const item of PILL_ITEMS) {
      expect(keyToShellAction({ key: item.key })).toEqual({
        type: "go",
        to: item.id,
      });
    }
    expect(run([{ type: "go", to: "standup" }]).panel).toBe("standup");
    expect(
      run([{ type: "go", to: "core" }], {
        ...INITIAL_SHELL_STATE,
        panel: "rooms",
      }).panel,
    ).toBeNull();
  });

  it("⌘K / Ctrl+K opens the palette; Escape closes palette first, then panel", () => {
    expect(keyToShellAction({ key: "k", metaKey: true })).toEqual({
      type: "palette",
      open: true,
    });
    expect(keyToShellAction({ key: "K", ctrlKey: true })).toEqual({
      type: "palette",
      open: true,
    });
    const deep = run([
      { type: "go", to: "board" },
      { type: "palette", open: true },
    ]);
    expect(deep.paletteOpen).toBe(true);
    const one = shellReducer(deep, { type: "escape" });
    expect(one).toMatchObject({ paletteOpen: false, panel: "board" });
    const zero = shellReducer(one, { type: "escape" });
    expect(zero).toMatchObject({ paletteOpen: false, panel: null });
  });

  it("`A` opens the Board — it never approves", () => {
    expect(keyToShellAction({ key: "A" })).toEqual({ type: "open-first-gate" });
    expect(run([{ type: "open-first-gate" }]).panel).toBe("board");
    // code only — comments explain the rule, the code must not implement it
    const code = readFileSync(
      resolve(repoRoot, "src/lib/shell/keymap.ts"),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/approve|deny|execute|resumeApproval/i);
  });

  it("`/` requests composer focus and `M` requests a mic toggle, both consumable", () => {
    expect(keyToShellAction({ key: "/" })).toEqual({ type: "focus-composer" });
    expect(keyToShellAction({ key: "m" })).toEqual({ type: "toggle-mic" });
    const s = run([{ type: "focus-composer" }, { type: "toggle-mic" }]);
    expect(s).toMatchObject({
      composerFocusRequested: true,
      micToggleRequested: true,
    });
    expect(
      run(
        [{ type: "consume-composer-focus" }, { type: "consume-mic-toggle" }],
        s,
      ),
    ).toMatchObject({
      composerFocusRequested: false,
      micToggleRequested: false,
    });
  });

  it("single keys are ignored inside editable fields; modifiers other than ⌘K are ignored", () => {
    expect(keyToShellAction({ key: "2", inEditable: true })).toBeNull();
    expect(keyToShellAction({ key: "a", inEditable: true })).toBeNull();
    expect(keyToShellAction({ key: "Escape", inEditable: true })).toEqual({
      type: "escape",
    });
    expect(keyToShellAction({ key: "3", altKey: true })).toBeNull();
    expect(keyToShellAction({ key: "x" })).toBeNull();
  });
});

describe("I-U4-2 depth", () => {
  it("the shell reports depth 0/1/2 and no state reaches 3", () => {
    const presence = resolveCoreState({ pendingCount: 0, provenance: "live" });
    const html = renderToStaticMarkup(
      <CommandCenterShell presence={presence} agents={buildPresenceRail()}>
        <div data-core-stub="true" />
      </CommandCenterShell>,
    );
    expect(html).toContain('data-shell-depth="0"');
    expect(html).toContain('data-shell-panel="none"');
    expect(html).toContain('data-shell-core="hero"');
    // reducer: the deepest reachable state is panel + palette (depth 2)
    const deepest = run([
      { type: "go", to: "evidence" },
      { type: "palette", open: true },
    ]);
    expect(deepest.panel).toBe("evidence");
    expect(deepest.paletteOpen).toBe(true);
    expect(Object.keys(deepest).sort()).toEqual(
      [
        "composerFocusRequested",
        "micToggleRequested",
        "paletteOpen",
        "panel",
        "theme",
      ].sort(),
    );
  });
});

describe("I-U4-3 presence from the registry", () => {
  it("one mark per registered agent, all asleep, provenance registry", () => {
    const rail = buildPresenceRail();
    expect(rail.map((m) => m.id)).toEqual([...EXPANSION_ERA_AGENT_IDS]);
    for (const mark of rail) {
      expect(mark.state).toBe("sleeping");
      expect(mark.provenance).toBe("registry");
      expect(mark.initials.length).toBeGreaterThan(0);
    }
    const html = renderToStaticMarkup(
      <CommandCenterShell
        presence={resolveCoreState({ pendingCount: 0, provenance: "live" })}
        agents={rail}
      >
        <div />
      </CommandCenterShell>,
    );
    expect(html).toContain('data-presence-provenance="registry"');
    expect(html.match(/data-presence-mark=/g)).toHaveLength(
      EXPANSION_ERA_AGENT_IDS.length,
    );
    expect(html).not.toContain('data-presence-state="working"');
  });
});

describe("I-U4-4 navigation only", () => {
  it("renders the pill nav, rails, ticker, voice pill and spend with honest empty states", () => {
    const html = renderToStaticMarkup(
      <CommandCenterShell
        presence={resolveCoreState({ pendingCount: 0, provenance: "live" })}
        agents={buildPresenceRail()}
      >
        <div />
      </CommandCenterShell>,
    );
    expect(html.match(/data-shell-pill=/g)).toHaveLength(5);
    expect(html).toContain('data-shell-rail="agents"');
    expect(html).toContain('data-shell-rail="rooms"');
    expect(html).toContain('data-shell-ticker-state="empty"');
    expect(html).toContain('data-shell-voice-pill="placeholder"');
    expect(html).toContain('data-shell-spend="no-data"');
    expect(html).toContain('data-shell-authority="none"');
    expect(html).toContain('data-capstone-theme="night"');
  });

  it("no control carries an approve / deny / execute / mutate affordance", () => {
    const html = renderToStaticMarkup(
      <CommandCenterShell
        presence={resolveCoreState({ pendingCount: 2, provenance: "live" })}
        agents={buildPresenceRail()}
      >
        <div />
      </CommandCenterShell>,
    );
    expect(html).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/data-action=|approve|deny|execute|mutate/i);
    expect(html).not.toMatch(/gpt|claude|gemini|deepseek|llama|qwen/i);
  });

  it("the shell tree has no server actions, no runTool, no mutator imports", () => {
    const files = [
      ...walk(resolve(repoRoot, "src/lib/shell")),
      ...walk(resolve(repoRoot, "src/components/shell")),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain('"use server"');
      expect(text, file).not.toMatch(/\.runTool\s*\(/);
      expect(text, file).not.toMatch(/from "[^"]*\/approvals"/);
      expect(text, file).not.toMatch(/from "[^"]*mcp-gateway/);
      expect(text, file).not.toMatch(/from "[^"]*runtime-commands/);
      expect(text, file).not.toMatch(/from "[^"]*workflowbox-actions/);
      expect(text, file).not.toMatch(/fetch\s*\(|WebSocket|EventSource/);
      expect(text, file).not.toMatch(/#[0-9a-f]{6}\b/i); // no raw hex in components
    }
  });

  it("theme toggle changes only the data attribute contract", () => {
    const day = run([{ type: "toggle-theme" }]);
    expect(day.theme).toBe("day");
    expect(run([{ type: "toggle-theme" }], day).theme).toBe("night");
  });
});

describe("I-U4-5 designed empty states (brief A7)", () => {
  it("every panel has title, empty line and hint; evidence links are read-only anchors", () => {
    for (const panel of SHELL_PANELS) {
      expect(PANEL_COPY[panel].empty.length).toBeGreaterThan(0);
      const html = renderToStaticMarkup(<PanelBody panel={panel} />);
      expect(html).toContain(`data-shell-panel-body="${panel}"`);
      expect(html).toContain('data-shell-panel-state="empty"');
      // static markup escapes apostrophes; compare on the first clause
      expect(html).toContain(PANEL_COPY[panel].empty.split(/['’—]/)[0].trim());
      expect(html).not.toMatch(/<button\b|<form\b|<input\b/i);
    }
    expect(PANEL_COPY.standup.empty).toBe("Your agents are quiet.");
    expect(PANEL_COPY.board.empty).toBe("Nothing to decide.");
    const evidence = renderToStaticMarkup(<PanelBody panel="evidence" />);
    expect(evidence).toContain('data-shell-evidence-links="read-only"');
    expect(evidence).toContain('href="/audit/pipeline"');
  });
});
