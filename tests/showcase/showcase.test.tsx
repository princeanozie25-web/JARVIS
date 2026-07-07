// SHOWCASE INVARIANTS — I-SHOW-1..6 plus the EXACTNESS LAW (the reference
// frame's copy is the spec and must render verbatim).
//
// The showcase is the unchained presentation layer; these tests pin what
// makes that safe (it cannot touch state) and what makes it correct (the
// reference layout, the real projection-backed data layer, honest
// provenance attributes). Node-env suite: source scans + pure builders +
// static markup, per the repo's testing conventions.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShowcaseShell } from "@/components/showcase/ShowcaseShell";
import { REFERENCE_PALETTE } from "@/components/showcase/CinematicEngine";
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
  ],
  edges: [{ from: "root", to: "leaf-a", tone: "signal", flow: 0.5 }],
  provenance: {
    live: false,
    label: "LABELLED SAMPLE — SYNTHETIC FIXTURE",
    sources: ["fixture: test"],
  },
  chips: [{ label: "NODES", value: "2" }],
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
      expect(text, file).not.toMatch(/workflowbox-actions/);
      expect(text, file).not.toMatch(/from "[^"]*mcp-gateway/);
      expect(text, file).not.toMatch(/from "[^"]*approvals/);
      expect(text, file).not.toMatch(/from "[^"]*runtime-commands/);
      expect(text, file).not.toMatch(/approveAction|denyAction|executeAction/);
    }
  });

  it("the rendered surface carries zero interactive affordances", () => {
    const html = renderToStaticMarkup(
      <ShowcaseShell scene={buildOperatingMapScene(inputsFixture())} />,
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });
});

// ===========================================================================
// THE EXACTNESS LAW — the reference frame's copy renders verbatim
// ===========================================================================
describe("Exactness law (the reference image is the spec)", () => {
  const REFERENCE_STRINGS = [
    "JARVIS CORE",
    "Active · Adaptive · Predictive",
    "HUMAN GATE",
    "Auth: Authorized · Trust 0.98",
    "MEMORY LAYER",
    "Cache · Index · Recall",
    "VOICE RUNTIME",
    "Listening · STT · TTS",
    "COUNCIL",
    "Consensus Engine · Voting",
    "ROOM OS",
    "Devices · IoT · Control",
    "KNOWLEDGE COMPOUNDING",
    "Synthesize · Expand · Evolve",
    "PIPELINE",
    "Automate · Orchestrate · Deliver",
    "AGENT-J01",
    "Morning Brief",
    "AGENT-J02",
    "Job Scout",
    "AGENT-J03",
    "Google Stack Sync",
    "AGENT-J04",
    "Knowledge Compounding",
    "AGENT-J05",
    "Bursar Cost Guard",
    "AGENT-J06",
    "Enterprise Brain Pilot",
    "Running...",
    "LIVE",
    "07 / 07",
    "JARVIS online.",
    "Listening, learning, and building the impossible.",
  ];

  it("every reference string renders", () => {
    const html = renderToStaticMarkup(
      <ShowcaseShell scene={buildOperatingMapScene(inputsFixture())} />,
    );
    for (const text of REFERENCE_STRINGS) {
      expect(html).toContain(
        text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;"),
      );
    }
  });

  it("the plexus palette carries the reference's nine hues", () => {
    expect(Object.keys(REFERENCE_PALETTE).sort()).toEqual(
      [
        "core",
        "council",
        "humanGate",
        "knowledge",
        "memory",
        "pipeline",
        "roomOs",
        "voice",
        "white",
      ].sort(),
    );
  });
});

// ===========================================================================
// I-SHOW-2/3 — the data layer stays real-or-labelled (unchanged builders)
// ===========================================================================
describe("I-SHOW-2/3 (projection-backed data layer unchanged)", () => {
  it("the scene builder still derives from the real projections", () => {
    const scene = buildOperatingMapScene(inputsFixture());
    expect(scene.centerNodeId).toBe(GATE_NODE_ID);
    const gate = scene.nodes.find((n) => n.id === GATE_NODE_ID);
    expect(gate?.state).toBe("pending");
    expect(gate?.sublabel).toBe("PROP-ROOM-1842");
    const project = scene.nodes.find((n) => n.id === "project-proj-capstone");
    expect(project?.fill).toBeCloseTo(0.62);
  });

  it("provenance stays honest and rides the shell as a data attribute", () => {
    const scene = buildOperatingMapScene(inputsFixture());
    expect(scene.provenance.live).toBe(false);
    const html = renderToStaticMarkup(<ShowcaseShell scene={scene} />);
    expect(html).toContain('data-showcase-provenance="sample"');
  });
});

// ===========================================================================
// I-SHOW-4 — scene inputs remain interchangeable at the shell seam
// ===========================================================================
describe("I-SHOW-4 (scene-agnostic seam)", () => {
  it("a second scene renders through the same shell (id on the stage)", () => {
    const html = renderToStaticMarkup(<ShowcaseShell scene={SECOND_SCENE} />);
    expect(html).toContain('data-showcase-scene="second-scene"');
    expect(html).toContain("JARVIS CORE"); // the reference overlay stands
  });

  it("the layout stays deterministic", () => {
    expect(layoutScene(SECOND_SCENE)).toEqual(layoutScene(SECOND_SCENE));
  });
});

// ===========================================================================
// I-SHOW-6 — grace: never blank, calm variant exists
// ===========================================================================
describe("I-SHOW-6 (grace)", () => {
  it("first paint / no-WebGL renders the full overlay — never a blank field", () => {
    const html = renderToStaticMarkup(
      <ShowcaseShell scene={buildOperatingMapScene(inputsFixture())} />,
    );
    expect(html).toContain('data-showcase-renderer="dom-fallback"');
    expect(html).toContain("JARVIS CORE");
    expect(html).toContain("AGENT-J05");
    expect(html).toContain("JARVIS online.");
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
    expect(engine).toContain("calm: boolean");
    expect((engine.match(/calm/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
