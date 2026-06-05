/**
 * Demo Director audience fixtures — DD.9.
 *
 * Four deterministic, hand-authored scripts. No LLM generation, no
 * randomness, no dynamic timing. Every script:
 *   - opens with the Gauntlet Assembly sequence (DD.10)
 *   - walks a curated path through the populated stones
 *   - climaxes at the Human Gate
 *
 * Fixtures are pure data; loaders rebuild them through the schema to
 * guarantee the read-only contract is intact.
 */

import { type DemoCue, type DemoScript, type DemoSegment } from "./contracts";
import { parseDemoScript, sumSegmentDurations } from "./schemas";

// ---------------------------------------------------------------------------
// Shared assembly segment — every script opens here
// ---------------------------------------------------------------------------

function makeAssemblySegment(): DemoSegment {
  const cues: DemoCue[] = [
    {
      cue_id: "assembly:black",
      at_ms: 0,
      kind: "show_label",
      note: "JARVIS dormant",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:orb",
      at_ms: 600,
      kind: "assemble_stone",
      target: "orb",
      note: "Reactor ignition",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:space",
      at_ms: 1400,
      kind: "assemble_stone",
      target: "space",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:time",
      at_ms: 2000,
      kind: "assemble_stone",
      target: "time",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:mind",
      at_ms: 2600,
      kind: "assemble_stone",
      target: "mind",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:soul",
      at_ms: 3200,
      kind: "assemble_stone",
      target: "soul",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:reality",
      at_ms: 3800,
      kind: "assemble_stone",
      target: "reality",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:power",
      at_ms: 4400,
      kind: "assemble_stone",
      target: "power",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:human_gate",
      at_ms: 5200,
      kind: "ignite_human_gate",
      target: "human-gate",
      note: "Assembly climax",
      metadata_only: true,
      read_only: true,
    },
    {
      cue_id: "assembly:first_pulse",
      at_ms: 5800,
      kind: "pulse",
      target: "space-edge:input-to-intent",
      note: "First governed pulse",
      metadata_only: true,
      read_only: true,
    },
  ];

  return {
    segment_id: "segment:assembly",
    kind: "assembly",
    label: "Assembly",
    description:
      "JARVIS awakens. Reactor first, then the six stones, then the Human Gate.",
    duration_ms: 6000,
    cues,
    metadata_only: true,
    read_only: true,
  };
}

// ---------------------------------------------------------------------------
// Recruiter — full six-stone walk, governance emphasis, gate climax
// ---------------------------------------------------------------------------

