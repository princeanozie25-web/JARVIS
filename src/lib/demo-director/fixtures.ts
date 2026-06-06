/**
 * Demo Director audience fixtures - DD.11/DD.12 closeout.
 *
 * Pipeline is the sole UI direction. These deterministic scripts drive
 * Rest, Working, Audit, and the Pipeline Command Center. The old gauntlet
 * language is intentionally absent from the official product path.
 */

import { type DemoCue, type DemoScript, type DemoSegment } from "./contracts";
import { parseDemoScript, sumSegmentDurations } from "./schemas";

function cue(input: Omit<DemoCue, "metadata_only" | "read_only">): DemoCue {
  return {
    ...input,
    metadata_only: true,
    read_only: true,
  };
}

function makeAssemblySegment(): DemoSegment {
  const cues: DemoCue[] = [
    cue({
      cue_id: "assembly:black",
      at_ms: 0,
      kind: "show_label",
      note: "JARVIS dormant",
    }),
    cue({
      cue_id: "assembly:reactor",
      at_ms: 600,
      kind: "ignite_reactor",
      target: "rest",
      note: "Rest reactor ignition",
    }),
    cue({
      cue_id: "assembly:rest",
      at_ms: 1400,
      kind: "enter_route",
      target: "/rest",
      note: "Rest surface comes online",
    }),
    cue({
      cue_id: "assembly:suggestion_inbox",
      at_ms: 2200,
      kind: "highlight_surface",
      target: "suggestion_inbox",
      note: "Suggestions appear without executing",
    }),
    cue({
      cue_id: "assembly:pipeline",
      at_ms: 3000,
      kind: "enter_route",
      target: "/audit/pipeline",
      note: "Pipeline becomes the visual authority",
    }),
    cue({
      cue_id: "assembly:working",
      at_ms: 3800,
      kind: "enter_route",
      target: "/working",
      note: "Working cockpit prepares gated proposals",
    }),
    cue({
      cue_id: "assembly:audit",
      at_ms: 4600,
      kind: "enter_route",
      target: "/audit",
      note: "Audit fortress proves the boundary held",
    }),
    cue({
      cue_id: "assembly:human_gate",
      at_ms: 5200,
      kind: "ignite_human_gate",
      target: "human_gate",
      note: "Approval boundary visible",
    }),
    cue({
      cue_id: "assembly:first_pulse",
      at_ms: 5800,
      kind: "pulse",
      target: "pipeline-transition:route-to-human-gate",
      note: "First governed pulse",
    }),
  ];

  return {
    segment_id: "segment:assembly",
    kind: "assembly",
    label: "Command Center Assembly",
    description:
      "JARVIS wakes as a single pipeline command center: Rest, Working, Audit, and the Human Gate.",
    duration_ms: 6000,
    cues,
    metadata_only: true,
    read_only: true,
  };
}

function makeScript(input: {
  audience: DemoScript["audience"];
  title: string;
  subtitle: string;
  segments: readonly DemoSegment[];
  showcased_zones: DemoScript["showcased_zones"];
}): DemoScript {
  const script: DemoScript = {
    script_id: `demo:${input.audience}`,
    audience: input.audience,
    title: input.title,
    subtitle: input.subtitle,
    total_duration_ms: sumSegmentDurations(input.segments),
    segments: input.segments,
    showcased_zones: input.showcased_zones,
    metadata_only: true,
    read_only: true,
    recording_enabled: true,
    voice_enabled: true,
    export_enabled: true,
    narration_enabled: true,
    ffmpeg_enabled: false,
  };
  return parseDemoScript(script);
}

