import { z } from "zod";

import {
  PortfolioReadinessPostureSchema,
  type PortfolioReadinessPosture,
} from "./contracts";
import {
  DemoSurfaceIdSchema,
  getDemoSurfaceRegistry,
  type DemoSurfaceId,
} from "./demo-surfaces";
import {
  RecruiterNarrativeIdSchema,
  getRecruiterNarrativeRegistry,
  type RecruiterNarrativeId,
} from "./narratives";

export const DEMO_FLOW_REGISTRY_VERSION = "20D.4" as const;

export const DEMO_FLOW_IDS = [
  "demo-flow:sixty-second-recruiter",
  "demo-flow:three-minute-technical",
  "demo-flow:governance-first",
  "demo-flow:architecture-deep-dive",
  "demo-flow:voice-vision-room",
  "demo-flow:approval-runtime",
  "demo-flow:red-team-safety",
  "demo-flow:onboarding-move-in",
  "demo-flow:expansion-era",
] as const;

export const DEMO_FLOW_AUDIENCES = [
  "recruiter",
  "hiring_manager",
  "technical_interviewer",
  "portfolio_viewer",
] as const;

export const DEMO_FLOW_DURATION_BANDS = [
  "sixty_seconds",
  "three_minutes",
  "five_minutes",
  "deep_dive",
] as const;

export const DEMO_FLOW_OUTCOMES = [
  "recruiter_interest",
  "technical_confidence",
  "governance_confidence",
  "architecture_confidence",
  "move_in_confidence",
  "future_roadmap_confidence",
] as const;

export const DEMO_FLOW_FUTURE_EXPANSION_POSTURES = [
  "not_applicable",
  "future_expansion_metadata_only_not_enabled",
] as const;

export type DemoFlowId = (typeof DEMO_FLOW_IDS)[number];
export type DemoFlowAudience = (typeof DEMO_FLOW_AUDIENCES)[number];
export type DemoFlowDurationBand = (typeof DEMO_FLOW_DURATION_BANDS)[number];
export type DemoFlowOutcomeId = (typeof DEMO_FLOW_OUTCOMES)[number];
export type DemoFlowFutureExpansionPosture =
  (typeof DEMO_FLOW_FUTURE_EXPANSION_POSTURES)[number];

export const DemoFlowIdSchema = z.enum(DEMO_FLOW_IDS);
export const DemoFlowAudienceSchema = z.enum(DEMO_FLOW_AUDIENCES);
export const DemoFlowDurationBandSchema = z.enum(DEMO_FLOW_DURATION_BANDS);
export const DemoFlowOutcomeIdSchema = z.enum(DEMO_FLOW_OUTCOMES);
export const DemoFlowFutureExpansionPostureSchema = z.enum(
  DEMO_FLOW_FUTURE_EXPANSION_POSTURES,
);

export const DemoFlowStepSchema = z.strictObject({
  step_id: z.string().trim().min(1).max(180),
  order: z.number().int().positive(),
  surface_id: DemoSurfaceIdSchema,
  title: z.string().trim().min(1).max(180),
  talk_track: z.string().trim().min(1).max(420),
  metadata_only: z.literal(true),
  executes_demo: z.literal(false),
});

export const DemoFlowOutcomeSchema = z.strictObject({
  outcome_id: DemoFlowOutcomeIdSchema,
  statement: z.string().trim().min(1).max(420),
  metadata_only: z.literal(true),
});

export const DemoFlowSchema = z.strictObject({
  flow_id: DemoFlowIdSchema,
  title: z.string().trim().min(1).max(180),
  audiences: z.array(DemoFlowAudienceSchema).min(1),
  duration_band: DemoFlowDurationBandSchema,
  ordered_surface_ids: z.array(DemoSurfaceIdSchema).min(1),
  ordered_steps: z.array(DemoFlowStepSchema).min(1),
  narrative_ids: z.array(RecruiterNarrativeIdSchema).min(1),
  narrative_posture: z.literal("linked_to_recruiter_narrative_registry"),
  goal: z.string().trim().min(1).max(420),
  opening_pitch: z.string().trim().min(1).max(420),
  proof_points: z.array(z.string().trim().min(1).max(260)).min(1),
  safety_governance_notes: z.array(z.string().trim().min(1).max(320)).min(1),
  deferred_limitation_notes: z.array(z.string().trim().min(1).max(320)),
  future_expansion_posture: DemoFlowFutureExpansionPostureSchema,
  expected_outcome: DemoFlowOutcomeSchema,
  posture: PortfolioReadinessPostureSchema,
});

