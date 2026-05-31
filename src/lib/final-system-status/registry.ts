import {
  FINAL_SYSTEM_PHASE_IDS,
  FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
  FinalReadinessSummarySchema,
  FinalSystemStatusRecordSchema,
  type FinalReadinessSummary,
  type FinalSystemPhaseId,
  type FinalSystemPhaseStatusCounts,
  type FinalSystemStatusRecord,
  type FinalSystemStatusValue,
  type FinalSystemSummaryStatus,
} from "./contracts";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

const STATUS_RECORDS = [
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-10",
    phase_name: "Phase 10 Room OS Foundation",
    status: "complete_with_notes",
    status_summary:
      "Room schemas, registry loading, fake adapters, fake Hue simulation, failure modes, and conformance tests are present; Phase 20 packaging still needs final install proof.",
    evidence: [
      {
        evidence_id: "phase-10-evidence:bootstrap-doctor-room-tests",
        source_ref:
          "tests/bootstrap.test.ts; tests/doctor.test.ts; tests/room/registry.test.ts",
        summary:
          "Bootstrap, doctor, and room registry contracts cover the local room substrate entry points.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-10-evidence:fake-room-adapter-conformance",
        source_ref:
          "tests/room/adapters/fake-room-adapter.test.ts; tests/room/conformance/",
        summary:
          "Fake room and adapter conformance tests provide deterministic room-state behavior without real hardware.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: ["final_audit", "move_in", "onboarding"],
    authority_posture: {
      authority_bearing: false,
      posture: "no_authority_surface",
      governance_summary:
        "Foundation defines room metadata and fake adapters only; no real room authority is created here.",
      governance_refs: [
        "src/room/registry.ts",
        "src/room/adapters/contract.ts",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_by_default",
      surfaces: [
        {
          surface_id: "disabled-surface:real-room-io",
          summary:
            "Real room I/O remains outside Phase 10 and must arrive through later adapter governance.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 10 keeps real networked room I/O disabled and uses deterministic local fixtures.",
    },
    packaging_posture: {
      relevance: ["local_bootstrap", "hardware_onboarding"],
      readiness_categories: ["move_in", "onboarding", "final_audit"],
      summary:
        "Move-in packaging needs these substrate checks to prove a fresh machine can load the local room profile safely.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-11",
    phase_name: "Phase 11 Persistence Layer",
    status: "complete",
    status_summary:
      "SQLite migrations, append-only event store checks, projections, retention, room-event bridge, and closeout guards are represented locally.",
    evidence: [
      {
        evidence_id: "phase-11-evidence:append-only-store-closeout",
        source_ref:
          "tests/store/append-only.test.ts; tests/store/closeout.test.ts",
        summary:
          "Store tests prove append-only behavior, projection safety, redaction posture, and closeout invariants.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-11-evidence:migrations-projections-retention",
        source_ref:
          "tests/store/migrations.test.ts; tests/store/projections.test.ts; tests/store/retention.test.ts",
        summary:
          "Migration, projection, and retention suites establish local persistence readiness for later read-only surfaces.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: ["final_audit", "packaging", "move_in", "onboarding"],
    authority_posture: {
      authority_bearing: false,
      posture: "read_only_or_inert",
      governance_summary:
        "Persistence is append-only plus read-only projections; mutation remains bounded to event append paths already under tests.",
      governance_refs: [
        "src/store/event-store.ts",
        "src/store/projections/",
        "tests/store/closeout.test.ts",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_by_default",
      surfaces: [
        {
          surface_id: "disabled-surface:cloud-sync",
          summary:
            "Cross-machine sync, cloud backup, and projection mutation remain out of scope.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "The persistence layer stays local-first, append-only, and projection-safe.",
    },
    packaging_posture: {
      relevance: ["runtime_dependency", "local_bootstrap", "safety_closeout"],
      readiness_categories: ["packaging", "move_in", "final_audit"],
      summary:
        "Final packaging depends on migration and retention checks staying deterministic on local SQLite.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-12",
    phase_name: "Phase 12 Command Center UI",
    status: "complete",
    status_summary:
      "Rest, Working, Audit, synthetic demo, live wiring, redaction, and forbidden-affordance closeouts are covered by UI and observability tests.",
    evidence: [
      {
        evidence_id: "phase-12-evidence:ui-closeout",
        source_ref:
          "tests/ui/phase12-closeout.test.ts; tests/ui/live-wiring-closeout.test.ts",
        summary:
          "Phase 12 closeout checks cover read-only UI wiring and forbidden command affordances.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-12-evidence:audit-working-orb-surfaces",
        source_ref:
          "tests/audit/; tests/working/; tests/orb/; tests/observability/api.test.ts",
        summary:
          "Audit, Working, Rest orb, and Observability API tests cover the Command Center surfaces without adding mutation.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: false,
      posture: "read_only_or_inert",
      governance_summary:
        "Command Center surfaces inspect projections and synthetic data only; authority-bearing controls stay absent from UI closeout.",
      governance_refs: [
        "tests/ui/phase12-closeout.test.ts",
        "src/lib/command-center/",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_by_default",
      surfaces: [
        {
          surface_id: "disabled-surface:public-dashboard",
          summary:
            "Public or remote dashboards remain disabled; local desktop posture is retained.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:ui-mutation-controls",
          summary:
            "Run, retry, approval, and mutation controls remain forbidden from read-only observability UI.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 12 is a visibility layer only, with public dashboard and direct UI authority disabled.",
    },
    packaging_posture: {
      relevance: ["desktop_shell", "audit_surface", "demo_story"],
      readiness_categories: ["packaging", "portfolio", "move_in"],
      summary:
        "Portfolio and packaging readiness depend on these local read-only screens remaining demonstrable and non-authoritative.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-13",
    phase_name: "Phase 13 Model Runtime",
    status: "complete",
    status_summary:
      "Model registry, resolver, runtime, provider contracts, Ollama adapter, telemetry metadata, and final closeout tests are present.",
    evidence: [
      {
        evidence_id: "phase-13-evidence:model-runtime-closeout",
        source_ref:
          "tests/models/phase-13-closeout.test.ts; tests/models/phase-13*-closeout.test.ts",
        summary:
          "Phase 13 closeouts prove local-first model routing and fail-closed provider behavior.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-13-evidence:model-registry-runtime",
        source_ref: "src/models/; src/lib/models/; tests/models/",
        summary:
          "Registry, provider, runtime, and model-call projection modules form the typed model runtime surface.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "onboarding",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: false,
      posture: "read_only_or_inert",
      governance_summary:
        "Model runtime may call configured providers in its own subsystem, but this Phase 20 registry performs no provider call and grants no authority.",
      governance_refs: [
        "src/models/runtime.ts",
        "src/models/resolver.ts",
        "tests/models/phase-13-closeout.test.ts",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_until_explicit_enablement",
      surfaces: [
        {
          surface_id: "disabled-surface:default-cloud-models",
          summary:
            "Cloud model providers remain disabled by default and require explicit configuration, budget, and governance.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:model-auto-install",
          summary:
            "Automatic model installation and model weight modification remain disabled.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 13 keeps cloud and model-install risks behind explicit opt-in governance.",
    },
    packaging_posture: {
      relevance: ["runtime_dependency", "provider_configuration"],
      readiness_categories: ["packaging", "move_in", "onboarding"],
      summary:
        "Final onboarding must verify local model configuration without silently enabling cloud fallback.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-14",
    phase_name: "Phase 14 Voice Runtime",
    status: "complete",
    status_summary:
      "Voice runtime, capture, playback, STT/TTS contracts, streaming boundaries, privacy policies, and final closeout tests are present.",
    evidence: [
      {
        evidence_id: "phase-14-evidence:voice-final-closeout",
        source_ref:
          "tests/voice-runtime/phase-14-final-closeout.test.ts; tests/voice-runtime/",
        summary:
          "Phase 14 final closeout and runtime tests prove voice remains push-to-talk, local-first, and privacy bounded.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-14-evidence:voice-streaming-boundaries",
        source_ref: "src/lib/voice-runtime/; src/lib/voice-streaming/",
        summary:
          "Runtime and streaming modules cover capture, playback, cancellation, privacy, cloud consent, and budget guards.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: false,
      posture: "read_only_or_inert",
      governance_summary:
        "Voice is treated as transport and metadata; it cannot approve, bypass governance, or elevate authority.",
      governance_refs: [
        "src/lib/voice-runtime/governance.ts",
        "src/lib/voice-streaming/privacy-policy.ts",
        "tests/voice-runtime/phase-14-final-closeout.test.ts",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_until_explicit_enablement",
      surfaces: [
        {
          surface_id: "disabled-surface:wake-word",
          summary:
            "Wake word and always-listening modes remain disabled beyond this registry.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:voice-only-governance",
          summary:
            "Voice-only approval remains disabled; approval requires governed on-screen review.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:cloud-voice-default",
          summary:
            "Cloud STT/TTS routes remain disabled by default and subject to consent and budget gates.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 14 risky voice surfaces remain disabled or explicitly consent-gated.",
    },
    packaging_posture: {
      relevance: ["runtime_dependency", "provider_configuration", "demo_story"],
      readiness_categories: ["packaging", "move_in", "portfolio"],
      summary:
        "Voice packaging must preserve push-to-talk, visible capture state, and local-first defaults.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-15",
    phase_name: "Phase 15 Vision Runtime",
    status: "complete",
    status_summary:
      "Vision contracts, sessions, screenshot capture, OCR/object-detection provider boundaries, redaction, failure replay, and final closeout tests are present.",
    evidence: [
      {
        evidence_id: "phase-15-evidence:vision-final-closeout",
        source_ref:
          "tests/vision-runtime/phase-15-final-closeout.test.ts; tests/vision-runtime/",
        summary:
          "Vision runtime closeouts cover advisory screenshot and mock-camera behavior without raw-frame persistence.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-15-evidence:vision-boundaries",
        source_ref: "src/lib/vision/; src/lib/vision-runtime/",
        summary:
          "Vision modules define session, frame ingestion, runtime boundary, redaction, fallback governance, and provider contracts.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: false,
      posture: "read_only_or_inert",
      governance_summary:
        "Vision remains advisory metadata and cannot trigger device or tool authority.",
      governance_refs: [
        "src/lib/vision/runtime-boundary-guard.ts",
        "src/lib/vision/privacy-telemetry-manifest.ts",
        "tests/vision-runtime/phase-15-final-closeout.test.ts",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_until_explicit_enablement",
      surfaces: [
        {
          surface_id: "disabled-surface:background-camera",
          summary:
            "Background camera and continuous capture remain disabled past Phase 20.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:autonomous-visual-control",
          summary:
            "Vision-triggered autonomous room or tool control remains forbidden.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:raw-frame-storage",
          summary: "Raw frame storage in telemetry or replay remains disabled.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 15 keeps perception advisory, user-initiated, and raw-frame safe.",
    },
    packaging_posture: {
      relevance: ["runtime_dependency", "provider_configuration", "demo_story"],
      readiness_categories: ["packaging", "move_in", "portfolio"],
      summary:
        "Final packaging must preserve screenshot/mock-camera constraints and avoid background capture.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-16",
    phase_name: "Phase 16 Room Adapter Runtime",
    status: "complete",
    status_summary:
      "Fake adapter hardening, Hue read-only, Hue dry-run, approval-gated execution boundary, conformance, and final room adapter closeout are present.",
    evidence: [
      {
        evidence_id: "phase-16-evidence:room-final-closeout",
        source_ref:
          "docs/phase-16/phase-16-closeout.md; tests/room/phase-16-closeout.test.ts",
        summary:
          "Phase 16 final closeout verifies 16A through 16D docs and tests, including read-only, dry-run, and governed command boundaries.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-16-evidence:hue-boundaries",
        source_ref:
          "src/room/adapters/hue-read-mapper.ts; src/room/adapters/hue-dry-run.ts; src/room/adapters/hue-execution-boundary.ts",
        summary:
          "Hue adapter modules separate read mapping, dry-run planning, and approval-governed command boundaries.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "onboarding",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: true,
      posture: "approval_governed_only",
      governance_summary:
        "Room authority is limited to adapter command boundaries that require approval governance, dry-run planning, and verification.",
      governance_refs: [
        "src/room/adapters/hue-execution-boundary.ts",
        "tests/room/phase-16d-closeout.test.ts",
        "src/lib/approval-runtime/",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_until_explicit_enablement",
      surfaces: [
        {
          surface_id: "disabled-surface:autonomous-device-control",
          summary:
            "Autonomous room/device control remains disabled; commands require approval governance.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:multi-room-whole-home",
          summary:
            "Whole-home and multi-room control remain deferred beyond Phase 20.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:cloud-hue-remote-api",
          summary:
            "Cloud Hue Remote API and device auto-discovery remain disabled.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 16 is authority-bearing only through governed, local, approval-gated adapter boundaries.",
    },
    packaging_posture: {
      relevance: ["hardware_onboarding", "safety_closeout", "demo_story"],
      readiness_categories: ["move_in", "onboarding", "final_audit"],
      summary:
        "Move-in readiness depends on proving local adapter setup, failure modes, and approval gates before real room use.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-17",
    phase_name: "Phase 17 Scheduled Assistance Runtime",
    status: "complete",
    status_summary:
      "Foreground scheduler, eligibility, self-audit reports, suggestions, kill switch, privacy telemetry manifest, and final closeout are present.",
    evidence: [
      {
        evidence_id: "phase-17-evidence:scheduled-assistance-closeout",
        source_ref:
          "docs/phase-17/phase-17-closeout.md; tests/routines/phase-17-closeout.test.ts",
        summary:
          "Phase 17 final closeout proves foreground-only, suggestion-only scheduled assistance with kill-switch protection.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-17-evidence:routine-boundaries",
        source_ref: "src/lib/routines/; tests/routines/",
        summary:
          "Routine modules and tests cover tick sources, eligibility, suggestion inbox, self-audit, dedupe, and no side-effect scheduling.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: false,
      posture: "read_only_or_inert",
      governance_summary:
        "Scheduled assistance creates suggestions and reports only; user intent must enter approval governance before any side effect.",
      governance_refs: [
        "src/lib/routines/disabled-feature-guard.ts",
        "src/lib/routines/kill-switch.ts",
        "tests/routines/phase-17-closeout.test.ts",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_until_explicit_enablement",
      surfaces: [
        {
          surface_id: "disabled-surface:headless-background-scheduler",
          summary:
            "Headless/background scheduling remains disabled for Phase 20 readiness.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:routine-auto-side-effects",
          summary:
            "Routine auto-execution, chaining, and self-modification remain disabled.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 17 remains foreground, killable, suggestion-only, and non-authoritative.",
    },
    packaging_posture: {
      relevance: ["runtime_dependency", "safety_closeout", "demo_story"],
      readiness_categories: ["packaging", "move_in", "portfolio"],
      summary:
        "Final integration must keep scheduled assistance foreground-only until packaging audits explicitly validate process supervision.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-18",
    phase_name: "Phase 18 Approval-Gated Execution Layer",
    status: "complete",
    status_summary:
      "Approval runtime proposal, review, decision, authority-token metadata, plan, verification, compensation, audit preview, and final closeout modules are present.",
    evidence: [
      {
        evidence_id: "phase-18-evidence:approval-final-closeout",
        source_ref:
          "src/lib/approval-runtime/phase-18-final-closeout.ts; src/lib/approval-runtime/phase-18-final-closeout.test.ts",
        summary:
          "Phase 18 final closeout proves approval lifecycle metadata remains non-authoritative, non-executing, and replay safe.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-18-evidence:approval-lifecycle-modules",
        source_ref: "src/lib/approval-runtime/; app/api/runtime-commands/",
        summary:
          "Approval runtime modules define lifecycle metadata and guarded runtime-command route surfaces without auto-approval.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: true,
      posture: "approval_governed_only",
      governance_summary:
        "Phase 18 is the governance boundary for authority; it represents the only approved path to side effects and does not grant Phase 20 any new authority.",
      governance_refs: [
        "src/lib/approval-runtime/authority-boundary.ts",
        "src/lib/approval-runtime/phase-18-final-closeout.ts",
        "tests/runtime-commands/",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "disabled_until_explicit_enablement",
      surfaces: [
        {
          surface_id: "disabled-surface:auto-approval",
          summary:
            "Auto-approval and allow-listed automatic side effects remain disabled.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:approval-inheritance",
          summary:
            "Approval inheritance, cross-session approval persistence, and multi-step authority graphs remain disabled.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 18 authority remains explicit, bounded, expiring, reviewable, and never inherited.",
    },
    packaging_posture: {
      relevance: ["safety_closeout", "runtime_dependency", "demo_story"],
      readiness_categories: ["final_audit", "move_in", "portfolio"],
      summary:
        "Final audits must use Phase 18 as the authority baseline for every packaging and move-in side-effect path.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
  {
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_id: "phase-19",
    phase_name: "Phase 19 Fortress Upgrades",
    status: "complete_with_notes",
    status_summary:
      "Architecture graph, telemetry cockpit, governance visualizer, and red-team sandbox closeouts are present; red-team execution remains deliberately CAI-ready but blocked.",
    evidence: [
      {
        evidence_id: "phase-19-evidence:fortress-closeouts",
        source_ref:
          "src/lib/architecture-graph/phase-19a-closeout.ts; src/lib/telemetry-cockpit/phase-19b-closeout.ts; src/lib/governance-visualizer/phase-19c-closeout.ts; src/lib/red-team-sandbox/phase-19d-closeout.ts",
        summary:
          "Phase 19 closeout modules cover read-only architecture, telemetry, governance, and sandboxed red-team visibility.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
      {
        evidence_id: "phase-19-evidence:visible-audit-surfaces",
        source_ref:
          "app/audit/architecture-graph/; app/audit/telemetry-cockpit/; app/audit/governance-boundaries/; app/audit/red-team-sandbox/",
        summary:
          "Audit routes and viewer tests make the fortress layer inspectable without granting control authority.",
        metadata_only: true,
        read_only: true,
        raw_payload_included: false,
      },
    ],
    readiness_categories: [
      "final_audit",
      "packaging",
      "portfolio",
      "disabled_feature_matrix",
    ],
    authority_posture: {
      authority_bearing: true,
      posture: "sandboxed_governance_required",
      governance_summary:
        "Phase 19 adds read-only audit surfaces plus a red-team sandbox whose CAI path remains approval-bound, whitelist-bound, dry-run-first, and execution-blocked.",
      governance_refs: [
        "src/lib/red-team-sandbox/phase-19d-closeout.ts",
        "src/lib/red-team-sandbox/cai-localhost-execution-gate.ts",
        "src/lib/approval-runtime/",
      ],
      new_authority_surface_created_by_phase_20: false,
    },
    disabled_feature_posture: {
      posture: "governed_sandbox_only",
      surfaces: [
        {
          surface_id: "disabled-surface:cai-non-whitelisted-targets",
          summary:
            "CAI or red-team work against non-whitelisted targets remains denied.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:cai-real-execution",
          summary:
            "Real CAI sidecar execution remains blocked; current Phase 19D is governed, dry-run, and readiness-only.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
        {
          surface_id: "disabled-surface:dashboard-mutation",
          summary:
            "Fortress dashboards remain read-only and cannot mutate policy or runtime state.",
          remains_disabled: true,
          enablement_requires_future_governance: true,
        },
      ],
      summary:
        "Phase 19 remains an additive visibility and sandbox-readiness layer with no parallel authority path.",
    },
    packaging_posture: {
      relevance: ["audit_surface", "demo_story", "safety_closeout"],
      readiness_categories: ["final_audit", "portfolio", "packaging"],
      summary:
        "Portfolio readiness uses Phase 19 as proof of governance visibility while final packaging preserves its read-only/sandboxed posture.",
    },
    metadata_only: true,
    read_only: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    route_added: false,
    routine_execution_enabled: false,
    room_device_control_enabled: false,
    raw_payload_included: false,
    phase20_new_capability_introduced: false,
  },
] satisfies readonly FinalSystemStatusRecord[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyRecord(record: FinalSystemStatusRecord): FinalSystemStatusRecord {
  return FinalSystemStatusRecordSchema.parse(
    JSON.parse(JSON.stringify(record)),
  );
}

function copyRecords(
  records: readonly FinalSystemStatusRecord[],
): FinalSystemStatusRecord[] {
  return records.map(copyRecord);
}

function summaryStatus(
  records: readonly FinalSystemStatusRecord[],
): FinalSystemSummaryStatus {
  if (records.some((record) => record.status === "blocked")) {
    return "blocked";
  }

  if (records.some((record) => record.status === "missing")) {
    return "missing";
  }

  if (records.some((record) => record.status === "unknown")) {
    return "unknown";
  }

  if (records.some((record) => record.status === "complete_with_notes")) {
    return "clear_with_notes";
  }

  return "clear";
}

function countStatuses(
  records: readonly FinalSystemStatusRecord[],
): FinalSystemPhaseStatusCounts {
  const counts: Mutable<FinalSystemPhaseStatusCounts> = {
    complete: 0,
    complete_with_notes: 0,
    blocked: 0,
    missing: 0,
    unknown: 0,
  };

  for (const record of records) {
    counts[record.status as FinalSystemStatusValue] += 1;
  }

  return counts;
}

function recordsForCategory(
  category:
    | "final_audit"
    | "packaging"
    | "move_in"
    | "onboarding"
    | "portfolio",
): readonly FinalSystemStatusRecord[] {
  return FINAL_SYSTEM_STATUS_REGISTRY.filter((record) =>
    record.readiness_categories.includes(category),
  );
}

export const FINAL_SYSTEM_STATUS_REGISTRY = deepFreeze(
  FinalSystemStatusRecordSchema.array().parse(STATUS_RECORDS),
);

export function listFinalSystemPhaseStatuses(): readonly FinalSystemStatusRecord[] {
  return copyRecords(FINAL_SYSTEM_STATUS_REGISTRY);
}

export function getFinalSystemPhaseStatus(
  phaseId: FinalSystemPhaseId,
): FinalSystemStatusRecord | null {
  const record =
    FINAL_SYSTEM_STATUS_REGISTRY.find((entry) => entry.phase_id === phaseId) ??
    null;

  return record ? copyRecord(record) : null;
}

export function buildFinalReadinessSummary(): FinalReadinessSummary {
  const blockedOrMissing = listBlockedOrMissingFinalSystemItems();
  const authorityBearing = listAuthorityBearingFinalSystemSurfaces();
  const disabledFeatureSurfaces = listDisabledFeatureFinalSystemSurfaces();

  return FinalReadinessSummarySchema.parse({
    contract_version: FINAL_SYSTEM_STATUS_CONTRACT_VERSION,
    phase_count: FINAL_SYSTEM_STATUS_REGISTRY.length,
    represented_phase_ids: [...FINAL_SYSTEM_PHASE_IDS],
    status_counts: countStatuses(FINAL_SYSTEM_STATUS_REGISTRY),
    final_audit_status: summaryStatus(recordsForCategory("final_audit")),
    packaging_status: summaryStatus(recordsForCategory("packaging")),
    move_in_status: summaryStatus(recordsForCategory("move_in")),
    onboarding_status: summaryStatus(recordsForCategory("onboarding")),
    portfolio_status: summaryStatus(recordsForCategory("portfolio")),
    blocked_or_missing_count: blockedOrMissing.length,
    authority_bearing_phase_count: authorityBearing.length,
    disabled_feature_surface_count: disabledFeatureSurfaces.reduce(
      (count, record) =>
        count + record.disabled_feature_posture.surfaces.length,
      0,
    ),
    phase20_capability_posture: {
      new_capabilities_introduced: false,
      new_authority_surface_created: false,
      execution_hooks_added: false,
      provider_calls_enabled: false,
      network_calls_enabled: false,
      filesystem_mutation_enabled: false,
      route_added: false,
      room_device_control_enabled: false,
    },
    summary:
      "Phase 20A.1 records final-system status for completed core phases 10-19 without adding runtime behavior, provider calls, routes, or authority.",
    metadata_only: true,
    read_only: true,
    raw_payload_included: false,
  });
}

export function listBlockedOrMissingFinalSystemItems(): readonly FinalSystemStatusRecord[] {
  return copyRecords(
    FINAL_SYSTEM_STATUS_REGISTRY.filter(
      (record) => record.status === "blocked" || record.status === "missing",
    ),
  );
}

export function listAuthorityBearingFinalSystemSurfaces(): readonly FinalSystemStatusRecord[] {
  return copyRecords(
    FINAL_SYSTEM_STATUS_REGISTRY.filter(
      (record) => record.authority_posture.authority_bearing,
    ),
  );
}

export function listDisabledFeatureFinalSystemSurfaces(): readonly FinalSystemStatusRecord[] {
  return copyRecords(
    FINAL_SYSTEM_STATUS_REGISTRY.filter(
      (record) => record.disabled_feature_posture.surfaces.length > 0,
    ),
  );
}