function makeRecruiterScript(): DemoScript {
  const assembly = makeAssemblySegment();
  const tour: DemoSegment = {
    segment_id: "segment:recruiter:tour",
    kind: "route_showcase",
    label: "Recruiter Tour",
    description:
      "Rest reactor, suggestion inbox, pipeline flow, aux routing, council, knowledge, agent coordinator, Working, and Audit.",
    duration_ms: 8600,
    cues: [
      cue({
        cue_id: "recruiter:rest",
        at_ms: 0,
        kind: "highlight_surface",
        target: "rest",
        note: "JARVIS is present before it acts",
      }),
      cue({
        cue_id: "recruiter:inbox",
        at_ms: 1100,
        kind: "highlight_surface",
        target: "suggestion_inbox",
        note: "Create a recruiter demo of yourself",
      }),
      cue({
        cue_id: "recruiter:pipeline",
        at_ms: 2200,
        kind: "highlight_surface",
        target: "pipeline",
        note: "Pipeline is the sole official UI direction",
      }),
      cue({
        cue_id: "recruiter:aux",
        at_ms: 3300,
        kind: "highlight_pipeline_stage",
        target: "aux_routing",
        note: "Auxiliary model slots choose the cheapest capable model",
      }),
      cue({
        cue_id: "recruiter:council",
        at_ms: 4400,
        kind: "highlight_surface",
        target: "council",
        note: "Council reasoning stays observable",
      }),
      cue({
        cue_id: "recruiter:knowledge",
        at_ms: 5500,
        kind: "highlight_surface",
        target: "knowledge",
        note: "Knowledge compounding feeds the system",
      }),
      cue({
        cue_id: "recruiter:agent_coordinator",
        at_ms: 6600,
        kind: "highlight_surface",
        target: "agent_coordinator",
        note: "Agent coordinator proposes, never silently acts",
      }),
      cue({
        cue_id: "recruiter:working",
        at_ms: 7600,
        kind: "enter_route",
        target: "/working",
        note: "Working cockpit shows governed work",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };
  const climax: DemoSegment = {
    segment_id: "segment:recruiter:climax",
    kind: "human_gate_climax",
    label: "Gate And Proof",
    description:
      "The proposal halts at the Human Gate, then the audit surface proves the decision path.",
    duration_ms: 3600,
    cues: [
      cue({
        cue_id: "recruiter:climax:halt",
        at_ms: 0,
        kind: "halt",
        target: "human_gate",
      }),
      cue({
        cue_id: "recruiter:climax:approve",
        at_ms: 1800,
        kind: "approve",
        target: "human_gate",
        note: "Human-approved demo playback",
      }),
      cue({
        cue_id: "recruiter:climax:audit",
        at_ms: 2800,
        kind: "enter_route",
        target: "/audit",
        note: "Audit fortress closes the story",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };

  return makeScript({
    audience: "recruiter",
    title: "Recruiter Demo",
    subtitle:
      "JARVIS creates, narrates, plays, records, and packages a governed pipeline demo.",
    segments: [assembly, tour, climax],
    showcased_zones: [
      "rest",
      "suggestion_inbox",
      "pipeline",
      "aux_routing",
      "council",
      "knowledge",
      "agent_coordinator",
      "human_gate",
      "working",
      "audit",
    ],
  });
}

function makeSecurityScript(): DemoScript {
  const assembly = makeAssemblySegment();
  const fortress: DemoSegment = {
    segment_id: "segment:security:fortress",
    kind: "audit_replay",
    label: "Security Fortress",
    description:
      "Approval gate, governance overlay, forbidden-edge alert, and audit trail remain read-only and visible.",
    duration_ms: 7200,
    cues: [
      cue({
        cue_id: "security:approval_gate",
        at_ms: 0,
        kind: "highlight_surface",
        target: "human_gate",
        note: "Only the gate can approve side effects",
      }),
      cue({
        cue_id: "security:governance",
        at_ms: 1800,
        kind: "highlight_surface",
        target: "governance",
        note: "Governance boundaries are inspectable",
      }),
      cue({
        cue_id: "security:forbidden_edge",
        at_ms: 3600,
        kind: "highlight_pipeline_stage",
        target: "pipeline-transition:route-to-execute-forbidden",
        note: "Forbidden bypass turns visible",
      }),
      cue({
        cue_id: "security:audit_trail",
        at_ms: 5400,
        kind: "enter_route",
        target: "/audit",
        note: "Replay is data, not execution",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };
  const climax: DemoSegment = {
    segment_id: "segment:security:climax",
    kind: "human_gate_climax",
    label: "Containment",
    description: "A forbidden path is denied. Nothing executes from the demo.",
    duration_ms: 3000,
    cues: [
      cue({
        cue_id: "security:climax:halt",
        at_ms: 0,
        kind: "halt",
        target: "human_gate",
      }),
      cue({
        cue_id: "security:climax:deny",
        at_ms: 2000,
        kind: "deny",
        target: "human_gate",
        note: "No execution bypass",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };

  return makeScript({
    audience: "security",
    title: "Security Demo",
    subtitle:
      "Approval boundaries, forbidden-edge alerts, and the audit trail demonstrate containment.",
    segments: [assembly, fortress, climax],
    showcased_zones: ["pipeline", "human_gate", "audit", "governance"],
  });
}

function makeTechnicalScript(): DemoScript {
  const assembly = makeAssemblySegment();
  const architecture: DemoSegment = {
    segment_id: "segment:technical:architecture",
    kind: "pipeline_walk",
    label: "Technical Pipeline",
    description:
      "Routing, auxiliary slots, council synthesis, telemetry, approval lifecycle, and architecture are inspected in sequence.",
    duration_ms: 8400,
    cues: [
      cue({
        cue_id: "technical:routing",
        at_ms: 0,
        kind: "highlight_pipeline_stage",
        target: "route",
        note: "Intent, safety, capability, and cost stay ordered",
      }),
      cue({
        cue_id: "technical:aux_slots",
        at_ms: 1400,
        kind: "highlight_pipeline_stage",
        target: "aux_routing",
        note: "Auxiliary slots resolve independently within tier caps",
      }),
      cue({
        cue_id: "technical:council",
        at_ms: 2800,
        kind: "highlight_surface",
        target: "council",
        note: "Council output remains observable",
      }),
      cue({
        cue_id: "technical:telemetry",
        at_ms: 4200,
        kind: "highlight_surface",
        target: "telemetry",
        note: "Model calls and cost are visible",
      }),
      cue({
        cue_id: "technical:lifecycle",
        at_ms: 5600,
        kind: "highlight_surface",
        target: "human_gate",
        note: "Approval lifecycle gates the side effect",
      }),
      cue({
        cue_id: "technical:architecture",
        at_ms: 7000,
        kind: "enter_route",
        target: "/audit/pipeline",
        note: "Architecture becomes a living pipeline map",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };
  const climax: DemoSegment = {
    segment_id: "segment:technical:climax",
    kind: "human_gate_climax",
    label: "Approval Lifecycle",
    description:
      "The technical path reaches the Human Gate and records an audit explanation.",
    duration_ms: 3000,
    cues: [
      cue({
        cue_id: "technical:climax:halt",
        at_ms: 0,
        kind: "halt",
        target: "human_gate",
      }),
      cue({
        cue_id: "technical:climax:approve",
        at_ms: 2000,
        kind: "approve",
        target: "human_gate",
        note: "Approved demo package generation",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };

  return makeScript({
    audience: "technical",
    title: "Technical Demo",
    subtitle:
      "Router, aux slots, council, telemetry, approval lifecycle, and architecture in one pipeline.",
    segments: [assembly, architecture, climax],
    showcased_zones: [
      "pipeline",
      "aux_routing",
      "council",
      "telemetry",
      "human_gate",
      "audit",
    ],
  });
}

function makeGeneralScript(): DemoScript {
  const assembly = makeAssemblySegment();
  const flow: DemoSegment = {
    segment_id: "segment:general:flow",
    kind: "narrative",
    label: "Simple Request",
    description:
      "A simple request travels through the pipeline, pauses for approval, then returns a result.",
    duration_ms: 5600,
    cues: [
      cue({
        cue_id: "general:request",
        at_ms: 0,
        kind: "pulse",
        target: "pipeline-transition:capture-to-classify",
        note: "A simple request enters JARVIS",
      }),
      cue({
        cue_id: "general:pipeline",
        at_ms: 1200,
        kind: "highlight_surface",
        target: "pipeline",
        note: "The request travels visibly",
      }),
      cue({
        cue_id: "general:gate_halt",
        at_ms: 2600,
        kind: "halt",
        target: "human_gate",
      }),
      cue({
        cue_id: "general:approve",
        at_ms: 3800,
        kind: "approve",
        target: "human_gate",
      }),
      cue({
        cue_id: "general:result",
        at_ms: 4800,
        kind: "enter_route",
        target: "/working",
        note: "The result appears in the governed work surface",
      }),
    ],
    metadata_only: true,
    read_only: true,
  };

  return makeScript({
    audience: "general",
    title: "General Demo",
    subtitle:
      "A plain request becomes a visible, approved, auditable pipeline journey.",
    segments: [assembly, flow],
    showcased_zones: ["rest", "pipeline", "human_gate", "working"],
  });
}

export const DEMO_SCRIPT_RECRUITER = Object.freeze(makeRecruiterScript());
export const DEMO_SCRIPT_SECURITY = Object.freeze(makeSecurityScript());
export const DEMO_SCRIPT_TECHNICAL = Object.freeze(makeTechnicalScript());
export const DEMO_SCRIPT_GENERAL = Object.freeze(makeGeneralScript());

export const DEMO_SCRIPTS = Object.freeze({
  recruiter: DEMO_SCRIPT_RECRUITER,
  security: DEMO_SCRIPT_SECURITY,
  technical: DEMO_SCRIPT_TECHNICAL,
  general: DEMO_SCRIPT_GENERAL,
} as const);

export type DemoScriptName = keyof typeof DEMO_SCRIPTS;

/** Deny-by-default loader - unknown name falls back to `recruiter`. */
export function loadDemoScript(name?: string): DemoScript {
  if (
    typeof name === "string" &&
    Object.prototype.hasOwnProperty.call(DEMO_SCRIPTS, name)
  ) {
    return DEMO_SCRIPTS[name as DemoScriptName];
  }
  return DEMO_SCRIPT_RECRUITER;
}
