import { z } from "zod";

import {
  DemoReadinessSurfaceIdSchema,
  PortfolioReadinessPostureSchema,
  type DemoReadinessSurfaceId,
  type PortfolioReadinessPosture,
} from "./contracts";
import {
  getDemoReadinessSurfaces,
  getPortfolioReadinessContract,
} from "./registry";

export const RECRUITER_NARRATIVE_REGISTRY_VERSION = "20D.2" as const;

export const RECRUITER_NARRATIVE_AUDIENCES = [
  "recruiter",
  "hiring_manager",
  "technical_interviewer",
  "portfolio_viewer",
] as const;

export const RECRUITER_NARRATIVE_CATEGORIES = [
  "positioning",
  "architecture",
  "governance",
  "runtime",
  "product_surface",
  "observability",
  "readiness",
  "future_expansion",
] as const;

export const RECRUITER_NARRATIVE_PHASE_IDS = [
  "phase-10",
  "phase-11",
  "phase-12",
  "phase-13",
  "phase-14",
  "phase-15",
  "phase-16",
  "phase-17",
  "phase-18",
  "phase-19",
  "phase-19a",
  "phase-20a",
  "phase-20b",
  "phase-20c",
  "phase-20d1",
  "future-expansion",
] as const;

export const RECRUITER_NARRATIVE_FUTURE_POSTURES = [
  "not_applicable",
  "future_expansion_metadata_only_not_enabled",
] as const;

export const RECRUITER_NARRATIVE_IDS = [
  "recruiter-narrative:local-first-ai-operating-system",
  "recruiter-narrative:governance-first-architecture",
  "recruiter-narrative:approval-gated-execution",
  "recruiter-narrative:voice-runtime",
  "recruiter-narrative:vision-runtime",
  "recruiter-narrative:room-os",
  "recruiter-narrative:local-model-runtime",
  "recruiter-narrative:command-center-ui",
  "recruiter-narrative:architecture-graph",
  "recruiter-narrative:governance-visualizer",
  "recruiter-narrative:telemetry-cockpit",
  "recruiter-narrative:red-team-sandbox",
  "recruiter-narrative:bootstrap-onboarding-readiness",
  "recruiter-narrative:portfolio-value",
  "recruiter-narrative:future-gitnexus",
  "recruiter-narrative:future-graphify",
  "recruiter-narrative:future-llm-council",
  "recruiter-narrative:future-obsidian",
  "recruiter-narrative:future-security-project-integration",
] as const;

export type RecruiterNarrativeAudience =
  (typeof RECRUITER_NARRATIVE_AUDIENCES)[number];
export type RecruiterNarrativeCategory =
  (typeof RECRUITER_NARRATIVE_CATEGORIES)[number];
export type RecruiterNarrativePhaseId =
  (typeof RECRUITER_NARRATIVE_PHASE_IDS)[number];
export type RecruiterNarrativeFuturePosture =
  (typeof RECRUITER_NARRATIVE_FUTURE_POSTURES)[number];
export type RecruiterNarrativeId = (typeof RECRUITER_NARRATIVE_IDS)[number];

export const RecruiterNarrativeAudienceSchema = z.enum(
  RECRUITER_NARRATIVE_AUDIENCES,
);
export const RecruiterNarrativeCategorySchema = z.enum(
  RECRUITER_NARRATIVE_CATEGORIES,
);
export const RecruiterNarrativePhaseIdSchema = z.enum(
  RECRUITER_NARRATIVE_PHASE_IDS,
);
export const RecruiterNarrativeFuturePostureSchema = z.enum(
  RECRUITER_NARRATIVE_FUTURE_POSTURES,
);
export const RecruiterNarrativeIdSchema = z.enum(RECRUITER_NARRATIVE_IDS);

export const RecruiterNarrativeProofPointSchema = z.strictObject({
  proof_id: z.string().trim().min(1).max(180),
  label: z.string().trim().min(1).max(180),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  related_phases: z.array(RecruiterNarrativePhaseIdSchema).min(1),
  metadata_only: z.literal(true),
});