export const DemoFlowRegistrySchema = z.strictObject({
  registry_version: z.literal(DEMO_FLOW_REGISTRY_VERSION),
  source_narrative_registry_version: z.literal("20D.2"),
  source_demo_surface_registry_version: z.literal("20D.3"),
  registry_id: z.literal("phase-20d4-demo-flow-registry"),
  phase: z.literal("20D.4"),
  flows: z.array(DemoFlowSchema),
  posture: PortfolioReadinessPostureSchema,
});

export const DemoFlowSummarySchema = z.strictObject({
  registry_version: z.literal(DEMO_FLOW_REGISTRY_VERSION),
  flow_count: z.number().int().positive(),
  audience_counts: z.record(
    DemoFlowAudienceSchema,
    z.number().int().nonnegative(),
  ),
  duration_band_counts: z.record(
    DemoFlowDurationBandSchema,
    z.number().int().nonnegative(),
  ),
  future_expansion_flow_count: z.number().int().nonnegative(),
  ordered_step_count: z.number().int().positive(),
  surface_reference_count: z.number().int().positive(),
  narrative_reference_count: z.number().int().positive(),
  proof_point_count: z.number().int().positive(),
  phase20d_demo_flow_registry_only: z.literal(true),
  phase20d_capability_neutral: z.literal(true),
  posture: PortfolioReadinessPostureSchema,
});

export type DemoFlowStep = z.infer<typeof DemoFlowStepSchema>;
export type DemoFlowOutcome = z.infer<typeof DemoFlowOutcomeSchema>;
export type DemoFlow = z.infer<typeof DemoFlowSchema>;
export type DemoFlowRegistry = z.infer<typeof DemoFlowRegistrySchema>;
export type DemoFlowSummary = z.infer<typeof DemoFlowSummarySchema>;

const POSTURE: PortfolioReadinessPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  presentation_generation_enabled: false,
  demo_execution_enabled: false,
  ui_route_created: false,
  automation_enabled: false,
  shell_execution_enabled: false,
  process_spawn_enabled: false,
  filesystem_mutation_enabled: false,
  network_call_enabled: false,
  provider_call_enabled: false,
  runtime_execution_enabled: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function step(
  flowId: DemoFlowId,
  order: number,
  surfaceId: DemoSurfaceId,
  title: string,
  talkTrack: string,
): DemoFlowStep {
  return DemoFlowStepSchema.parse({
    step_id: `${flowId}:step-${order}`,
    order,
    surface_id: surfaceId,
    title,
    talk_track: talkTrack,
    metadata_only: true,
    executes_demo: false,
  });
}

function outcome(
  outcomeId: DemoFlowOutcomeId,
  statement: string,
): DemoFlowOutcome {
  return DemoFlowOutcomeSchema.parse({
    outcome_id: outcomeId,
    statement,
    metadata_only: true,
  });
}

function flow(
  input: Omit<DemoFlow, "ordered_surface_ids" | "posture">,
): DemoFlow {
  return DemoFlowSchema.parse({
    ...input,
    ordered_surface_ids: input.ordered_steps.map((item) => item.surface_id),
    posture: POSTURE,
  });
}

