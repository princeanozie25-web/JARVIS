// SHOWCASE INVARIANTS — I-SHOW-1..6.
//
// The showcase is the UNCHAINED presentation layer; these tests pin the one
// thing that makes the unchaining safe (it cannot touch state) and the one
// thing that makes it valuable (what it renders is real, or honestly
// labelled). Node-env suite: source scans + pure builders + static markup,
// per the repo's testing conventions.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShowcaseShell } from "@/components/showcase/ShowcaseShell";
import { TONE_HEX } from "@/components/showcase/CinematicEngine";
import type { WorkingCommandCenterModel } from "@/lib/command-center/liquid-command-center-data";
import {
  GATE_NODE_ID,
  buildOperatingMapScene,
  type OperatingMapInputs,
} from "@/lib/showcase/operating-map-scene";
import { layoutScene, type SceneDescription } from "@/lib/showcase/scene";
import type { CockpitWorkflowbox } from "@/app/working/workflowbox-live";
import { syntheticCockpitVoiceView } from "@/components/working/voice-view";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

function walk(root: string, exts: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

const SHOWCASE_ROOTS = [
  resolve(repoRoot, "src", "lib", "showcase"),
  resolve(repoRoot, "src", "components", "showcase"),
  resolve(repoRoot, "src", "app", "showcase"),
  resolve(repoRoot, "app", "showcase"),
];

function showcaseSources(): ReadonlyArray<{ file: string; text: string }> {
  return SHOWCASE_ROOTS.flatMap((root) =>
    walk(root, [".ts", ".tsx", ".css"]).map((file) => ({
      file,
      text: readFileSync(file, "utf8"),
    })),
  );
}

// --- fixtures ---------------------------------------------------------------

function modelFixture(): WorkingCommandCenterModel {
  return {
    marker: "SYNTHETIC - METADATA-ONLY",
    gateCount: 1,
    phase: "Expansion Era - post-Phase-24",
    testCount: "full suite gated in-hook",
    chat: {
      operator: "Can you set the office for deep work?",
      assistant: "I prepared a room proposal in the Human Gate.",
      proposalChip: "PROPOSAL - PROP-ROOM-1842",
    },
    proposal: {
      id: "PROP-ROOM-1842",
      kind: "ROOM.ACTION",
      tier: "T1",
      trustClass: "SAFE_MUTATE",
      title: "Dim desk strip for a focused build session",
      diffBefore: "desk strip - on at 78%",
      diffAfter: "on at 32%",
      expiresIn: "06:58",
      lifecycle: ["dry_run", "approval", "execute", "verify", "audit_event"],
      approvalService: "phase_18_contract",
      executionAvailable: false,
    },
    room: [
      {
        name: "Desk strip",
        zone: "office",
        state: "ON - 78%",
        trustClass: "safe_mutate",
      },
      {
        name: "Door sensor",
        zone: "entry",
        state: "CLOSED",
        trustClass: "observe_only",
      },
    ],
    cost: [{ label: "WEEK", value: "4 model calls", pct: 20 }],
    activity: [
      { ts: "09:28", tag: "PROP", text: "Chat created room proposal" },
    ],
    provenance: { room: "synthetic", cost: "synthetic", activity: "synthetic" },
    voiceActivity: [],
  };
}

function workflowboxFixture(
  provenance: CockpitWorkflowbox["provenance"],
): CockpitWorkflowbox {
  return {
    provenance,
    lane: {
      execute_affordance_present: false,
      approve_affordance_present: false,
      mutation_affordance_present: false,
      any_amber: false,
      projects: [
        {
          id: "proj-capstone",
          title: "Capstone polish",
          goal: "Ship the capstone surfaces",
          rollup_percent: 62,
          node_count: 5,
          nodes: [],
        },
      ],
    },
  };
}

function inputsFixture(): OperatingMapInputs {
  return {
    model: modelFixture(),
    workflowbox: workflowboxFixture("sample"),
    voice: syntheticCockpitVoiceView(),
  };
}

// A trivial SECOND scene — proving the engine surface is scene-agnostic.
const SECOND_SCENE: SceneDescription = {
  id: "second-scene",
  title: "Second scene",
  subtitle: "The same engine, a different graph.",
  centerNodeId: "root",
  nodes: [
    {
      id: "root",
      label: "Root",
      tone: "life",
      state: "active",
      weight: 1,
      ring: 0,
    },
    {
      id: "leaf-a",
      label: "Leaf A",
      tone: "signal",
      state: "calm",
      weight: 0.5,
      ring: 1,
    },
    {
      id: "leaf-b",
      label: "Leaf B",
      tone: "stone",
      state: "empty",
      weight: 0.4,
      ring: 1,
      fill: 0.4,
    },
  ],
  edges: [
    { from: "root", to: "leaf-a", tone: "signal", flow: 0.5 },
    { from: "root", to: "leaf-b", tone: "stone", flow: 0 },
  ],
  provenance: {
    live: false,
    label: "LABELLED SAMPLE — SYNTHETIC FIXTURE",
    sources: ["fixture: test"],
  },
  chips: [{ label: "NODES", value: "3" }],
};

// ===========================================================================
// I-SHOW-1 — display-only / non-mutating
// ===========================================================================
describe("I-SHOW-1 (display-only, non-mutating)", () => {
  it("runtime.runTool production call-site count is UNCHANGED at exactly 2", () => {
    const libRoot = resolve(repoRoot, "src", "lib");
    const files = walk(libRoot, [".ts"]).filter(
      (file) => !file.endsWith(".test.ts"),
    );
    const sites: string[] = [];
    for (const file of files) {
      const matches = readFileSync(file, "utf8").match(/\.runTool\s*\(/g);
      if (matches) for (let i = 0; i < matches.length; i++) sites.push(file);
    }
    expect(sites.length, sites.join(", ")).toBe(2);
    expect(sites.every((s) => s.split(/[\\/]/).includes("chat"))).toBe(true);
  });

  it("the showcase tree has no runTool, no server actions, no mutator imports", () => {
    for (const { file, text } of showcaseSources()) {
      expect(text, file).not.toMatch(/\.runTool\s*\(/);
      expect(text, file).not.toContain('"use server"');
      // Import-level bans (code, not prose): no mutation surface is reachable.
      expect(text, file).not.toMatch(/workflowbox-actions/);
      expect(text, file).not.toMatch(/from "[^"]*mcp-gateway/);
      expect(text, file).not.toMatch(/from "[^"]*approvals/);
      expect(text, file).not.toMatch(/from "[^"]*runtime-commands/);
      expect(text, file).not.toMatch(/approveAction|denyAction|executeAction/);
    }
  });

  it("the rendered surface carries zero interactive affordances (no buttons, no forms)", () => {
    const html = renderToStaticMarkup(
      <ShowcaseShell scene={buildOperatingMapScene(inputsFixture())} />,
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });
});

// ===========================================================================
// I-SHOW-2 — real data or labelled sample
// ===========================================================================
describe("I-SHOW-2 (every value traces to a projection; samples are labelled)", () => {
  it("nodes derive from the real projection fields", () => {
    const inputs = inputsFixture();
    const scene = buildOperatingMapScene(inputs);
    // Devices: one node per room row, trust class steering the tone.
    const desk = scene.nodes.find((n) => n.id === "device-desk-strip");
    const door = scene.nodes.find((n) => n.id === "device-door-sensor");
    expect(desk?.tone).toBe("accent"); // safe_mutate
    expect(door?.tone).toBe("signal"); // observe_only
    // Projects: rollup drives the fill, verbatim.
    const project = scene.nodes.find((n) => n.id === "project-proj-capstone");
    expect(project?.fill).toBeCloseTo(0.62);
    expect(project?.sublabel).toContain("62%");
    // Lifecycle stages come off the proposal, in order.
    const stageIds = scene.nodes
      .filter((n) => n.id.startsWith("stage-"))
      .map((n) => n.id);
    expect(stageIds).toEqual([
      "stage-dry_run",
      "stage-approval",
      "stage-execute",
      "stage-verify",
      "stage-audit_event",
    ]);
  });

  it("all-synthetic inputs render the labelled-sample badge, never fake-as-real", () => {
    const scene = buildOperatingMapScene(inputsFixture());
    expect(scene.provenance.live).toBe(false);
    expect(scene.provenance.label).toContain("SAMPLE");
    const html = renderToStaticMarkup(<ShowcaseShell scene={scene} />);
    expect(html).toContain("SAMPLE");
    expect(html).toContain('data-showcase-provenance="sample"');
  });

  it("mixed inputs say MIXED; the badge only claims live when everything is", () => {
    const mixed = buildOperatingMapScene({
      ...inputsFixture(),
      workflowbox: workflowboxFixture("live"),
    });
    expect(mixed.provenance.live).toBe(false);
    expect(mixed.provenance.label).toContain("MIXED");
    expect(mixed.provenance.sources.join("\n")).toContain(
      "workflowbox: live store",
    );
  });
});

// ===========================================================================
// I-SHOW-3 — the Gate at the center, reflecting real pending state
// ===========================================================================
describe("I-SHOW-3 (Gate at center)", () => {
  it("the Human Gate is the center node and pulses for a REAL pending proposal", () => {
    const scene = buildOperatingMapScene(inputsFixture());
    expect(scene.centerNodeId).toBe(GATE_NODE_ID);
    const gate = scene.nodes.find((n) => n.id === GATE_NODE_ID);
    expect(gate?.tone).toBe("gate");
    expect(gate?.state).toBe("pending");
    expect(gate?.sublabel).toBe("PROP-ROOM-1842");
    // The amber thread: chat -> gate flows at full while pending.
    const thread = scene.edges.find(
      (e) => e.from === "surface-chat" && e.to === GATE_NODE_ID,
    );
    expect(thread?.tone).toBe("gate");
    expect(thread?.flow).toBeGreaterThan(0.8);
  });

  it("amber is the Gate's alone — no non-gate node wears the gate tone", () => {
    const scene = buildOperatingMapScene(inputsFixture());
    const amberNodes = scene.nodes.filter((n) => n.tone === "gate");
    // The Gate itself + the approval lifecycle stage (Gate-touching by law).
    expect(amberNodes.map((n) => n.id).sort()).toEqual([
      GATE_NODE_ID,
      "stage-approval",
    ]);
  });
});

// ===========================================================================
// I-SHOW-4 — the engine is scene-agnostic
// ===========================================================================
describe("I-SHOW-4 (engine reusable — scene 2 drops in)", () => {
  it("a second, unrelated scene lays out and renders through the SAME surface", () => {
    const positions = layoutScene(SECOND_SCENE);
    expect(positions.map((p) => p.id).sort()).toEqual([
      "leaf-a",
      "leaf-b",
      "root",
    ]);
    const html = renderToStaticMarkup(<ShowcaseShell scene={SECOND_SCENE} />);
    expect(html).toContain("Second scene");
    expect(html).toContain("Leaf A");
    expect(html).toContain("Leaf B");
    expect(html).toContain('data-showcase-scene="second-scene"');
  });

  it("the layout is deterministic (same scene, same positions)", () => {
    expect(layoutScene(SECOND_SCENE)).toEqual(layoutScene(SECOND_SCENE));
  });
});

// ===========================================================================
// I-SHOW-6 — grace: never blank, calm variant exists
// ===========================================================================
describe("I-SHOW-6 (grace)", () => {
  it("first paint / no-WebGL renders the DOM constellation — never a blank field", () => {
    const scene = buildOperatingMapScene(inputsFixture());
    const html = renderToStaticMarkup(<ShowcaseShell scene={scene} />);
    expect(html).toContain('data-showcase-renderer="dom-fallback"');
    expect(html).toContain("Human Gate");
    expect(html).toContain("WorkflowBox");
    expect(html).toContain("Desk strip");
  });

  it("prefers-reduced-motion selects the calm variant (an option, not a stop)", () => {
    const shell = readFileSync(
      resolve(repoRoot, "src", "components", "showcase", "ShowcaseShell.tsx"),
      "utf8",
    );
    expect(shell).toContain("prefers-reduced-motion");
    expect(shell).toContain('data-showcase-motion={calm ? "calm" : "full"}');
    const engine = readFileSync(
      resolve(repoRoot, "src", "components", "showcase", "CinematicEngine.tsx"),
      "utf8",
    );
    // Every animated system branches on the calm flag.
    expect(engine).toContain("calm: boolean");
    expect((engine.match(/calm/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("the engine's tone palette is the documented design-language DNA", () => {
    const designDoc = readFileSync(
      resolve(repoRoot, "docs", "capstone", "JARVIS_DESIGN_LANGUAGE.md"),
      "utf8",
    );
    // Amber stays the Gate's; the life/evidence/accent tones are the shell
    // registers and base roles the language documents.
    expect(designDoc).toContain(TONE_HEX.gate); // #ffb24d — shell gate
    expect(designDoc.toLowerCase()).toContain(
      TONE_HEX.signal.toLowerCase(), // #5fe6e0 — shell signal
    );
    expect(designDoc.toLowerCase()).toContain(
      TONE_HEX.accent.toLowerCase(), // #86bcff — shell accent
    );
  });
});