export const RecruiterNarrativeSchema = z.strictObject({
  narrative_id: RecruiterNarrativeIdSchema,
  title: z.string().trim().min(1).max(180),
  audiences: z.array(RecruiterNarrativeAudienceSchema).min(1),
  category: RecruiterNarrativeCategorySchema,
  short_summary: z.string().trim().min(1).max(420),
  technical_proof_points: z.array(RecruiterNarrativeProofPointSchema).min(1),
  demo_surface_ids: z.array(DemoReadinessSurfaceIdSchema).min(1),
  recruiter_value: z.string().trim().min(1).max(420),
  risk_safety_posture: z.string().trim().min(1).max(420),
  related_phases: z.array(RecruiterNarrativePhaseIdSchema).min(1),
  future_expansion_posture: RecruiterNarrativeFuturePostureSchema,
  future_expansion_targets: z.array(z.string().trim().min(1).max(120)),
  posture: PortfolioReadinessPostureSchema,
});

export const RecruiterNarrativeRegistrySchema = z.strictObject({
  registry_version: z.literal(RECRUITER_NARRATIVE_REGISTRY_VERSION),
  source_contract_version: z.literal("20D.1"),
  registry_id: z.literal("phase-20d2-recruiter-narrative-registry"),
  phase: z.literal("20D.2"),
  narratives: z.array(RecruiterNarrativeSchema),
  posture: PortfolioReadinessPostureSchema,
});

export const RecruiterNarrativeSummarySchema = z.strictObject({
  registry_version: z.literal(RECRUITER_NARRATIVE_REGISTRY_VERSION),
  narrative_count: z.number().int().positive(),
  category_counts: z.record(
    RecruiterNarrativeCategorySchema,
    z.number().int().nonnegative(),
  ),
  audience_counts: z.record(
    RecruiterNarrativeAudienceSchema,
    z.number().int().nonnegative(),
  ),
  future_expansion_count: z.number().int().nonnegative(),
  proof_point_count: z.number().int().positive(),
  demo_surface_reference_count: z.number().int().positive(),
  phase_reference_count: z.number().int().positive(),
  phase20d_narrative_registry_only: z.literal(true),
  phase20d_capability_neutral: z.literal(true),
  posture: PortfolioReadinessPostureSchema,
});

export type RecruiterNarrativeProofPoint = z.infer<
  typeof RecruiterNarrativeProofPointSchema
>;
export type RecruiterNarrative = z.infer<typeof RecruiterNarrativeSchema>;
export type RecruiterNarrativeRegistry = z.infer<
  typeof RecruiterNarrativeRegistrySchema
>;
export type RecruiterNarrativeSummary = z.infer<
  typeof RecruiterNarrativeSummarySchema
>;

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

function proof(
  proof_id: string,
  label: string,
  evidence_ids: readonly string[],
  related_phases: readonly RecruiterNarrativePhaseId[],
): RecruiterNarrativeProofPoint {
  return RecruiterNarrativeProofPointSchema.parse({
    proof_id,
    label,
    evidence_ids,
    related_phases,
    metadata_only: true,
  });
}