const FLOWS = [
  flow({
    flow_id: "demo-flow:sixty-second-recruiter",
    title: "60-second recruiter demo",
    audiences: ["recruiter", "hiring_manager"],
    duration_band: "sixty_seconds",
    ordered_steps: [
      step(
        "demo-flow:sixty-second-recruiter",
        1,
        "demo-surface:rest-orb",
        "Open with the product signal",
        "Position JARVIS as a calm local-first AI operating system rather than a chatbot wrapper.",
      ),
      step(
        "demo-flow:sixty-second-recruiter",
        2,
        "demo-surface:demo-mode-synthetic-dataset",
        "Name the demo-safe posture",
        "Explain that recruiter-facing examples use synthetic metadata and do not expose source material.",
      ),
      step(
        "demo-flow:sixty-second-recruiter",
        3,
        "demo-surface:architecture-graph",
        "Show system depth",
        "Point to the architecture graph as the map of local-first runtimes, governance, and boundaries.",
      ),
      step(
        "demo-flow:sixty-second-recruiter",
        4,
        "demo-surface:move-in-checklist",
        "Close with move-in readiness",
        "Connect the project to a fresh clone through first safe room-ready rehearsal.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:local-first-ai-operating-system",
      "recruiter-narrative:portfolio-value",
      "recruiter-narrative:bootstrap-onboarding-readiness",
      "recruiter-narrative:room-os",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Give a recruiter a compact, memorable framing of JARVIS as a governed local AI OS.",
    opening_pitch:
      "JARVIS is a local-first room operating system with portfolio-ready governance and demo-safe metadata.",
    proof_points: [
      "Portfolio readiness surfaces are represented without presentation generation.",
      "Move-in readiness and synthetic demo posture make the project reviewable without real-device risk.",
    ],
    safety_governance_notes: [
      "The flow is metadata-only and does not execute demo surfaces.",
      "Synthetic and redacted posture stays explicit before any product story.",
    ],
    deferred_limitation_notes: [
      "Real device onboarding remains deferred until hardware and configuration are present.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "recruiter_interest",
      "The reviewer understands the project identity, safety posture, and why it is portfolio-worthy.",
    ),
  }),
  flow({
    flow_id: "demo-flow:three-minute-technical",
    title: "3-minute technical demo",
    audiences: ["technical_interviewer", "hiring_manager"],
    duration_band: "three_minutes",
    ordered_steps: [
      step(
        "demo-flow:three-minute-technical",
        1,
        "demo-surface:architecture-graph",
        "Start from system boundaries",
        "Use the architecture graph as the backbone for explaining subsystems.",
      ),
      step(
        "demo-flow:three-minute-technical",
        2,
        "demo-surface:runtime-dependency-graph",
        "Explain runtime dependencies",
        "Connect model, voice, vision, scheduler, and onboarding readiness through metadata.",
      ),
      step(
        "demo-flow:three-minute-technical",
        3,
        "demo-surface:model-runtime",
        "Show local model posture",
        "Describe local model readiness while cloud routing remains gated.",
      ),
      step(
        "demo-flow:three-minute-technical",
        4,
        "demo-surface:voice-runtime",
        "Describe voice readiness",
        "Name the voice runtime while wake-word and always-listening remain disabled.",
      ),
      step(
        "demo-flow:three-minute-technical",
        5,
        "demo-surface:vision-runtime",
        "Describe vision readiness",
        "Name vision runtime boundaries without camera execution or hidden capture.",
      ),
      step(
        "demo-flow:three-minute-technical",
        6,
        "demo-surface:approval-lifecycle",
        "Anchor authority",
        "Show how approval separates intent from action authority.",
      ),
      step(
        "demo-flow:three-minute-technical",
        7,
        "demo-surface:telemetry-cockpit",
        "Close with observability",
        "Use telemetry posture to explain replay-safe, redacted operational visibility.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:architecture-graph",
      "recruiter-narrative:local-model-runtime",
      "recruiter-narrative:voice-runtime",
      "recruiter-narrative:vision-runtime",
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:telemetry-cockpit",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Show the technical shape of the system quickly while preserving governance-first boundaries.",
    opening_pitch:
      "The short technical path starts with architecture, walks through runtimes, and ends at approval plus telemetry.",
    proof_points: [
      "The flow references completed runtime and governance surfaces by id.",
      "Every runtime surface remains metadata-only and non-executing.",
    ],
    safety_governance_notes: [
      "No model, voice, vision, scheduler, or approval runtime is invoked.",
      "Authority-bearing concepts are presented through gated or read-only surfaces.",
    ],
    deferred_limitation_notes: [
      "Runtime verification remains a future demo rendering concern, not a 20D.4 capability.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "technical_confidence",
      "The interviewer sees credible architecture depth and understands the runtime boundaries.",
    ),
  }),
  flow({
    flow_id: "demo-flow:governance-first",
    title: "Governance-first demo",
    audiences: ["hiring_manager", "technical_interviewer"],
    duration_band: "three_minutes",
    ordered_steps: [
      step(
        "demo-flow:governance-first",
        1,
        "demo-surface:governance-boundary-visualizer",
        "Lead with boundaries",
        "Frame governance as the first-class system layer.",
      ),
      step(
        "demo-flow:governance-first",
        2,
        "demo-surface:approval-lifecycle",
        "Show approval posture",
        "Explain how execution-capable ideas stay approval-governed.",
      ),
      step(
        "demo-flow:governance-first",
        3,
        "demo-surface:audit-timeline",
        "Show auditability",
        "Use redacted timeline posture to discuss replay-safe evidence.",
      ),
      step(
        "demo-flow:governance-first",
        4,
        "demo-surface:move-in-checklist",
        "End with safety reminders",
        "Connect governance to move-in readiness and final approval posture.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:governance-first-architecture",
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:governance-visualizer",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Demonstrate that safety, redaction, and approval are designed into the system before action.",
    opening_pitch:
      "This path starts where high-trust AI systems should start: what the system is not allowed to do.",
    proof_points: [
      "Governance surfaces reference the Phase 20A authority and disabled-feature posture.",
      "Approval lifecycle is visible without enabling approval bypass or execution.",
    ],
    safety_governance_notes: [
      "Auto-approval and voice-only approval stay disabled.",
      "Audit posture remains redacted and metadata-only.",
    ],
    deferred_limitation_notes: [
      "Real-world actions remain outside this demo flow.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "governance_confidence",
      "The reviewer sees governance as an architecture property, not a late-stage disclaimer.",
    ),
  }),
  flow({
    flow_id: "demo-flow:architecture-deep-dive",
    title: "Architecture deep-dive demo",
    audiences: ["technical_interviewer"],
    duration_band: "deep_dive",
    ordered_steps: [
      step(
        "demo-flow:architecture-deep-dive",
        1,
        "demo-surface:architecture-graph",
        "Map the system",
        "Use the architecture graph to orient phases, layers, and boundaries.",
      ),
      step(
        "demo-flow:architecture-deep-dive",
        2,
        "demo-surface:runtime-dependency-graph",
        "Trace dependencies",
        "Explain how bootstrap readiness and runtime prerequisites stay separate.",
      ),
      step(
        "demo-flow:architecture-deep-dive",
        3,
        "demo-surface:model-runtime",
        "Inspect model posture",
        "Discuss local model readiness and cloud-gated defaults.",
      ),
      step(
        "demo-flow:architecture-deep-dive",
        4,
        "demo-surface:scheduled-assistance",
        "Inspect scheduled assistance",
        "Explain scheduler side-effect constraints and approval-governed routines.",
      ),
      step(
        "demo-flow:architecture-deep-dive",
        5,
        "demo-surface:telemetry-cockpit",
        "Review observability",
        "Close the loop with redacted telemetry and replay-safe evidence.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:architecture-graph",
      "recruiter-narrative:local-model-runtime",
      "recruiter-narrative:local-first-ai-operating-system",
      "recruiter-narrative:telemetry-cockpit",
      "recruiter-narrative:portfolio-value",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Give a technical reviewer enough structure to understand why the system is phase-built and auditable.",
    opening_pitch:
      "The deep dive treats JARVIS as an operating system: graph, runtimes, scheduler, and observability.",
    proof_points: [
      "The flow orders surfaces from architecture to dependency posture to runtime and observability.",
      "Graph visibility remains non-executable and cannot drive tools.",
    ],
    safety_governance_notes: [
      "Graph-driven execution is not enabled.",
      "Scheduler side effects and routine chaining remain disabled or approval-governed.",
    ],
    deferred_limitation_notes: [
      "Performance and packaging hardening are not started by this registry.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "architecture_confidence",
      "The reviewer can follow the architecture and see why boundaries are explicit.",
    ),
  }),
  flow({
    flow_id: "demo-flow:voice-vision-room",
    title: "Voice, vision, and room demo",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    duration_band: "three_minutes",
    ordered_steps: [
      step(
        "demo-flow:voice-vision-room",
        1,
        "demo-surface:fake-room-room-os",
        "Set the room context",
        "Start with a fake room so no hardware or device authority is required.",
      ),
      step(
        "demo-flow:voice-vision-room",
        2,
        "demo-surface:voice-runtime",
        "Explain voice posture",
        "Discuss voice readiness while wake-word, always-listening, and voice-only approval remain disabled.",
      ),
      step(
        "demo-flow:voice-vision-room",
        3,
        "demo-surface:vision-runtime",
        "Explain vision posture",
        "Discuss vision readiness without camera execution or hidden capture.",
      ),
      step(
        "demo-flow:voice-vision-room",
        4,
        "demo-surface:model-runtime",
        "Connect local model posture",
        "Show the local runtime story that connects room, voice, and vision metadata.",
      ),
      step(
        "demo-flow:voice-vision-room",
        5,
        "demo-surface:demo-mode-synthetic-dataset",
        "Keep the demo safe",
        "Close by naming synthetic data as the demo boundary.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:room-os",
      "recruiter-narrative:voice-runtime",
      "recruiter-narrative:vision-runtime",
      "recruiter-narrative:local-model-runtime",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Show the product-facing multimodal idea without touching microphones, cameras, providers, or devices.",
    opening_pitch:
      "This path explains the room OS through fake room metadata, voice posture, vision posture, and local model readiness.",
    proof_points: [
      "Voice and vision are represented as completed runtime phases.",
      "Fake room and synthetic data keep the flow demo-safe.",
    ],
    safety_governance_notes: [
      "No microphone, camera, or room/device action is invoked.",
      "Wake-word, hidden capture, and real Hue onboarding remain deferred.",
    ],
    deferred_limitation_notes: [
      "Voice-authorisation tiers and conversation-mode amendments remain future architecture updates.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "technical_confidence",
      "The reviewer understands the multimodal ambition and its current safety limits.",
    ),
  }),
  flow({
    flow_id: "demo-flow:approval-runtime",
    title: "Approval-runtime demo",
    audiences: ["technical_interviewer", "hiring_manager"],
    duration_band: "three_minutes",
    ordered_steps: [
      step(
        "demo-flow:approval-runtime",
        1,
        "demo-surface:approval-lifecycle",
        "Start with approval lifecycle",
        "Explain intent, approval, and action authority as separate concepts.",
      ),
      step(
        "demo-flow:approval-runtime",
        2,
        "demo-surface:governance-boundary-visualizer",
        "Show authority boundaries",
        "Connect the lifecycle to the authority surface inventory posture.",
      ),
      step(
        "demo-flow:approval-runtime",
        3,
        "demo-surface:audit-timeline",
        "Show evidence posture",
        "Use the timeline as read-only evidence rather than a retry or run surface.",
      ),
      step(
        "demo-flow:approval-runtime",
        4,
        "demo-surface:scheduled-assistance",
        "Discuss routines",
        "Explain scheduled assistance without enabling chaining or side effects.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:governance-first-architecture",
      "recruiter-narrative:command-center-ui",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Make approval-gated execution concrete without creating an execution path.",
    opening_pitch:
      "Approval is the control plane: JARVIS can show intent and evidence without turning visibility into action.",
    proof_points: [
      "Approval lifecycle and scheduler surfaces are linked through governance metadata.",
      "Audit posture does not expose run, retry, or mutate affordances.",
    ],
    safety_governance_notes: [
      "No auto-approval, approval bypass, or routine execution is created.",
      "Command Center visibility remains read-only for this flow.",
    ],
    deferred_limitation_notes: [
      "Real device actions require future configured approval posture outside this metadata registry.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "governance_confidence",
      "The reviewer sees how approval-gated execution would be explained safely in a demo.",
    ),
  }),
  flow({
    flow_id: "demo-flow:red-team-safety",
    title: "Red-team and safety demo",
    audiences: ["technical_interviewer", "hiring_manager"],
    duration_band: "three_minutes",
    ordered_steps: [
      step(
        "demo-flow:red-team-safety",
        1,
        "demo-surface:red-team-sandbox",
        "Introduce adversarial posture",
        "Present red-team readiness as synthetic and sandboxed only.",
      ),
      step(
        "demo-flow:red-team-safety",
        2,
        "demo-surface:telemetry-cockpit",
        "Show observability",
        "Connect safety evaluation to redacted telemetry posture.",
      ),
      step(
        "demo-flow:red-team-safety",
        3,
        "demo-surface:governance-boundary-visualizer",
        "Show boundaries",
        "Name disabled CAI targets, provider escalation, and raw payload exposure.",
      ),
      step(
        "demo-flow:red-team-safety",
        4,
        "demo-surface:audit-timeline",
        "Close with evidence",
        "Use the audit timeline to explain how findings can stay replay-safe.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:red-team-sandbox",
      "recruiter-narrative:telemetry-cockpit",
      "recruiter-narrative:governance-first-architecture",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Show security-minded engineering without enabling scanning, attack execution, or provider escalation.",
    opening_pitch:
      "The red-team story is about bounded evaluation: synthetic, sandboxed, redacted, and governed.",
    proof_points: [
      "Red-team sandbox is a metadata surface with synthetic-only posture.",
      "Telemetry and audit surfaces keep source material excluded.",
    ],
    safety_governance_notes: [
      "CAI non-whitelisted targets remain disabled.",
      "No scanner, exploit runner, provider call, or network action is introduced.",
    ],
    deferred_limitation_notes: [
      "Future security project integration remains future-only narrative metadata.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "governance_confidence",
      "The reviewer sees that safety and red-team value are represented without operational risk.",
    ),
  }),
  flow({
    flow_id: "demo-flow:onboarding-move-in",
    title: "Onboarding and move-in demo",
    audiences: ["recruiter", "portfolio_viewer"],
    duration_band: "three_minutes",
    ordered_steps: [
      step(
        "demo-flow:onboarding-move-in",
        1,
        "demo-surface:doctor-cli-report",
        "Start with bootstrap readiness",
        "Use doctor report metadata as the fresh-machine readiness anchor.",
      ),
      step(
        "demo-flow:onboarding-move-in",
        2,
        "demo-surface:onboarding-report",
        "Show onboarding flow",
        "Explain clone to first-safe-run progress without executing steps.",
      ),
      step(
        "demo-flow:onboarding-move-in",
        3,
        "demo-surface:move-in-checklist",
        "Show room readiness",
        "Use the checklist to connect setup, demo mode, fake room, and final safety.",
      ),
      step(
        "demo-flow:onboarding-move-in",
        4,
        "demo-surface:fake-room-room-os",
        "Close in the fake room",
        "End with a room-shaped rehearsal that stays hardware-free.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:bootstrap-onboarding-readiness",
      "recruiter-narrative:room-os",
      "recruiter-narrative:local-first-ai-operating-system",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Show the path from clone to safe room-ready rehearsal as a portfolio story.",
    opening_pitch:
      "This path demonstrates that JARVIS is not just built; it is ready to be reviewed and moved into a room safely.",
    proof_points: [
      "Doctor, onboarding, and move-in metadata are already completed Phase 20B/20C surfaces.",
      "Fake room posture keeps the story concrete without device authority.",
    ],
    safety_governance_notes: [
      "No installer, shell command, doctor runtime, or onboarding step is executed.",
      "Real Hue/device onboarding remains deferred until hardware and config are present.",
    ],
    deferred_limitation_notes: [
      "Packaging and onboarding automation remain future phases outside 20D.4.",
    ],
    future_expansion_posture: "not_applicable",
    expected_outcome: outcome(
      "move_in_confidence",
      "The reviewer sees a coherent, safe fresh-machine to first-safe-run story.",
    ),
  }),
  flow({
    flow_id: "demo-flow:expansion-era",
    title: "Expansion-era demo narrative",
    audiences: ["hiring_manager", "technical_interviewer", "portfolio_viewer"],
    duration_band: "deep_dive",
    ordered_steps: [
      step(
        "demo-flow:expansion-era",
        1,
        "demo-surface:architecture-graph",
        "Ground future work in architecture",
        "Start future expansion from the existing graph and boundary story.",
      ),
      step(
        "demo-flow:expansion-era",
        2,
        "demo-surface:governance-boundary-visualizer",
        "Keep governance first",
        "Explain that future projects inherit approval, authority, and disabled-feature boundaries.",
      ),
      step(
        "demo-flow:expansion-era",
        3,
        "demo-surface:telemetry-cockpit",
        "Connect observability",
        "Show how future expansion would still need redacted, replay-safe telemetry posture.",
      ),
      step(
        "demo-flow:expansion-era",
        4,
        "demo-surface:demo-mode-synthetic-dataset",
        "End with demo safety",
        "Keep GitNexus, Graphify, LLM Council, Obsidian, and security integration as future metadata only.",
      ),
    ],
    narrative_ids: [
      "recruiter-narrative:future-gitnexus",
      "recruiter-narrative:future-graphify",
      "recruiter-narrative:future-llm-council",
      "recruiter-narrative:future-obsidian",
      "recruiter-narrative:future-security-project-integration",
      "recruiter-narrative:portfolio-value",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    goal: "Present the future expansion era as a governed roadmap rather than current capability.",
    opening_pitch:
      "The expansion-era story shows where JARVIS can go next while making clear that none of it is enabled here.",
    proof_points: [
      "All expansion narratives are already marked future-only in the recruiter narrative registry.",
      "No future system is wired to providers, routes, automations, or execution.",
    ],
    safety_governance_notes: [
      "Future expansion is metadata-only and not enabled.",
      "No repository automation, graph-driven execution, model council routing, vault mutation, or security scanning is created.",
    ],
    deferred_limitation_notes: [
      "GitNexus, Graphify, LLM Council, Obsidian, and security project integration remain future architecture work.",
    ],
    future_expansion_posture: "future_expansion_metadata_only_not_enabled",
    expected_outcome: outcome(
      "future_roadmap_confidence",
      "The reviewer sees an ambitious roadmap with explicit capability-neutral boundaries.",
    ),
  }),
] satisfies readonly DemoFlow[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyFlow(flowRecord: DemoFlow): DemoFlow {
  return DemoFlowSchema.parse(JSON.parse(JSON.stringify(flowRecord)));
}

function copyRegistry(registry: DemoFlowRegistry): DemoFlowRegistry {
  return DemoFlowRegistrySchema.parse(JSON.parse(JSON.stringify(registry)));
}

function assertAlignedWithSourceRegistries(): void {
  const surfaceIds = new Set<DemoSurfaceId>(
    getDemoSurfaceRegistry().surfaces.map((surface) => surface.surface_id),
  );
  const narrativeIds = new Set<RecruiterNarrativeId>(
    getRecruiterNarrativeRegistry().narratives.map(
      (narrative) => narrative.narrative_id,
    ),
  );

  for (const demoFlow of DEMO_FLOW_REGISTRY.flows) {
    for (const stepRecord of demoFlow.ordered_steps) {
      if (!surfaceIds.has(stepRecord.surface_id)) {
        throw new Error(
          `Unknown demo surface for demo flow: ${stepRecord.surface_id}`,
        );
      }
    }

    for (const surfaceId of demoFlow.ordered_surface_ids) {
      if (!surfaceIds.has(surfaceId)) {
        throw new Error(
          `Unknown ordered demo surface for demo flow: ${surfaceId}`,
        );
      }
    }

    for (const narrativeId of demoFlow.narrative_ids) {
      if (!narrativeIds.has(narrativeId)) {
        throw new Error(
          `Unknown recruiter narrative for demo flow: ${narrativeId}`,
        );
      }
    }
  }
}

export const DEMO_FLOW_REGISTRY = deepFreeze(
  DemoFlowRegistrySchema.parse({
    registry_version: DEMO_FLOW_REGISTRY_VERSION,
    source_narrative_registry_version: "20D.2",
    source_demo_surface_registry_version: "20D.3",
    registry_id: "phase-20d4-demo-flow-registry",
    phase: "20D.4",
    flows: FLOWS,
    posture: POSTURE,
  }),
);

export function getDemoFlowRegistry(): DemoFlowRegistry {
  assertAlignedWithSourceRegistries();
  return copyRegistry(DEMO_FLOW_REGISTRY);
}

export function getDemoFlowsByAudience(
  audience: DemoFlowAudience,
): readonly DemoFlow[] {
  return DEMO_FLOW_REGISTRY.flows
    .filter((demoFlow) => demoFlow.audiences.includes(audience))
    .map(copyFlow);
}

export function getDemoFlowsByDurationBand(
  durationBand: DemoFlowDurationBand,
): readonly DemoFlow[] {
  return DEMO_FLOW_REGISTRY.flows
    .filter((demoFlow) => demoFlow.duration_band === durationBand)
    .map(copyFlow);
}

export function getDemoFlowsBySurfaceId(
  surfaceId: DemoSurfaceId,
): readonly DemoFlow[] {
  return DEMO_FLOW_REGISTRY.flows
    .filter((demoFlow) => demoFlow.ordered_surface_ids.includes(surfaceId))
    .map(copyFlow);
}

export function summarizeDemoFlows(): DemoFlowSummary {
  const flows = DEMO_FLOW_REGISTRY.flows;
  const audienceCounts = Object.fromEntries(
    DEMO_FLOW_AUDIENCES.map((audience) => [
      audience,
      flows.filter((demoFlow) => demoFlow.audiences.includes(audience)).length,
    ]),
  ) as Record<DemoFlowAudience, number>;
  const durationBandCounts = Object.fromEntries(
    DEMO_FLOW_DURATION_BANDS.map((durationBand) => [
      durationBand,
      flows.filter((demoFlow) => demoFlow.duration_band === durationBand)
        .length,
    ]),
  ) as Record<DemoFlowDurationBand, number>;

  return DemoFlowSummarySchema.parse({
    registry_version: DEMO_FLOW_REGISTRY_VERSION,
    flow_count: flows.length,
    audience_counts: audienceCounts,
    duration_band_counts: durationBandCounts,
    future_expansion_flow_count: flows.filter(
      (demoFlow) =>
        demoFlow.future_expansion_posture ===
        "future_expansion_metadata_only_not_enabled",
    ).length,
    ordered_step_count: flows.reduce(
      (count, demoFlow) => count + demoFlow.ordered_steps.length,
      0,
    ),
    surface_reference_count: flows.reduce(
      (count, demoFlow) => count + demoFlow.ordered_surface_ids.length,
      0,
    ),
    narrative_reference_count: flows.reduce(
      (count, demoFlow) => count + demoFlow.narrative_ids.length,
      0,
    ),
    proof_point_count: flows.reduce(
      (count, demoFlow) => count + demoFlow.proof_points.length,
      0,
    ),
    phase20d_demo_flow_registry_only: true,
    phase20d_capability_neutral: true,
    posture: POSTURE,
  });
}
