import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowLane } from "../../src/components/working/WorkflowLane";
import { SYNTHETIC_WORKFLOW_LANE } from "../../src/components/working/workflow-lane-fixture";
import type { CockpitVoiceView } from "../../src/components/working/voice-view";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import {
  HONEST_STATES,
  honestStateOf,
} from "../../src/lib/design-language/honest-states";
import {
  AMBER_SHELL_REGISTERS,
  jarvisShellRegisters,
  jarvisTypography,
} from "../../src/lib/design-tokens";

// AP-J1 — the design-language / shell pass. These assertions pin the language
// itself: the amber=Gate color law (I-APJ1-1), the closed motion set
// (I-APJ1-2, with tests/motion-vocabulary.test.ts), calm honest states
// (I-APJ1-3), gate centrality + the structural contracts (I-APJ1-4), no
// behavioral change (I-APJ1-5), and the documented system (I-APJ1-6).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), "utf8");
}

const LIQUID_CSS = read(
  "src",
  "components",
  "command-center",
  "liquid-command-center.css",
);
const TOKENS_CSS = read("src", "lib", "design-tokens", "tokens.css");
const LANE_CSS = read("src", "components", "working", "workflow-lane.css");
const MAP_CSS = read("src", "components", "working", "workflow-map.css");
const NAV_CSS = read(
  "src",
  "components",
  "command-center",
  "command-center.css",
);
const COCKPIT_SOURCE = read(
  "src",
  "components",
  "working",
  "WorkingCockpit.tsx",
);
const DOC = read("docs", "capstone", "JARVIS_DESIGN_LANGUAGE.md");

/* ------------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------------ */

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Innermost CSS rules as { selector, body } pairs (media preludes are
 * skipped because their bodies contain braces). */
function cssRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripComments(css)))) {
    rules.push({ selector: match[1].trim(), body: match[2] });
  }
  return rules;
}

/** The amber (Gate hue) family: token names + every raw amber value the
 * cockpit uses. Anything matching these is "amber" under the law. */
const AMBER_MARKERS = [
  "--jcc-amber",
  "--jarvis-shell-gate",
  "--tc-restricted",
  "amber-review",
  "#ffb24d",
  "#ff8a1f",
  "#fbbf24",
  "#f59e0b",
  "255, 150, 40",
  "255, 170, 70",
  "255, 178, 77",
  "255, 180, 90",
  "255, 200, 140",
  "255, 210, 160",
  "255, 220, 160",
  "255, 138, 31",
  "255, 236, 198",
] as const;

function mentionsAmber(text: string): boolean {
  const haystack = text.toLowerCase();
  return AMBER_MARKERS.some((marker) => haystack.includes(marker));
}

/** Gate-touching selectors — the ONLY places amber may appear. The bare
 * `.jcc` selector is the palette-definition block (amber is DEFINED there,
 * bound to the shell-gate register; usage stays gate-scoped). */
const GATE_TOUCHING_SELECTOR =
  /jcc-gate|jcc-chip|jcc-prop|jcc-diff|jcc-expiry|warn\.gate|\.st\.pending|data-voice-reactor-state="approval"/;

function walkSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walkSources(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function emptyLane() {
  return { ...SYNTHETIC_WORKFLOW_LANE, projects: [] };
}

/** The honest degraded picture: the chain head is down and the terminal
 * engine is the live pick — a failover, truthfully reported. */
function liveFailoverVoice(): CockpitVoiceView {
  return {
    provenance: "live",
    selected_provider: "existing-local-runtime",
    failed_over: true,
    providers: [
      { provider_id: "chatterbox-tts-server", ok: false, degraded: true },
      { provider_id: "existing-local-runtime", ok: true, degraded: false },
    ],
    checked_at_ms: 7,
    metadata_only: true,
    read_only: true,
  };
}

/* ------------------------------------------------------------------------ *
 * I-APJ1-1 — the amber law
 * ------------------------------------------------------------------------ */

describe("I-APJ1-1 — amber appears ONLY on Gate-touching elements", () => {
  it("every amber-carrying rule in the shell CSS is gate-scoped (or the palette definition)", () => {
    const offenders = cssRules(LIQUID_CSS)
      .filter((rule) => mentionsAmber(rule.body))
      .filter(
        (rule) =>
          rule.selector !== ".jcc" &&
          !GATE_TOUCHING_SELECTOR.test(rule.selector),
      );
    expect(offenders.map((rule) => rule.selector)).toEqual([]);
  });

  it("a non-gate warn is calm ink; only `warn gate` wears amber", () => {
    const warn = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-pill-value.warn",
    );
    expect(warn).toBeDefined();
    expect(mentionsAmber(warn!.body)).toBe(false);
    expect(warn!.body).toContain("var(--jcc-txt)");

    const warnGate = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-pill-value.warn.gate",
    );
    expect(warnGate).toBeDefined();
    expect(warnGate!.body).toContain("var(--jcc-amber)");
  });

  it("the lane, map, and nav CSS carry no amber at all", () => {
    for (const css of [LANE_CSS, MAP_CSS, NAV_CSS]) {
      expect(mentionsAmber(stripComments(css))).toBe(false);
    }
  });

  it("tokens.css declares raw amber only for the review role, its shell registers, and the DD.0 demo stone", () => {
    const rawAmber = /#(?:ffb24d|ff8a1f|fbbf24|f59e0b)/gi;
    const lines = stripComments(TOKENS_CSS)
      .split("\n")
      .filter((line) => rawAmber.test(line));
    for (const line of lines) {
      expect(line).toMatch(
        /--jarvis-color-amber-review:|--jarvis-shell-gate(-deep)?:|--jarvis-color-stone-mind:/,
      );
    }
  });

  it("progress fills use the emerald->sky base range, never amber or the accent", () => {
    const bar = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-bar i",
    );
    expect(bar).toBeDefined();
    expect(bar!.body).toContain("var(--jarvis-color-emerald-local)");
    expect(bar!.body).toContain("var(--jarvis-color-sky-focus)");
    expect(mentionsAmber(bar!.body)).toBe(false);

    const laneBar = cssRules(LANE_CSS).find(
      (rule) => rule.selector === ".wfl-bar i",
    );
    expect(laneBar).toBeDefined();
    expect(laneBar!.body).toContain("var(--jarvis-color-emerald-local)");
    expect(laneBar!.body).toContain("var(--jarvis-color-sky-focus)");
  });

  it("the GATE pill is the only warn-gate pill in the default shell", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/class="jcc-pill-value warn gate"/g)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ1-2 — the motion budget holds at the shell level
 * ------------------------------------------------------------------------ */

