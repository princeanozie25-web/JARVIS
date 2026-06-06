export type CosmicGalaxyId =
  | "space"
  | "time"
  | "mind"
  | "soul"
  | "reality"
  | "power";

export type CosmicPoint = Readonly<{
  x: number;
  y: number;
}>;

export type CosmicOrbitNode = Readonly<{
  label: string;
  summary: string;
  glyph: string;
}>;

export type CosmicGalaxy = Readonly<{
  id: CosmicGalaxyId;
  label: string;
  title: string;
  subtitle: string;
  status: string;
  flow: string;
  colorToken: string;
  accentToken: string;
  deepToken: string;
  position: CosmicPoint;
  focusScale: number;
  radius: number;
  stoneType: string;
  glyph: string;
  orbitNodes: readonly CosmicOrbitNode[];
  description: string;
}>;

export type CosmicPipelinePath = Readonly<{
  id: string;
  from: CosmicPoint;
  to: CosmicPoint;
  packets: number;
}>;

export const COSMIC_WORLD = Object.freeze({
  width: 5600,
  height: 3900,
  overviewScale: 0.23,
  minScale: 0.18,
  maxScale: 1.36,
});

export const COSMIC_REFERENCE_ASSET =
  "/assets/cosmic-gauntlet/cosmic-gauntlet-reference.png";

export const TIME_STONE_REFERENCE_ASSET =
  "/assets/cosmic-gauntlet/prototype/time-stone-galaxy-reference.png";

export const NASA_M83_GALAXY_CLOUD_ASSET =
  "/assets/cosmic-gauntlet/prototype/nasa-m83-galaxy-cloud.jpg";

export const HUMAN_GATE = Object.freeze({
  id: "human-gate",
  label: "Human Gate",
  title: "Human Gate Authority Core",
  subtitle: "Sovereign gravity well",
  position: Object.freeze({ x: 2800, y: 1960 }),
  focusScale: 0.62,
  radius: 1340,
  colorToken: "#ffd45c",
  accentToken: "#fff5b5",
  description:
    "The golden authority crystal is larger than every stone and pulls every galaxy into a human-governed orbit.",
});

const node = (label: string, summary: string, glyph: string): CosmicOrbitNode =>
  Object.freeze({ label, summary, glyph });