function makeRecruiterScript(): DemoScript {
  const assembly = makeAssemblySegment();

  const walk: DemoSegment = {
    segment_id: "segment:recruiter:walk",
    kind: "gauntlet_walk",
    label: "Six-stone walk",
    description:
      "Traverse Space, Time, Mind, Soul, Reality, and Power — every flow held by the Human Gate.",
    duration_ms: 7200,
    cues: [
      {
        cue_id: "recruiter:walk:space",
        at_ms: 0,
        kind: "highlight_zone",
        target: "space",
        note: "Routing spine",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "recruiter:walk:time",
        at_ms: 1200,
        kind: "highlight_zone",
        target: "time",
        note: "Agent constellation",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "recruiter:walk:mind",
        at_ms: 2400,
        kind: "highlight_zone",
        target: "mind",
        note: "Council synthesis",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "recruiter:walk:soul",
        at_ms: 3600,
        kind: "highlight_zone",
        target: "soul",
        note: "Memory under pressure",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "recruiter:walk:reality",
        at_ms: 4800,
        kind: "highlight_zone",
        target: "reality",
        note: "Physical world, governed",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "recruiter:walk:power",
        at_ms: 6000,
        kind: "highlight_zone",
        target: "power",
        note: "Fortress reactor",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const climax: DemoSegment = {
    segment_id: "segment:recruiter:climax",
    kind: "human_gate_climax",
    label: "Human Gate",
    description: "Every flow terminates at the gate. Approval is human.",
    duration_ms: 3000,
    cues: [
      {
        cue_id: "recruiter:climax:halt",
        at_ms: 0,
        kind: "halt",
        target: "human-gate",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "recruiter:climax:approve",
        at_ms: 2200,
        kind: "approve",
        target: "human-gate",
        note: "Governance, visibility, sophistication",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const segments = [assembly, walk, climax];
  const script: DemoScript = {
    script_id: "demo:recruiter",
    audience: "recruiter",
    title: "Recruiter walkthrough",
    subtitle:
      "Six stones, one human gate. Read-only governance from input to audit.",
    total_duration_ms: sumSegmentDurations(segments),
    segments,
    showcased_zones: ["space", "time", "mind", "soul", "reality", "power"],
    metadata_only: true,
    read_only: true,
    recording_enabled: false,
    voice_enabled: false,
    export_enabled: false,
    narration_enabled: false,
    ffmpeg_enabled: false,
  };
  return parseDemoScript(script);
}

// ---------------------------------------------------------------------------
// Security — Power + forbidden edge + CAI lock + Human Gate
// ---------------------------------------------------------------------------

function makeSecurityScript(): DemoScript {
  const assembly = makeAssemblySegment();

  const fortress: DemoSegment = {
    segment_id: "segment:security:fortress",
    kind: "gauntlet_walk",
    label: "Fortress focus",
    description:
      "Power reactor stays in frame. Forbidden edge highlights; CAI execution gate stays locked.",
    duration_ms: 6000,
    cues: [
      {
        cue_id: "security:fortress:power",
        at_ms: 0,
        kind: "highlight_zone",
        target: "power",
        note: "Reactor watch",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "security:fortress:forbidden",
        at_ms: 1800,
        kind: "highlight_zone",
        target: "power-edge:sandbox-to-governance",
        note: "Forbidden edge surfaced",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "security:fortress:cai_lock",
        at_ms: 3600,
        kind: "highlight_zone",
        target: "cai_execution_gate",
        note: "CAI execution gate locked",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const climax: DemoSegment = {
    segment_id: "segment:security:climax",
    kind: "human_gate_climax",
    label: "Containment",
    description: "Human Gate denies the forbidden proposal. No execution.",
    duration_ms: 3000,
    cues: [
      {
        cue_id: "security:climax:halt",
        at_ms: 0,
        kind: "halt",
        target: "human-gate",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "security:climax:deny",
        at_ms: 2000,
        kind: "deny",
        target: "human-gate",
        note: "Control. Containment. Auditability.",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const segments = [assembly, fortress, climax];
  const script: DemoScript = {
    script_id: "demo:security",
    audience: "security",
    title: "Security containment",
    subtitle:
      "Fortress reactor and CAI lock — a forbidden proposal stopped at the gate.",
    total_duration_ms: sumSegmentDurations(segments),
    segments,
    showcased_zones: ["space", "power"],
    metadata_only: true,
    read_only: true,
    recording_enabled: false,
    voice_enabled: false,
    export_enabled: false,
    narration_enabled: false,
    ffmpeg_enabled: false,
  };
  return parseDemoScript(script);
}

// ---------------------------------------------------------------------------
// Technical — Council, routing, model tiers, telemetry
// ---------------------------------------------------------------------------

function makeTechnicalScript(): DemoScript {
  const assembly = makeAssemblySegment();

  const architecture: DemoSegment = {
    segment_id: "segment:technical:architecture",
    kind: "gauntlet_walk",
    label: "Architecture",
    description:
      "Council deliberates. Space routes through tiers. Power telemetry watches.",
    duration_ms: 7200,
    cues: [
      {
        cue_id: "technical:council",
        at_ms: 0,
        kind: "highlight_zone",
        target: "mind",
        note: "Six-member council",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "technical:routing",
        at_ms: 1800,
        kind: "highlight_zone",
        target: "space",
        note: "Router → tiers",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "technical:tier_t2",
        at_ms: 3400,
        kind: "highlight_zone",
        target: "tier_t2",
        note: "Tier T2 — voice + UI confirm",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "technical:telemetry",
        at_ms: 5000,
        kind: "highlight_zone",
        target: "telemetry_cockpit",
        note: "Telemetry observe-only",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const climax: DemoSegment = {
    segment_id: "segment:technical:climax",
    kind: "human_gate_climax",
    label: "Approval",
    description: "Council recommendation reaches the Human Gate. Approved.",
    duration_ms: 3000,
    cues: [
      {
        cue_id: "technical:climax:halt",
        at_ms: 0,
        kind: "halt",
        target: "human-gate",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "technical:climax:approve",
        at_ms: 2000,
        kind: "approve",
        target: "human-gate",
        note: "Architecture. Reasoning. Orchestration.",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const segments = [assembly, architecture, climax];
  const script: DemoScript = {
    script_id: "demo:technical",
    audience: "technical",
    title: "Technical deep dive",
    subtitle:
      "Mind council, Space routing, model tiers, and Power telemetry — under one gate.",
    total_duration_ms: sumSegmentDurations(segments),
    segments,
    showcased_zones: ["space", "mind", "power"],
    metadata_only: true,
    read_only: true,
    recording_enabled: false,
    voice_enabled: false,
    export_enabled: false,
    narration_enabled: false,
    ffmpeg_enabled: false,
  };
  return parseDemoScript(script);
}

// ---------------------------------------------------------------------------
// General — simple request → Human Gate → Reality
// ---------------------------------------------------------------------------

function makeGeneralScript(): DemoScript {
  const assembly = makeAssemblySegment();

  const flow: DemoSegment = {
    segment_id: "segment:general:flow",
    kind: "narrative",
    label: "Simple request",
    description:
      "One request enters Space, halts at the gate, then touches Reality.",
    duration_ms: 4800,
    cues: [
      {
        cue_id: "general:request",
        at_ms: 0,
        kind: "pulse",
        target: "space-edge:input-to-intent",
        note: '"JARVIS, set the room to focus."',
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "general:gate_halt",
        at_ms: 1600,
        kind: "halt",
        target: "human-gate",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "general:approve",
        at_ms: 2800,
        kind: "approve",
        target: "human-gate",
        metadata_only: true,
        read_only: true,
      },
      {
        cue_id: "general:reality",
        at_ms: 3600,
        kind: "highlight_zone",
        target: "reality",
        note: "Theme engine syncs the room",
        metadata_only: true,
        read_only: true,
      },
    ],
    metadata_only: true,
    read_only: true,
  };

  const segments = [assembly, flow];
  const script: DemoScript = {
    script_id: "demo:general",
    audience: "general",
    title: "Plain-language walkthrough",
    subtitle: "Ask a question. The gate decides. The room responds.",
    total_duration_ms: sumSegmentDurations(segments),
    segments,
    showcased_zones: ["space", "reality"],
    metadata_only: true,
    read_only: true,
    recording_enabled: false,
    voice_enabled: false,
    export_enabled: false,
    narration_enabled: false,
    ffmpeg_enabled: false,
  };
  return parseDemoScript(script);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

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

/** Deny-by-default loader — unknown name falls back to `recruiter`. */
export function loadDemoScript(name?: string): DemoScript {
  if (
    typeof name === "string" &&
    Object.prototype.hasOwnProperty.call(DEMO_SCRIPTS, name)
  ) {
    return DEMO_SCRIPTS[name as DemoScriptName];
  }
  return DEMO_SCRIPT_RECRUITER;
}