const NARRATIVES = [
  {
    narrative_id: "recruiter-narrative:local-first-ai-operating-system",
    title: "JARVIS as a local-first AI operating system",
    audiences: ["recruiter", "hiring_manager", "portfolio_viewer"],
    category: "positioning",
    short_summary:
      "JARVIS is framed as a local-first room operating system with typed readiness layers, not a thin chatbot wrapper.",
    technical_proof_points: [
      proof(
        "proof:local-first-os:phase-20a",
        "Final readiness registry covers core system phases.",
        ["phase-20a1:final-system-status-registry"],
        ["phase-20a"],
      ),
      proof(
        "proof:local-first-os:phase-20c",
        "Onboarding and move-in readiness close the fresh-machine path.",
        ["phase-20c6:onboarding-readiness-closeout"],
        ["phase-20c"],
      ),
    ],
    demo_surface_ids: ["demo-surface:architecture-graph-visibility"],
    recruiter_value:
      "Shows product-level systems thinking, architecture discipline, and local-first implementation maturity.",
    risk_safety_posture:
      "Local-first posture is preserved; provider, network, and real-world actions remain governed or disabled.",
    related_phases: [
      "phase-10",
      "phase-20a",
      "phase-20b",
      "phase-20c",
      "phase-20d1",
    ],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:governance-first-architecture",
    title: "Governance-first architecture",
    audiences: ["hiring_manager", "technical_interviewer", "portfolio_viewer"],
    category: "governance",
    short_summary:
      "The system makes authority, disabled features, redaction, and approval posture visible before adding capability.",
    technical_proof_points: [
      proof(
        "proof:governance:disabled-matrix",
        "Disabled-feature matrix preserves risky boundaries.",
        ["phase-20a3:final-disabled-feature-matrix"],
        ["phase-20a"],
      ),
      proof(
        "proof:governance:authority-inventory",
        "Authority surfaces are inventoried with approval and network posture.",
        ["phase-20a4:final-authority-surface-inventory"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: ["demo-surface:governance-graph-visibility"],
    recruiter_value:
      "Communicates safety engineering, risk modeling, and production-grade governance instincts.",
    risk_safety_posture:
      "No governance metadata becomes an execution path, and no approval bypass is introduced.",
    related_phases: ["phase-18", "phase-20a", "phase-20d1"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:approval-gated-execution",
    title: "Approval-gated execution",
    audiences: ["technical_interviewer", "hiring_manager"],
    category: "governance",
    short_summary:
      "JARVIS separates intent, approval, and action authority so real-world or destructive execution remains gated.",
    technical_proof_points: [
      proof(
        "proof:approval:phase-18",
        "Approval runtime foundation governs execution posture.",
        ["phase-18:approval-gated-execution-layer"],
        ["phase-18"],
      ),
      proof(
        "proof:approval:move-in-reminder",
        "Move-in checklist keeps final approval safety visible.",
        ["move-in:final-safety-approval-reminder"],
        ["phase-20c"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:governance-graph-visibility",
      "demo-surface:fake-room-posture",
    ],
    recruiter_value:
      "Shows ability to build high-trust systems where action authority is deliberately constrained.",
    risk_safety_posture:
      "No auto-approval, voice-only approval, or routine/device action is enabled by this registry.",
    related_phases: ["phase-18", "phase-20a", "phase-20c"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:voice-runtime",
    title: "Voice runtime",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    category: "runtime",
    short_summary:
      "Voice is presented as a governed runtime with local-first posture and deferred wake-word/conversation-mode expansion.",
    technical_proof_points: [
      proof(
        "proof:voice:runtime",
        "Voice runtime is represented in final authority and readiness metadata.",
        ["phase-14:voice-runtime"],
        ["phase-14"],
      ),
      proof(
        "proof:voice:deferred",
        "Wake-word, conversation-mode, and voice-authorisation tiers remain deferred.",
        [
          "move-in:wake-word-conversation-mode-amendment-deferred",
          "move-in:voice-authorisation-tiers-deferred",
        ],
        ["phase-20c"],
      ),
    ],
    demo_surface_ids: ["demo-surface:synthetic-data-posture"],
    recruiter_value:
      "Shows multimodal ambition without sacrificing privacy, consent, or approval boundaries.",
    risk_safety_posture:
      "Wake word, always-listening, voice-only approval, and continuous conversation are not enabled.",
    related_phases: ["phase-14", "phase-20a", "phase-20c"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:vision-runtime",
    title: "Vision runtime",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    category: "runtime",
    short_summary:
      "Vision readiness is positioned around foreground-only, local-first capture boundaries.",
    technical_proof_points: [
      proof(
        "proof:vision:runtime",
        "Vision runtime is represented as a completed core phase.",
        ["phase-15:vision-runtime"],
        ["phase-15"],
      ),
      proof(
        "proof:vision:disabled-capture",
        "Background camera and hidden capture remain disabled.",
        ["phase-20a3:final-disabled-feature-matrix"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: ["demo-surface:synthetic-data-posture"],
    recruiter_value:
      "Shows multimodal system design with explicit capture and privacy constraints.",
    risk_safety_posture:
      "No camera path, hidden capture, or provider-backed vision execution is introduced.",
    related_phases: ["phase-15", "phase-20a"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:room-os",
    title: "Room OS",
    audiences: ["recruiter", "hiring_manager", "portfolio_viewer"],
    category: "product_surface",
    short_summary:
      "Room OS gives JARVIS a concrete product domain: bedroom/room readiness, fake-room rehearsal, and deferred real hardware.",
    technical_proof_points: [
      proof(
        "proof:room:foundation",
        "Room OS foundation is represented as Phase 10.",
        ["phase-10:room-os-foundation"],
        ["phase-10"],
      ),
      proof(
        "proof:room:move-in",
        "Move-in checklist defines room-ready posture.",
        ["phase-20c5:move-in-readiness-checklist"],
        ["phase-20c"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:fake-room-posture",
      "demo-surface:demo-mode-availability",
    ],
    recruiter_value:
      "Makes the project memorable as a product-shaped local AI operating system.",
    risk_safety_posture:
      "Real Hue/device onboarding remains deferred until hardware, config, and governance are present.",
    related_phases: ["phase-10", "phase-16", "phase-20c"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:local-model-runtime",
    title: "Local model runtime",
    audiences: ["technical_interviewer", "hiring_manager"],
    category: "runtime",
    short_summary:
      "The model runtime narrative emphasizes local-first inference readiness and cloud-gated provider posture.",
    technical_proof_points: [
      proof(
        "proof:model:runtime",
        "Model runtime is represented as a completed core phase.",
        ["phase-13:model-runtime"],
        ["phase-13"],
      ),
      proof(
        "proof:model:bootstrap",
        "Bootstrap readiness describes local model prerequisites.",
        ["phase-20b1:bootstrap-readiness-contract"],
        ["phase-20b"],
      ),
    ],
    demo_surface_ids: ["demo-surface:architecture-graph-visibility"],
    recruiter_value:
      "Shows runtime orchestration skills and pragmatic local AI deployment thinking.",
    risk_safety_posture:
      "No provider call, model invocation, or network default is introduced.",
    related_phases: ["phase-13", "phase-20b", "phase-20a"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:command-center-ui",
    title: "Command Center UI",
    audiences: ["recruiter", "portfolio_viewer", "hiring_manager"],
    category: "product_surface",
    short_summary:
      "Command Center gives the system an operational surface for visibility, audit posture, and demo orientation.",
    technical_proof_points: [
      proof(
        "proof:command-center:phase-12",
        "Command Center UI is represented as a completed core phase.",
        ["phase-12:command-center-ui"],
        ["phase-12"],
      ),
      proof(
        "proof:command-center:no-run",
        "UI run/retry/mutate affordances remain disabled.",
        ["phase-20a3:final-disabled-feature-matrix"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:demo-mode-availability",
      "demo-surface:replay-visibility",
    ],
    recruiter_value:
      "Shows user-facing product ergonomics layered over audit and governance constraints.",
    risk_safety_posture:
      "No UI route or action affordance is created by the narrative registry.",
    related_phases: ["phase-12", "phase-20a", "phase-20d1"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:architecture-graph",
    title: "Architecture graph",
    audiences: ["technical_interviewer", "hiring_manager", "portfolio_viewer"],
    category: "architecture",
    short_summary:
      "The architecture graph makes subsystem boundaries and forbidden edges visible without graph-driven execution.",
    technical_proof_points: [
      proof(
        "proof:architecture-graph:phase-19a",
        "Static architecture graph registry is read-only.",
        ["phase-19a:architecture-graph"],
        ["phase-19a"],
      ),
      proof(
        "proof:architecture-graph:disabled",
        "Graph-driven execution remains disabled.",
        ["phase-20a3:final-disabled-feature-matrix"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: ["demo-surface:architecture-graph-visibility"],
    recruiter_value:
      "Communicates architectural clarity and deep system mapping.",
    risk_safety_posture:
      "The graph is visibility-only and cannot route execution.",
    related_phases: ["phase-19a", "phase-20a"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:governance-visualizer",
    title: "Governance visualizer",
    audiences: ["technical_interviewer", "hiring_manager"],
    category: "governance",
    short_summary:
      "Governance visualization is framed as future-safe visibility into approval, authority, and disabled-feature posture.",
    technical_proof_points: [
      proof(
        "proof:governance-visualizer:summary",
        "Final governance summary answers readiness and neutrality questions.",
        ["phase-20a5:final-governance-readiness-summary"],
        ["phase-20a"],
      ),
      proof(
        "proof:governance-visualizer:authority",
        "Authority inventory documents approval posture.",
        ["phase-20a4:final-authority-surface-inventory"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: ["demo-surface:governance-graph-visibility"],
    recruiter_value:
      "Shows a rare blend of product demo clarity and system safety discipline.",
    risk_safety_posture:
      "Visualization metadata does not create authority, bypass approval, or expose raw payloads.",
    related_phases: ["phase-18", "phase-20a", "phase-20d1"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:telemetry-cockpit",
    title: "Telemetry cockpit",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    category: "observability",
    short_summary:
      "Telemetry cockpit readiness shows redaction-aware observability and replay-safe operational storytelling.",
    technical_proof_points: [
      proof(
        "proof:telemetry:fortress",
        "Fortress upgrades include observability and hardening posture.",
        ["phase-19:fortress-upgrades"],
        ["phase-19"],
      ),
      proof(
        "proof:telemetry:report",
        "Final readiness report includes portfolio and observability relevance.",
        ["phase-20a2:final-readiness-report"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:telemetry-cockpit-visibility",
      "demo-surface:replay-visibility",
    ],
    recruiter_value:
      "Shows production-minded thinking around auditability, telemetry, and redaction.",
    risk_safety_posture: "No raw payload telemetry or UI exposure is allowed.",
    related_phases: ["phase-19", "phase-20a", "phase-20d1"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:red-team-sandbox",
    title: "Red-team sandbox",
    audiences: ["technical_interviewer", "hiring_manager"],
    category: "observability",
    short_summary:
      "The red-team sandbox narrative highlights adversarial testing posture without enabling non-whitelisted CAI targets.",
    technical_proof_points: [
      proof(
        "proof:red-team:fortress",
        "Fortress upgrades capture red-team and CAI posture.",
        ["phase-19:fortress-upgrades"],
        ["phase-19"],
      ),
      proof(
        "proof:red-team:disabled",
        "CAI non-whitelisted targets remain disabled.",
        ["phase-20a3:final-disabled-feature-matrix"],
        ["phase-20a"],
      ),
    ],
    demo_surface_ids: ["demo-surface:synthetic-data-posture"],
    recruiter_value:
      "Signals security-aware engineering and careful adversarial thinking.",
    risk_safety_posture:
      "No attack execution, provider escalation, or non-whitelisted target capability is introduced.",
    related_phases: ["phase-19", "phase-20a"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:bootstrap-onboarding-readiness",
    title: "Bootstrap and onboarding readiness",
    audiences: ["recruiter", "hiring_manager", "portfolio_viewer"],
    category: "readiness",
    short_summary:
      "Bootstrap and onboarding readiness show that the project is explainable, reproducible, and move-in oriented.",
    technical_proof_points: [
      proof(
        "proof:bootstrap:closeout",
        "Bootstrap readiness closeout proves doctor/CLI readiness posture.",
        ["phase-20b8:bootstrap-readiness-closeout"],
        ["phase-20b"],
      ),
      proof(
        "proof:onboarding:closeout",
        "Onboarding closeout proves move-in readiness posture.",
        ["phase-20c6:onboarding-readiness-closeout"],
        ["phase-20c"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:demo-mode-availability",
      "demo-surface:fake-room-posture",
    ],
    recruiter_value:
      "Shows the repo is not just built, but packaged for review, onboarding, and demonstration.",
    risk_safety_posture:
      "Doctor and onboarding metadata do not install, mutate, or execute setup steps.",
    related_phases: ["phase-20b", "phase-20c"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:portfolio-value",
    title: "Portfolio value",
    audiences: ["recruiter", "hiring_manager", "portfolio_viewer"],
    category: "positioning",
    short_summary:
      "Portfolio value comes from showing a complex AI OS as governed, local-first, demo-safe, and recruiter-readable.",
    technical_proof_points: [
      proof(
        "proof:portfolio:contract",
        "Portfolio readiness contract defines recruiter/demo readiness.",
        ["phase-20d1:portfolio-readiness-contract"],
        ["phase-20d1"],
      ),
      proof(
        "proof:portfolio:areas",
        "Portfolio areas and demo surfaces are represented without presentation generation.",
        ["phase-20d1:portfolio-readiness-contract"],
        ["phase-20d1"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:architecture-graph-visibility",
      "demo-surface:governance-graph-visibility",
    ],
    recruiter_value:
      "Gives hiring reviewers a clear path from architecture depth to product story.",
    risk_safety_posture:
      "No presentation, UI, or demo automation is generated here.",
    related_phases: ["phase-20d1"],
    future_expansion_posture: "not_applicable",
    future_expansion_targets: [],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:future-gitnexus",
    title: "Future expansion: GitNexus",
    audiences: ["hiring_manager", "technical_interviewer"],
    category: "future_expansion",
    short_summary:
      "GitNexus is framed as a future project intelligence and repository graph expansion, not a current capability.",
    technical_proof_points: [
      proof(
        "proof:future:gitnexus",
        "GitNexus is future-only metadata in this registry.",
        ["phase-20d2:future-expansion:gitnexus"],
        ["future-expansion"],
      ),
    ],
    demo_surface_ids: ["demo-surface:architecture-graph-visibility"],
    recruiter_value:
      "Shows a roadmap for extending project intelligence into repository-aware workflows.",
    risk_safety_posture:
      "No repository automation, GitHub action, network call, or authority surface is created.",
    related_phases: ["future-expansion"],
    future_expansion_posture: "future_expansion_metadata_only_not_enabled",
    future_expansion_targets: ["GitNexus"],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:future-graphify",
    title: "Future expansion: Graphify",
    audiences: ["hiring_manager", "technical_interviewer"],
    category: "future_expansion",
    short_summary:
      "Graphify is framed as future graph visualization and architecture intelligence, not a current route or renderer.",
    technical_proof_points: [
      proof(
        "proof:future:graphify",
        "Graphify is future-only metadata in this registry.",
        ["phase-20d2:future-expansion:graphify"],
        ["future-expansion"],
      ),
    ],
    demo_surface_ids: ["demo-surface:architecture-graph-visibility"],
    recruiter_value:
      "Shows a roadmap for turning architecture metadata into portfolio-grade visualization later.",
    risk_safety_posture:
      "No graph renderer, UI route, or graph-driven execution is created.",
    related_phases: ["future-expansion"],
    future_expansion_posture: "future_expansion_metadata_only_not_enabled",
    future_expansion_targets: ["Graphify"],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:future-llm-council",
    title: "Future expansion: LLM Council",
    audiences: ["hiring_manager", "technical_interviewer"],
    category: "future_expansion",
    short_summary:
      "LLM Council is framed as future governed multi-model deliberation, not a provider or model-routing capability.",
    technical_proof_points: [
      proof(
        "proof:future:llm-council",
        "LLM Council is future-only metadata in this registry.",
        ["phase-20d2:future-expansion:llm-council"],
        ["future-expansion"],
      ),
    ],
    demo_surface_ids: ["demo-surface:governance-graph-visibility"],
    recruiter_value:
      "Shows forward-thinking model orchestration ambition while preserving governance-first posture.",
    risk_safety_posture:
      "No provider calls, model escalation, network calls, or autonomous routing are enabled.",
    related_phases: ["future-expansion"],
    future_expansion_posture: "future_expansion_metadata_only_not_enabled",
    future_expansion_targets: ["LLM Council"],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:future-obsidian",
    title: "Future expansion: Obsidian",
    audiences: ["recruiter", "portfolio_viewer", "technical_interviewer"],
    category: "future_expansion",
    short_summary:
      "Obsidian is framed as future local knowledge and portfolio documentation integration, not current filesystem mutation.",
    technical_proof_points: [
      proof(
        "proof:future:obsidian",
        "Obsidian is future-only metadata in this registry.",
        ["phase-20d2:future-expansion:obsidian"],
        ["future-expansion"],
      ),
    ],
    demo_surface_ids: ["demo-surface:replay-visibility"],
    recruiter_value:
      "Shows how local notes, architecture context, and portfolio storytelling could converge later.",
    risk_safety_posture:
      "No vault read/write, filesystem mutation, plugin install, or automation is created.",
    related_phases: ["future-expansion"],
    future_expansion_posture: "future_expansion_metadata_only_not_enabled",
    future_expansion_targets: ["Obsidian"],
    posture: POSTURE,
  },
  {
    narrative_id: "recruiter-narrative:future-security-project-integration",
    title: "Future expansion: security project integration",
    audiences: ["hiring_manager", "technical_interviewer"],
    category: "future_expansion",
    short_summary:
      "Security project integration is framed as future governed evidence linking across red-team and portfolio artifacts.",
    technical_proof_points: [
      proof(
        "proof:future:security-integration",
        "Security project integration is future-only metadata in this registry.",
        ["phase-20d2:future-expansion:security-project-integration"],
        ["future-expansion"],
      ),
    ],
    demo_surface_ids: [
      "demo-surface:telemetry-cockpit-visibility",
      "demo-surface:governance-graph-visibility",
    ],
    recruiter_value:
      "Shows a path toward security-focused portfolio depth without enabling risky tooling.",
    risk_safety_posture:
      "No scanner, exploit runner, network action, provider call, or authority surface is created.",
    related_phases: ["future-expansion"],
    future_expansion_posture: "future_expansion_metadata_only_not_enabled",
    future_expansion_targets: ["security project integration"],
    posture: POSTURE,
  },
] satisfies readonly RecruiterNarrative[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyNarrative(narrative: RecruiterNarrative): RecruiterNarrative {
  return RecruiterNarrativeSchema.parse(JSON.parse(JSON.stringify(narrative)));
}

function copyRegistry(
  registry: RecruiterNarrativeRegistry,
): RecruiterNarrativeRegistry {
  return RecruiterNarrativeRegistrySchema.parse(
    JSON.parse(JSON.stringify(registry)),
  );
}

function assertAlignedWithPortfolioContract(): void {
  const contract = getPortfolioReadinessContract();
  const demoSurfaceIds = new Set<DemoReadinessSurfaceId>(
    getDemoReadinessSurfaces().map((surface) => surface.surface_id),
  );

  if (contract.contract_version !== "20D.1") {
    throw new Error("Phase 20D.1 portfolio contract is not available");
  }

  for (const narrative of RECRUITER_NARRATIVE_REGISTRY.narratives) {
    for (const surfaceId of narrative.demo_surface_ids) {
      if (!demoSurfaceIds.has(surfaceId)) {
        throw new Error(
          `Unknown demo surface for recruiter narrative: ${surfaceId}`,
        );
      }
    }
  }
}

export const RECRUITER_NARRATIVE_REGISTRY = deepFreeze(
  RecruiterNarrativeRegistrySchema.parse({
    registry_version: RECRUITER_NARRATIVE_REGISTRY_VERSION,
    source_contract_version: "20D.1",
    registry_id: "phase-20d2-recruiter-narrative-registry",
    phase: "20D.2",
    narratives: NARRATIVES,
    posture: POSTURE,
  }),
);

export function getRecruiterNarrativeRegistry(): RecruiterNarrativeRegistry {
  assertAlignedWithPortfolioContract();
  return copyRegistry(RECRUITER_NARRATIVE_REGISTRY);
}

export function getRecruiterNarrativesByCategory(
  category: RecruiterNarrativeCategory,
): readonly RecruiterNarrative[] {
  return RECRUITER_NARRATIVE_REGISTRY.narratives
    .filter((narrative) => narrative.category === category)
    .map(copyNarrative);
}

export function getRecruiterNarrativesByAudience(
  audience: RecruiterNarrativeAudience,
): readonly RecruiterNarrative[] {
  return RECRUITER_NARRATIVE_REGISTRY.narratives
    .filter((narrative) => narrative.audiences.includes(audience))
    .map(copyNarrative);
}

export function getFutureExpansionNarratives(): readonly RecruiterNarrative[] {
  return RECRUITER_NARRATIVE_REGISTRY.narratives
    .filter(
      (narrative) =>
        narrative.future_expansion_posture ===
        "future_expansion_metadata_only_not_enabled",
    )
    .map(copyNarrative);
}

export function summarizeRecruiterNarratives(): RecruiterNarrativeSummary {
  const narratives = RECRUITER_NARRATIVE_REGISTRY.narratives;
  const categoryCounts = Object.fromEntries(
    RECRUITER_NARRATIVE_CATEGORIES.map((category) => [
      category,
      narratives.filter((narrative) => narrative.category === category).length,
    ]),
  ) as Record<RecruiterNarrativeCategory, number>;
  const audienceCounts = Object.fromEntries(
    RECRUITER_NARRATIVE_AUDIENCES.map((audience) => [
      audience,
      narratives.filter((narrative) => narrative.audiences.includes(audience))
        .length,
    ]),
  ) as Record<RecruiterNarrativeAudience, number>;

  return RecruiterNarrativeSummarySchema.parse({
    registry_version: RECRUITER_NARRATIVE_REGISTRY_VERSION,
    narrative_count: narratives.length,
    category_counts: categoryCounts,
    audience_counts: audienceCounts,
    future_expansion_count: getFutureExpansionNarratives().length,
    proof_point_count: narratives.reduce(
      (count, narrative) => count + narrative.technical_proof_points.length,
      0,
    ),
    demo_surface_reference_count: narratives.reduce(
      (count, narrative) => count + narrative.demo_surface_ids.length,
      0,
    ),
    phase_reference_count: narratives.reduce(
      (count, narrative) => count + narrative.related_phases.length,
      0,
    ),
    phase20d_narrative_registry_only: true,
    phase20d_capability_neutral: true,
    posture: POSTURE,
  });
}