export const COSMIC_GAUNTLET_GALAXIES: readonly CosmicGalaxy[] = Object.freeze([
  Object.freeze({
    id: "time",
    label: "Time",
    title: "Time Stone Galaxy",
    subtitle: "Agent coordination realm",
    status: "Nominal",
    flow: "Stable",
    colorToken: "#6dff66",
    accentToken: "#f4ff73",
    deepToken: "#103f19",
    position: Object.freeze({ x: 1480, y: 1020 }),
    focusScale: 0.62,
    radius: 1060,
    stoneType: "molten emerald infinity-stone core",
    glyph: "T",
    orbitNodes: Object.freeze([
      node("Agent Coordinator", "Orchestrates agents and task routing", "AC"),
      node("Life Coach", "Personal growth and well-being guidance", "LC"),
      node("Build Monitor", "Tracks builds and engineering tasks", "BM"),
      node("Research", "Information discovery and knowledge sourcing", "RS"),
      node("Job Scout", "Opportunities and career pathing", "JS"),
      node("Cost Monitor", "Tracks spend, usage, and financial health", "CM"),
      node("Deadline Watcher", "Monitors due dates and commitments", "DW"),
    ]),
    description:
      "Green and yellow internal plasma veins rotate through a cloudy coordination spiral.",
  }),
  Object.freeze({
    id: "mind",
    label: "Mind",
    title: "Mind Stone Galaxy",
    subtitle: "Council cognition realm",
    status: "Synthesis",
    flow: "Thinking",
    colorToken: "#b875ff",
    accentToken: "#ffd66f",
    deepToken: "#291145",
    position: Object.freeze({ x: 3980, y: 980 }),
    focusScale: 0.6,
    radius: 1050,
    stoneType: "molten violet and gold cognition stone",
    glyph: "M",
    orbitNodes: Object.freeze([
      node("Council Orchestrator", "Frames the multi-model debate", "CO"),
      node("Claude", "Long-form reasoning lane", "CL"),
      node("GPT", "Creative synthesis lane", "GP"),
      node("Gemini", "Context expansion lane", "GM"),
      node("DeepSeek", "Analytical counterweight", "DS"),
      node("Local Model", "Private low-latency cognition", "LM"),
      node("Synthesis Output", "Distills consensus into action", "SO"),
    ]),
    description:
      "A violet thought nebula with gold cognition pressure and council satellites crossing the field.",
  }),
  Object.freeze({
    id: "space",
    label: "Space",
    title: "Space Stone Galaxy",
    subtitle: "Tesseract pipeline realm",
    status: "Routing",
    flow: "Streaming",
    colorToken: "#31a8ff",
    accentToken: "#b9f7ff",
    deepToken: "#05264d",
    position: Object.freeze({ x: 1040, y: 2390 }),
    focusScale: 0.62,
    radius: 1120,
    stoneType: "molten blue tesseract cube",
    glyph: "S",
    orbitNodes: Object.freeze([
      node("Input Gateway", "Receives raw intent", "IG"),
      node("Intent Classifier", "Sorts user meaning", "IC"),
      node("Safety Classifier", "Checks route safety", "SC"),
      node("Router", "Chooses the execution lane", "RT"),
      node("Tier 0-4", "Maps model/runtime tier", "T4"),
      node("Tool Runtime", "Connects callable tools", "TR"),
      node("Audit Store", "Records metadata safely", "AS"),
    ]),
    description:
      "The Space Stone is the live blue tesseract: every packet lane bends through its cube field.",
  }),
  Object.freeze({
    id: "soul",
    label: "Soul",
    title: "Soul Stone Galaxy",
    subtitle: "Memory pressure realm",
    status: "Compounding",
    flow: "Deepening",
    colorToken: "#ff9b2d",
    accentToken: "#ffe66d",
    deepToken: "#4b2108",
    position: Object.freeze({ x: 3120, y: 3000 }),
    focusScale: 0.6,
    radius: 1110,
    stoneType: "molten amber memory stone",
    glyph: "So",
    orbitNodes: Object.freeze([
      node("Obsidian Vault", "Stores durable written knowledge", "OV"),
      node("Vector DB", "Indexes semantic recall", "VD"),
      node("Knowledge Compounding", "Turns sessions into leverage", "KC"),
      node("Session Memory", "Preserves useful continuity", "SM"),
      node("Project Intelligence", "Tracks project-specific state", "PI"),
      node("Vault Bridge", "Connects memory to action", "VB"),
    ]),
    description:
      "Molten amber fire and memory veins compress knowledge under pressure.",
  }),
  Object.freeze({
    id: "reality",
    label: "Reality",
    title: "Reality Stone Galaxy",
    subtitle: "Physical-world realm",
    status: "Anchored",
    flow: "Live",
    colorToken: "#63f6ff",
    accentToken: "#ffffff",
    deepToken: "#063947",
    position: Object.freeze({ x: 4710, y: 2470 }),
    focusScale: 0.6,
    radius: 1050,
    stoneType: "molten cyan electric stone",
    glyph: "R",
    orbitNodes: Object.freeze([
      node("Room Registry", "Maps spaces and capabilities", "RR"),
      node("Hue Bridge", "Controls light state", "HB"),
      node("Nanoleaf", "Coordinates panel scenes", "NL"),
      node("RuView", "Surfaces local reality context", "RV"),
      node("Theme Engine", "Shapes environmental tone", "TE"),
      node("Sensors", "Reads the physical edge", "SN"),
    ]),
    description:
      "Cyan-white distortion and controlled lightning bind devices into a navigable world.",
  }),
  Object.freeze({
    id: "power",
    label: "Power",
    title: "Power Stone Galaxy",
    subtitle: "Reactor governance realm",
    status: "Contained",
    flow: "Charged",
    colorToken: "#ff365e",
    accentToken: "#be6cff",
    deepToken: "#4a0714",
    position: Object.freeze({ x: 4520, y: 3460 }),
    focusScale: 0.61,
    radius: 1020,
    stoneType: "molten red violet fortress stone",
    glyph: "P",
    orbitNodes: Object.freeze([
      node("Architecture Graph", "Shows structural dependencies", "AG"),
      node("Telemetry Cockpit", "Reads runtime signals", "TC"),
      node("Governance Visualizer", "Makes boundaries visible", "GV"),
      node("CAI Sandbox", "Contains dangerous tests", "CS"),
      node("Execution Gate", "Locks action behind authority", "EG"),
      node("Containment Lock", "Keeps pressure controlled", "CL"),
    ]),
    description:
      "A red-violet reactor field where dangerous pressure is visible and contained.",
  }),
]);

export const COSMIC_PIPELINE_PATHS: readonly CosmicPipelinePath[] =
  Object.freeze(
    COSMIC_GAUNTLET_GALAXIES.map((galaxy, index) =>
      Object.freeze({
        id: `${galaxy.id}-to-human-gate`,
        from: galaxy.position,
        to: HUMAN_GATE.position,
        packets: index % 2 === 0 ? 6 : 5,
      }),
    ),
  );

export const CINEMATIC_PROTOTYPE_CONTRACT = Object.freeze({
  route: "/cosmic-gauntlet-prototype",
  priority: "scale-depth-wonder-before-labeling",
  sceneIntent: "interactive science-fiction film interface",
  visualReference: "time-stone-galaxy-minimum-bar",
  navigationModel: "google-maps-for-a-cosmic-ai-system",
  isolated: true,
  readOnly: true,
  executionControls: false,
  approvalControls: false,
  mutationControls: false,
  reducedMotionFallback: true,
});

export const EXTERNAL_FIDELITY_RESEARCH = Object.freeze([
  Object.freeze({
    name: "Spline",
    status: "not installed",
    use: "browser-native 3D scene authoring and embeddable camera states",
  }),
  Object.freeze({
    name: "Blender",
    status: "not installed",
    use: "custom faceted crystal GLB generation and material baking",
  }),
  Object.freeze({
    name: "GSAP",
    status: "not installed",
    use: "cinematic camera tweening",
  }),
  Object.freeze({
    name: "Theatre.js",
    status: "not installed",
    use: "shot-based camera choreography",
  }),
  Object.freeze({
    name: "Three.js / R3F / Drei / Postprocessing",
    status: "installed",
    use: "available path for WebGL bloom, particles, depth, and shaders",
  }),
]);
