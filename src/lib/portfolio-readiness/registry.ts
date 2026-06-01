import {
  PORTFOLIO_READINESS_CATEGORIES,
  PORTFOLIO_READINESS_CONTRACT_VERSION,
  DemoReadinessSurfaceSchema,
  PortfolioReadinessAreaSchema,
  PortfolioReadinessContractSchema,
  PortfolioReadinessNarrativeSchema,
  PortfolioReadinessSummarySchema,
  type DemoReadinessSurface,
  type PortfolioReadinessArea,
  type PortfolioReadinessCategory,
  type PortfolioReadinessContract,
  type PortfolioReadinessNarrative,
  type PortfolioReadinessPosture,
  type PortfolioReadinessSummary,
} from "./contracts";
import { buildPhase20ACloseoutReport } from "../final-system-status";
import { buildPhase20BCloseoutReport } from "../bootstrap-readiness";
import { buildPhase20CCloseoutReport } from "../onboarding-readiness";

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

const PORTFOLIO_AREAS = [
  {
    area_id: "portfolio-area:architecture-visibility",
    label: "Architecture visibility",
    category: "portfolio_area",
    visibility_goal:
      "Show the architecture graph and operationalization story without turning graph metadata into execution.",
    evidence_ids: [
      "phase-19a:architecture-graph",
      "phase-20a1:final-system-status-registry",
    ],
    recruiter_relevance:
      "Demonstrates systems thinking, subsystem boundaries, and final integration discipline.",
    demo_relevance:
      "Supports a walkthrough of how JARVIS is composed without running new flows.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:governance-visibility",
    label: "Governance visibility",
    category: "portfolio_area",
    visibility_goal:
      "Make approval, disabled-feature, authority, and governance posture easy to explain.",
    evidence_ids: [
      "phase-18:approval-gated-execution-layer",
      "phase-20a5:final-governance-readiness-summary",
    ],
    recruiter_relevance:
      "Highlights safety engineering and authority-boundary design.",
    demo_relevance:
      "Supports explaining why high-risk actions remain gated or disabled.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:command-center-visibility",
    label: "Command Center visibility",
    category: "portfolio_area",
    visibility_goal:
      "Expose the Command Center as an observable operational surface without adding new routes.",
    evidence_ids: ["phase-12:command-center-ui"],
    recruiter_relevance:
      "Shows product thinking around operational workflows and auditability.",
    demo_relevance:
      "Provides a visible anchor for a guided demo using existing UI surfaces.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:room-os-visibility",
    label: "Room OS visibility",
    category: "portfolio_area",
    visibility_goal:
      "Represent Room OS and fake-room readiness without activating real devices.",
    evidence_ids: [
      "phase-10:room-os-foundation",
      "phase-20c5:move-in-readiness-checklist",
    ],
    recruiter_relevance:
      "Shows a concrete local assistant domain rather than a generic chatbot shell.",
    demo_relevance: "Anchors fake-room and move-in readiness storytelling.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:model-runtime-visibility",
    label: "Model runtime visibility",
    category: "portfolio_area",
    visibility_goal:
      "Describe local model runtime posture, cloud gating, and provider boundaries.",
    evidence_ids: [
      "phase-13:model-runtime",
      "phase-20a4:authority-surface-inventory",
    ],
    recruiter_relevance:
      "Shows runtime orchestration and provider-boundary awareness.",
    demo_relevance:
      "Explains local-first model readiness without contacting providers.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:voice-runtime-visibility",
    label: "Voice runtime visibility",
    category: "portfolio_area",
    visibility_goal:
      "Describe voice readiness while keeping wake-word, always-listening, and voice-only approval disabled.",
    evidence_ids: [
      "phase-14:voice-runtime",
      "phase-20c5:voice-authorisation-tiers-deferred",
    ],
    recruiter_relevance:
      "Shows multimodal runtime planning and explicit privacy boundaries.",
    demo_relevance:
      "Supports explaining voice readiness without enabling microphone or wake-word behavior.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:vision-runtime-visibility",
    label: "Vision runtime visibility",
    category: "portfolio_area",
    visibility_goal:
      "Describe vision readiness while hidden capture and background camera remain disabled.",
    evidence_ids: ["phase-15:vision-runtime"],
    recruiter_relevance:
      "Shows multimodal system design with capture boundaries.",
    demo_relevance:
      "Supports vision architecture storytelling without activating camera paths.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:approval-runtime-visibility",
    label: "Approval runtime visibility",
    category: "portfolio_area",
    visibility_goal:
      "Make approval-gated execution visible as a governance story, not a bypassable action path.",
    evidence_ids: ["phase-18:approval-gated-execution-layer"],
    recruiter_relevance:
      "Demonstrates how action authority is separated from user-facing intent.",
    demo_relevance: "Explains first-safe-run and final safety reminders.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:observability-visibility",
    label: "Observability visibility",
    category: "portfolio_area",
    visibility_goal:
      "Show telemetry, replay, and cockpit concepts using metadata-only, redaction-aware surfaces.",
    evidence_ids: [
      "phase-19:fortress-upgrades",
      "phase-20a2:final-readiness-report",
    ],
    recruiter_relevance:
      "Shows production-minded instrumentation and audit readiness.",
    demo_relevance:
      "Supports a replay and telemetry walkthrough without raw payload exposure.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:red-team-visibility",
    label: "Red-team visibility",
    category: "portfolio_area",
    visibility_goal:
      "Represent red-team and CAI posture as governed, whitelisted, and non-authoritative.",
    evidence_ids: [
      "phase-19:fortress-upgrades",
      "phase-20a3:final-disabled-feature-matrix",
    ],
    recruiter_relevance:
      "Shows adversarial thinking and defensive product design.",
    demo_relevance:
      "Provides a safe way to explain challenge testing without executing attack flows.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:onboarding-visibility",
    label: "Onboarding visibility",
    category: "portfolio_area",
    visibility_goal:
      "Make clone to first-safe-run onboarding easy to inspect using Phase 20C metadata.",
    evidence_ids: ["phase-20c6:onboarding-readiness-closeout"],
    recruiter_relevance:
      "Shows polished handoff thinking and fresh-machine readiness.",
    demo_relevance:
      "Supports explaining how a reviewer can get oriented without automation.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
  {
    area_id: "portfolio-area:move-in-readiness-visibility",
    label: "Move-in readiness visibility",
    category: "portfolio_area",
    visibility_goal:
      "Show room-ready posture, deferred hardware onboarding, and final approval safety reminder.",
    evidence_ids: ["phase-20c5:move-in-readiness-checklist"],
    recruiter_relevance:
      "Connects technical implementation to a real-world product readiness story.",
    demo_relevance:
      "Frames bedroom or room readiness without enabling real-world control.",
    local_first_relevance: true,
    safety_relevance: true,
    posture: POSTURE,
  },
] satisfies readonly PortfolioReadinessArea[];

const RECRUITER_NARRATIVES = [
  {
    narrative_id: "portfolio-narrative:project",
    label: "Project narrative",
    category: "recruiter_narrative",
    narrative_goal:
      "Explain JARVIS as a local-first room operating system with governed multimodal assistance.",
    evidence_ids: ["phase-20a6:final-readiness-layer-closeout"],
    talking_points: [
      "Local-first assistant operating system, not a thin chatbot wrapper.",
      "Final readiness is expressed as typed metadata rather than ad hoc claims.",
    ],
    recruiter_ready: true,
    posture: POSTURE,
  },
  {
    narrative_id: "portfolio-narrative:architecture",
    label: "Architecture narrative",
    category: "recruiter_narrative",
    narrative_goal:
      "Describe subsystem boundaries, architecture graph visibility, and phase-by-phase operationalization.",
    evidence_ids: [
      "phase-19a:architecture-graph",
      "phase-20a1:final-system-status-registry",
    ],
    talking_points: [
      "Architecture graph separates visibility from execution.",
      "Core phases 10-19 are represented before Phase 20 hardening.",
    ],
    recruiter_ready: true,
    posture: POSTURE,
  },
  {
    narrative_id: "portfolio-narrative:governance",
    label: "Governance narrative",
    category: "recruiter_narrative",
    narrative_goal:
      "Explain approval gating, disabled features, authority inventory, and governance closeout.",
    evidence_ids: [
      "phase-20a3:final-disabled-feature-matrix",
      "phase-20a4:final-authority-surface-inventory",
    ],
    talking_points: [
      "Risky surfaces are documented and intentionally disabled.",
      "Authority-bearing surfaces declare approval and network posture.",
    ],
    recruiter_ready: true,
    posture: POSTURE,
  },
  {
    narrative_id: "portfolio-narrative:technical-complexity",
    label: "Technical complexity narrative",
    category: "recruiter_narrative",
    narrative_goal:
      "Show depth across persistence, UI, model, voice, vision, room adapters, scheduler, approvals, and fortress hardening.",
    evidence_ids: ["phase-20a2:final-readiness-report"],
    talking_points: [
      "The project spans multiple runtime and governance domains.",
      "Phase 20 layers package the complexity into auditable readiness contracts.",
    ],
    recruiter_ready: true,
    posture: POSTURE,
  },
  {
    narrative_id: "portfolio-narrative:safety",
    label: "Safety narrative",
    category: "recruiter_narrative",
    narrative_goal:
      "Explain why JARVIS prioritizes approval, disabled-by-default posture, redaction, and fake-room rehearsal.",
    evidence_ids: [
      "phase-18:approval-gated-execution-layer",
      "phase-20c5:move-in-readiness-checklist",
    ],
    talking_points: [
      "No destructive or real-world action occurs without approval posture.",
      "Real device onboarding remains deferred until hardware and governance are present.",
    ],
    recruiter_ready: true,
    posture: POSTURE,
  },
  {
    narrative_id: "portfolio-narrative:local-first",
    label: "Local-first narrative",
    category: "recruiter_narrative",
    narrative_goal:
      "Describe local-first defaults, cloud-gated posture, and provider-disabled boundaries.",
    evidence_ids: [
      "phase-20b8:bootstrap-readiness-closeout",
      "phase-20a4:final-authority-surface-inventory",
    ],
    talking_points: [
      "Local model, room, voice, and vision readiness are described without provider calls.",
      "Cloud/provider paths remain opt-in, governed, and disabled by default.",
    ],
    recruiter_ready: true,
    posture: POSTURE,
  },
] satisfies readonly PortfolioReadinessNarrative[];

const DEMO_SURFACES = [
  {
    surface_id: "demo-surface:demo-mode-availability",
    label: "Demo mode availability",
    category: "demo_surface",
    surface_goal:
      "Document demo mode as available for future rendering without executing or toggling it here.",
    evidence_ids: ["phase-20c4:onboarding-report:demo-fake-room-readiness"],
    synthetic_data_required: true,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:synthetic-data-posture",
    label: "Synthetic-data posture",
    category: "demo_surface",
    surface_goal:
      "Require synthetic or redacted data for recruiter/demo contexts.",
    evidence_ids: ["phase-20a3:final-disabled-feature-matrix"],
    synthetic_data_required: true,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:fake-room-posture",
    label: "Fake-room posture",
    category: "demo_surface",
    surface_goal:
      "Frame fake-room flows as the safe room demo posture while real hardware remains deferred.",
    evidence_ids: ["phase-20c5:move-in-readiness-checklist"],
    synthetic_data_required: true,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:replay-visibility",
    label: "Replay visibility",
    category: "demo_surface",
    surface_goal:
      "Use replay-safe visibility as future demo material without invoking runtime replay here.",
    evidence_ids: [
      "phase-12:command-center-ui",
      "phase-20a2:final-readiness-report",
    ],
    synthetic_data_required: true,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:architecture-graph-visibility",
    label: "Architecture graph visibility",
    category: "demo_surface",
    surface_goal:
      "Make the architecture graph a future portfolio walkthrough surface, not an execution engine.",
    evidence_ids: ["phase-19a:architecture-graph"],
    synthetic_data_required: false,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:governance-graph-visibility",
    label: "Governance graph visibility",
    category: "demo_surface",
    surface_goal:
      "Expose governance relationships for future explanation without creating authority or bypass paths.",
    evidence_ids: ["phase-20a5:final-governance-readiness-summary"],
    synthetic_data_required: false,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:telemetry-cockpit-visibility",
    label: "Telemetry cockpit visibility",
    category: "demo_surface",
    surface_goal:
      "Represent telemetry cockpit readiness using redacted metadata-only visibility.",
    evidence_ids: [
      "phase-19:fortress-upgrades",
      "phase-20a2:final-readiness-report",
    ],
    synthetic_data_required: true,
    fake_room_safe: true,
    replay_safe: true,
    demo_execution_required: false,
    posture: POSTURE,
  },
] satisfies readonly DemoReadinessSurface[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyContract(
  contract: PortfolioReadinessContract,
): PortfolioReadinessContract {
  return PortfolioReadinessContractSchema.parse(
    JSON.parse(JSON.stringify(contract)),
  );
}

function copyArea(area: PortfolioReadinessArea): PortfolioReadinessArea {
  return PortfolioReadinessAreaSchema.parse(JSON.parse(JSON.stringify(area)));
}

function copyNarrative(
  narrative: PortfolioReadinessNarrative,
): PortfolioReadinessNarrative {
  return PortfolioReadinessNarrativeSchema.parse(
    JSON.parse(JSON.stringify(narrative)),
  );
}

function copyDemoSurface(surface: DemoReadinessSurface): DemoReadinessSurface {
  return DemoReadinessSurfaceSchema.parse(JSON.parse(JSON.stringify(surface)));
}

export const PORTFOLIO_READINESS_CONTRACT = deepFreeze(
  PortfolioReadinessContractSchema.parse({
    contract_version: PORTFOLIO_READINESS_CONTRACT_VERSION,
    contract_id: "phase-20d1-portfolio-readiness-contract",
    phase: "20D.1",
    summary:
      "Metadata-only portfolio readiness contract for recruiter and demo readiness across visibility, narrative, and safe demo surfaces without generating presentations, routes, automation, or runtime behavior.",
    categories: [...PORTFOLIO_READINESS_CATEGORIES],
    portfolio_areas: PORTFOLIO_AREAS,
    recruiter_narratives: RECRUITER_NARRATIVES,
    demo_surfaces: DEMO_SURFACES,
    posture: POSTURE,
  }),
);

export function getPortfolioReadinessContract(): PortfolioReadinessContract {
  const phase20a = buildPhase20ACloseoutReport();
  const phase20b = buildPhase20BCloseoutReport();
  const phase20c = buildPhase20CCloseoutReport();

  if (
    phase20a.verdict !== "pass" ||
    phase20b.verdict !== "passed" ||
    phase20c.verdict !== "passed" ||
    !phase20c.next_phase_ready
  ) {
    throw new Error(
      "Phase 20A/20B/20C readiness prerequisites are not satisfied",
    );
  }

  return copyContract(PORTFOLIO_READINESS_CONTRACT);
}

export function getPortfolioReadinessAreas(): readonly PortfolioReadinessArea[] {
  return PORTFOLIO_READINESS_CONTRACT.portfolio_areas.map(copyArea);
}

export function getPortfolioReadinessNarratives(): readonly PortfolioReadinessNarrative[] {
  return PORTFOLIO_READINESS_CONTRACT.recruiter_narratives.map(copyNarrative);
}

export function getDemoReadinessSurfaces(): readonly DemoReadinessSurface[] {
  return PORTFOLIO_READINESS_CONTRACT.demo_surfaces.map(copyDemoSurface);
}

export function summarizePortfolioReadiness(): PortfolioReadinessSummary {
  const areas = PORTFOLIO_READINESS_CONTRACT.portfolio_areas;
  const narratives = PORTFOLIO_READINESS_CONTRACT.recruiter_narratives;
  const demoSurfaces = PORTFOLIO_READINESS_CONTRACT.demo_surfaces;
  const categoryCounts = {
    portfolio_area: areas.length,
    recruiter_narrative: narratives.length,
    demo_surface: demoSurfaces.length,
  } satisfies Record<PortfolioReadinessCategory, number>;

  return PortfolioReadinessSummarySchema.parse({
    contract_version: PORTFOLIO_READINESS_CONTRACT_VERSION,
    area_count: areas.length,
    narrative_count: narratives.length,
    demo_surface_count: demoSurfaces.length,
    category_counts: categoryCounts,
    local_first_area_count: areas.filter((area) => area.local_first_relevance)
      .length,
    safety_relevant_area_count: areas.filter((area) => area.safety_relevance)
      .length,
    synthetic_data_surface_count: demoSurfaces.filter(
      (surface) => surface.synthetic_data_required,
    ).length,
    fake_room_safe_surface_count: demoSurfaces.filter(
      (surface) => surface.fake_room_safe,
    ).length,
    replay_safe_surface_count: demoSurfaces.filter(
      (surface) => surface.replay_safe,
    ).length,
    recruiter_ready_narrative_count: narratives.filter(
      (narrative) => narrative.recruiter_ready,
    ).length,
    phase20d_contract_only: true,
    phase20d_capability_neutral: true,
    posture: POSTURE,
  });
}