describe("I-APJ1-2 — no ad-hoc animation outside the vocabulary", () => {
  it("the shell keyframes are the documented grandfathered set — nothing new", () => {
    const names = Array.from(
      LIQUID_CSS.matchAll(/@keyframes ([a-z0-9-]+)/g),
      (match) => match[1],
    ).sort();
    expect(names).toEqual(
      [
        "jcc-breathe",
        "jcc-card-in",
        "jcc-core",
        "jcc-dot",
        "jcc-drift1",
        "jcc-drift2",
        "jcc-drift3",
        "jcc-fade-down",
        "jcc-fade-in",
        "jcc-fade-up",
        "jcc-gate-in",
        "jcc-halo",
        "jcc-materialize",
        "jcc-ring",
        "jcc-ripple",
        "jcc-slide-in",
        "jcc-spin",
        "jcc-surge",
        "jcc-sweep",
      ].sort(),
    );
  });

  it("framer-motion is imported only by the motion system, the vocabulary, and the shell", () => {
    const allowed = new Set([
      "src/lib/motion.ts",
      "src/lib/design-language/motion-vocabulary.ts",
      "src/components/working/WorkingCockpit.tsx",
    ]);
    const importers = walkSources(resolve(ROOT, "src"))
      .filter((file) =>
        readFileSync(file, "utf8").includes('from "framer-motion"'),
      )
      .map((file) => file.slice(ROOT.length + 1).replaceAll("\\", "/"));
    for (const importer of importers) {
      expect(
        allowed.has(importer),
        `unexpected framer-motion importer: ${importer}`,
      ).toBe(true);
    }
  });

  it("the shell bars bind the measured-fill beat (reduced motion zeroes it)", () => {
    const bar = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-bar i",
    );
    expect(bar!.body).toContain("var(--jarvis-motion-vocab-fill)");
  });

  it("the shell keeps its blanket reduced-motion kill switch", () => {
    expect(LIQUID_CSS).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(LIQUID_CSS).toMatch(/animation:\s*none\s*!important/);
    expect(LIQUID_CSS).toMatch(/transition:\s*none\s*!important/);
  });

  it("the cockpit consumes the vocabulary (arrival + resolve), not raw animation", () => {
    expect(COCKPIT_SOURCE).toContain("gateArrival(");
    expect(COCKPIT_SOURCE).toContain("gateResolve(");
    expect(COCKPIT_SOURCE).toContain("calmFade(");
    expect(COCKPIT_SOURCE).toContain("useReducedMotion");
    // the old ad-hoc WAAPI flash is gone
    expect(COCKPIT_SOURCE).not.toMatch(/\.animate\(\s*\[/);
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ1-3 — honest states render calm, never error-styled
 * ------------------------------------------------------------------------ */

describe("I-APJ1-3 — honest states are calm", () => {
  it("the default shell marks its honest states from the closed vocabulary", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    const states = Array.from(
      html.matchAll(/data-honest-state="([a-z]+)"/g),
      (match) => match[1],
    );
    // header marker + ROOM/COST/ACTIVITY tags + WorkflowBox label + TTS pill
    expect(states).toHaveLength(6);
    for (const state of states) {
      expect(HONEST_STATES).toContain(state);
    }
    expect(states.every((state) => state === "synthetic")).toBe(true);
    expect((html.match(/jcc-honest/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("the empty lane is an honest state, not an error", () => {
    const html = renderToStaticMarkup(<WorkflowLane model={emptyLane()} />);
    expect(html).toContain('data-honest-state="empty"');
    expect(html).toContain("jcc-honest");
    expect(html).toContain("No projects yet.");
    expect(html).not.toMatch(/error|blocked|deny|warn/i);
  });

  it("a live-but-degraded voice stack renders calm attention — never amber, never error-styled", () => {
    const html = renderToStaticMarkup(
      <WorkingCockpit voiceView={liveFailoverVoice()} />,
    );
    expect(html).toContain("existing-local-runtime (failover)");
    // warn WITHOUT the gate class: calm ink under the amber law
    expect(html).toMatch(
      /class="jcc-pill-value warn"[^>]*>existing-local-runtime \(failover\)/,
    );
    expect(html).toContain('data-honest-state="live"');
  });

  it("the honest-state family styles with stone inks only — no red, no amber, no alarm", () => {
    const familyRules = cssRules(LIQUID_CSS).filter((rule) =>
      rule.selector.includes(".jcc-honest"),
    );
    expect(familyRules.length).toBeGreaterThanOrEqual(3);
    for (const rule of familyRules) {
      expect(mentionsAmber(rule.body)).toBe(false);
      expect(rule.body).not.toMatch(/--jcc-red|--jarvis-shell-blocked|rose/);
    }
    // every state in the vocabulary has a calm rendering
    for (const state of HONEST_STATES) {
      expect(LIQUID_CSS).toContain(`[data-honest-state="${state}"]`);
    }
  });

  it("provenance strings stay honest and the sample lane maps into the vocabulary", () => {
    expect(honestStateOf("sample")).toBe("synthetic");
    expect(honestStateOf("live")).toBe("live");
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain("WORKFLOWBOX - SAMPLE");
    expect(html).toContain("OBSERVABILITY - SYNTHETIC");
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ1-4 — gate centrality + structural contracts
 * ------------------------------------------------------------------------ */

describe("I-APJ1-4 — the Human Gate is the shell's center of gravity", () => {
  it("the work grid declares the gate as its center and the gate keeps its contracts", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain('data-shell-center="human-gate"');
    expect(html).toContain('data-human-gate-panel="true"');
    expect(html).toContain('data-only-path-to-side-effects="true"');
  });

  it("the gate column is the widest flexible track in the shell grid", () => {
    const grid = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-work-grid",
    );
    expect(grid).toBeDefined();
    const tracks = grid!.body.match(
      /grid-template-columns:[^;]*minmax\(0, (\d+(?:\.\d+)?)fr\) minmax\(0, (\d+(?:\.\d+)?)fr\)/,
    );
    expect(tracks).not.toBeNull();
    const chat = Number(tracks![1]);
    const gate = Number(tracks![2]);
    expect(gate).toBeGreaterThan(chat);
  });

  it("the provenance marker is structural: in the header, above the grid, never demoted", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    const marker = html.indexOf("SYNTHETIC - METADATA-ONLY");
    const grid = html.indexOf("jcc-work-grid");
    expect(marker).toBeGreaterThan(-1);
    expect(grid).toBeGreaterThan(-1);
    expect(marker).toBeLessThan(grid);
  });

  it("no-affordance holds: the only buttons in the default shell are the gate's", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/wc-gate-approve/g)).toHaveLength(1);
    expect(html.match(/wc-gate-deny/g)).toHaveLength(1);
    expect(html).not.toMatch(/<input|<select|<textarea/);
    // the read-only + display-only contracts stay declared
    expect(
      html.match(/data-read-only-context-panel=/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(html).toContain('data-mutation-affordance-present="false"');
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ1-5 — no behavioral / provenance change
 * ------------------------------------------------------------------------ */

describe("I-APJ1-5 — a visual slice changes no behavior", () => {
  it("runtime.runTool has exactly its two drilled sites", () => {
    const sites: string[] = [];
    for (const file of walkSources(resolve(ROOT, "src"))) {
      const source = readFileSync(file, "utf8");
      const count = (source.match(/runtime\.runTool\(/g) ?? []).length;
      for (let i = 0; i < count; i += 1) {
        sites.push(file.slice(ROOT.length + 1).replaceAll("\\", "/"));
      }
    }
    expect(sites.sort()).toEqual([
      "src/lib/chat/tool-approvals.ts",
      "src/lib/chat/tool-continuation.ts",
    ]);
  });

  it("the design-language modules are pure view vocabulary — no data, no transport", () => {
    for (const file of [
      "src/lib/design-language/motion-vocabulary.ts",
      "src/lib/design-language/honest-states.ts",
    ]) {
      const source = read(...file.split("/"));
      expect(source).not.toMatch(
        /fetch\(|better-sqlite3|@\/lib\/db|approval-runtime|runTool/,
      );
    }
  });

  it("the cockpit still renders the same truth: provenance counts unchanged", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/data-panel-provenance="synthetic"/g)).toHaveLength(4);
    expect(html).toContain("TTS - SYNTHETIC");
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ1-6 — the system is documented and deliberate
 * ------------------------------------------------------------------------ */

describe("I-APJ1-6 — tokens, registers, and vocabulary are documented", () => {
  it("every shell register is mirrored in tokens.css with its documented value", () => {
    for (const [name, register] of Object.entries(jarvisShellRegisters)) {
      expect(TOKENS_CSS).toContain(
        `--jarvis-shell-${name}: ${register.value};`,
      );
    }
    for (const name of ["glass", "glass-hi", "stroke", "stroke-hi"]) {
      expect(TOKENS_CSS).toContain(`--jarvis-shell-${name}:`);
    }
  });

  it("only the gate registers carry the amber hue, and the cockpit palette resolves through the system", () => {
    expect([...AMBER_SHELL_REGISTERS]).toEqual(["gate", "gate-deep"]);
    const palette = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc",
    );
    expect(palette).toBeDefined();
    expect(palette!.body).toContain("--jcc-amber: var(--jarvis-shell-gate)");
    expect(palette!.body).toContain("--jcc-txt: var(--jarvis-shell-ink)");
    expect(palette!.body).toContain("--jcc-blue: var(--jarvis-shell-accent)");
    expect(palette!.body).toContain("--jcc-red: var(--jarvis-shell-blocked)");
  });

  it("the model-voice register exists and the shell separates it from system fact", () => {
    expect(jarvisTypography.voice.fontStyle).toBe("italic");
    expect(jarvisTypography.voice.fontWeight).toBe(300);
    expect(LIQUID_CSS).toContain('[data-text-register="model-voice"]');
    expect(LIQUID_CSS).toContain('[data-text-register="system-fact"]');

    const html = renderToStaticMarkup(<WorkingCockpit />);
    // exactly one model-voice element in the shell: JARVIS's chat reply
    expect(html.match(/data-text-register="model-voice"/g)).toHaveLength(1);
    // the gate verdict renders as system fact (roman) when it appears
    expect(COCKPIT_SOURCE).toContain('data-text-register="system-fact"');
  });

  it("the design-language doc names the law, the registers, the vocabulary, and the honest states", () => {
    expect(DOC).toContain("Amber = Gate");
    expect(DOC).toContain("model-voice");
    for (const beat of [
      "calmFade",
      "measuredFill",
      "gateResolve",
      "gateArrival",
    ]) {
      expect(DOC).toContain(beat);
    }
    for (const state of HONEST_STATES) {
      expect(DOC).toContain(`\`${state}\``);
    }
    expect(DOC).toContain("data-shell-center");
    expect(DOC).toContain("emerald-local -> sky-focus");
  });
});
