import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";
import { MOTION_VOCABULARY } from "../../src/lib/design-language/motion-vocabulary";
import { UNTRUSTED_CLIENT_TEXT_LABEL } from "../../src/lib/mcp-gateway/presentation";

// AP-J2 — the Human Gate panel surface pass. The panel is the thesis made
// visible: the only place anything changes, a human decides here, and the
// decision is accountable. These assertions pin the pass: Gate centrality
// (I-APJ2-1), the amber law refined to pending-vs-resolved (I-APJ2-2), the
// EoP-11 trusted/untrusted rendering (I-APJ2-3), the type registers
// (I-APJ2-4), the honest demo verdict (I-APJ2-5), inherited motion only
// (I-APJ2-6), and no behavioral change (I-APJ2-7).

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
const COCKPIT_SOURCE = read(
  "src",
  "components",
  "working",
  "WorkingCockpit.tsx",
);
const DOC = read("docs", "capstone", "JARVIS_DESIGN_LANGUAGE.md");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function cssRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripComments(css)))) {
    rules.push({ selector: match[1].trim(), body: match[2] });
  }
  return rules;
}

const AMBER_MARKERS = [
  "--jcc-amber",
  "--jarvis-shell-gate",
  "--tc-restricted",
  "amber-review",
  "#ffb24d",
  "#ff8a1f",
  "#fbbf24",
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

/* ------------------------------------------------------------------------ *
 * I-APJ2-1 — Gate centrality intact
 * ------------------------------------------------------------------------ */

describe("I-APJ2-1 — the Gate stays the shell's center with the only affordances", () => {
  it("keeps the shell-center declaration and the gate contracts", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain('data-shell-center="human-gate"');
    expect(html).toContain('data-human-gate-panel="true"');
    expect(html).toContain('data-only-path-to-side-effects="true"');
  });

  it("APPROVE/DENY remain the only action affordances in the default shell", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/wc-gate-approve/g)).toHaveLength(1);
    expect(html.match(/wc-gate-deny/g)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ2-2 — the amber law refined: pending amber, resolved calm
 * ------------------------------------------------------------------------ */

describe("I-APJ2-2 — amber marks the PENDING gate; a resolved gate is calm", () => {
  it("the default (pending) gate declares its state", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain('data-gate-state="pending"');
    expect(html).not.toContain('data-gate-state="resolved"');
  });

  it("the resolved-state overrides exist and carry NO amber", () => {
    const resolvedRules = cssRules(LIQUID_CSS).filter((rule) =>
      rule.selector.includes('[data-gate-state="resolved"]'),
    );
    expect(resolvedRules.length).toBeGreaterThanOrEqual(5);
    for (const rule of resolvedRules) {
      expect(
        mentionsAmber(rule.body),
        `amber in resolved-gate rule: ${rule.selector}`,
      ).toBe(false);
    }
  });

  it("the fence is neutral quarantine — no amber, no error tones", () => {
    const fenceRules = cssRules(LIQUID_CSS).filter((rule) =>
      /jcc-gate-fence|jcc-fence-/.test(rule.selector),
    );
    expect(fenceRules.length).toBeGreaterThanOrEqual(3);
    for (const rule of fenceRules) {
      expect(mentionsAmber(rule.body)).toBe(false);
      expect(rule.body).not.toMatch(/--jcc-red|--jarvis-shell-blocked/);
    }
  });

  it("progress fills stay emerald->sky (untouched by the gate pass)", () => {
    const bar = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-bar i",
    );
    expect(bar!.body).toContain("var(--jarvis-color-emerald-local)");
    expect(bar!.body).toContain("var(--jarvis-color-sky-focus)");
    expect(mentionsAmber(bar!.body)).toBe(false);
  });

  it("the exact-amber wash sites consume the token (color-mix over --jcc-amber)", () => {
    const chip = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-chip",
    );
    const gateOnly = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-gate-only",
    );
    expect(chip!.body).toContain("color-mix(in srgb, var(--jcc-amber) 35%");
    expect(gateOnly!.body).toContain("color-mix(in srgb, var(--jcc-amber) 40%");
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ2-3 — EoP-11 rendered: trusted anchor, fenced untrusted
 * ------------------------------------------------------------------------ */

describe("I-APJ2-3 — trusted/untrusted channel separation is rendered", () => {
  it("the trusted server-derived channel is the decision anchor and carries the effect", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    const anchor = html.match(
      /<div class="jcc-gate-anchor" data-gate-channel="server-derived">([\s\S]*?)<\/div>\s*<div class="jcc-gate-fence"/,
    );
    expect(anchor).not.toBeNull();
    expect(anchor![1]).toContain("CANONICAL EFFECT");
    expect(anchor![1]).toContain("SERVER-DERIVED - TRUSTED");
    expect(anchor![1]).toContain("DRY-RUN DIFF");
    expect(anchor![1]).toContain("desk strip - on at 78%");
  });

  it("untrusted client text renders fenced, labelled with the presentation.ts constant", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain('data-gate-channel="untrusted-client"');
    expect(html).toContain('data-render-hardened="true"');
    // the visible label is the DATA-LAYER constant, verbatim (EoP-11)
    expect(UNTRUSTED_CLIENT_TEXT_LABEL).toBe("UNTRUSTED_CLIENT_INPUT");
    expect(html).toContain(UNTRUSTED_CLIENT_TEXT_LABEL);
    // the client framing lives INSIDE the fence, not in the anchor
    const fence = html.match(
      /<div class="jcc-gate-fence"[\s\S]*?<\/div><\/div>/,
    );
    expect(fence).not.toBeNull();
    expect(fence![0]).toContain("Dim desk strip for a focused build session");
  });

  it("untrusted text is never styled as system truth or the model's voice", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    const fence = html.match(
      /<div class="jcc-gate-fence"[\s\S]*?<\/div><\/div>/,
    );
    expect(fence![0]).not.toContain('data-text-register="system-fact"');
    expect(fence![0]).not.toContain('data-text-register="model-voice"');
    // hardening: the fence text is monospaced (EoP-11 render_hardening)
    const fenceText = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-fence-text",
    );
    expect(fenceText!.body).toContain("var(--jarvis-font-mono)");
  });

  it("the cockpit does not import gateway code — the label is mirrored, not wired", () => {
    expect(COCKPIT_SOURCE).not.toContain("mcp-gateway");
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ2-4 — the type registers applied on the panel
 * ------------------------------------------------------------------------ */

describe("I-APJ2-4 — registers: system-fact anchor, mono ids, model-voice reserved", () => {
  it("the canonical effect renders in the system-fact register", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toMatch(/class="jcc-diff" data-text-register="system-fact"/);
  });

  it("ids/meta and the fence label are monospaced", () => {
    for (const selector of [".jcc-prop-meta", ".jcc-fence-label"]) {
      const rule = cssRules(LIQUID_CSS).find((r) => r.selector === selector);
      expect(rule, selector).toBeDefined();
      expect(rule!.body).toMatch(/font-family:\s*var\(--jarvis-font-mono\)/);
    }
  });

  it("model-voice italic stays reserved for JARVIS's chat reply (exactly one, not on the gate)", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/data-text-register="model-voice"/g)).toHaveLength(1);
    const gate = html.match(/data-human-gate-panel[\s\S]*?<\/section>/);
    expect(gate![0]).not.toContain('data-text-register="model-voice"');
  });

  it("the verdict is system-fact roman in the source", () => {
    expect(COCKPIT_SOURCE).toContain('data-text-register="system-fact"');
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ2-5 — the honest demo verdict (SI-3), calm register
 * ------------------------------------------------------------------------ */

describe("I-APJ2-5 — the demo verdict stays honest and calm", () => {
  it("the honest wording is intact; the false audit claim stays absent", () => {
    expect(COCKPIT_SOURCE).toContain("no audit row written");
    expect(COCKPIT_SOURCE).toContain(
      "demo lifecycle simulated - not persisted",
    );
    expect(COCKPIT_SOURCE).toContain("denied in the demo gate - not persisted");
    expect(COCKPIT_SOURCE).not.toMatch(/audit recorded/i);
    expect(COCKPIT_SOURCE).not.toMatch(/approval lifecycle recorded/i);
  });

  it("the verdict renders in calm ink — no success green, no error styling", () => {
    const verdict = cssRules(LIQUID_CSS).find(
      (rule) => rule.selector === ".jcc-resolved-msg",
    );
    expect(verdict).toBeDefined();
    expect(verdict!.body).toContain("color: var(--jcc-txt)");
    expect(verdict!.body).not.toMatch(
      /#cfe|--jcc-green|emerald|--jcc-red|--jarvis-shell-blocked/,
    );
    expect(mentionsAmber(verdict!.body)).toBe(false);
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ2-6 — motion inherited, nothing new
 * ------------------------------------------------------------------------ */

describe("I-APJ2-6 — the panel consumes the inherited motion only", () => {
  it("approve/deny resolves via gateResolve; arrival via gateArrival; exit via calmFade", () => {
    expect(COCKPIT_SOURCE).toContain("gateResolve(");
    expect(COCKPIT_SOURCE).toContain("gateArrival(");
    expect(COCKPIT_SOURCE).toContain("calmFade(");
    expect(COCKPIT_SOURCE).not.toMatch(/\.animate\(\s*\[/);
  });

  it("the vocabulary is still the closed four-beat set — no new primitive", () => {
    expect(Object.keys(MOTION_VOCABULARY).sort()).toEqual([
      "calmFade",
      "gateArrival",
      "gateResolve",
      "measuredFill",
    ]);
  });
});

/* ------------------------------------------------------------------------ *
 * I-APJ2-7 — no behavioral change
 * ------------------------------------------------------------------------ */

describe("I-APJ2-7 — a visual pass changes no behavior", () => {
  it("runtime.runTool still has exactly its two drilled sites", () => {
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

  it("the same truth renders: provenance counts and honest markers unchanged", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html.match(/data-panel-provenance="synthetic"/g)).toHaveLength(4);
    expect(html.match(/data-honest-state="([a-z]+)"/g)).toHaveLength(6);
    expect(html).toContain("TTS - SYNTHETIC");
  });

  it("the design-language doc records the AP-J2 surface pass", () => {
    expect(DOC).toContain("AP-J2 — the Human Gate panel");
    expect(DOC).toContain("UNTRUSTED_CLIENT_INPUT");
    expect(DOC).toContain('data-gate-state="pending"');
  });
});
