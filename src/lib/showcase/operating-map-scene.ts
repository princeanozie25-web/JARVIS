// SCENE 1 — THE OPERATING MAP: the whole governed system as one living graph,
// the Human Gate at its gravitational center.
//
// This module is a PURE PROJECTION ADAPTER (I-SHOW-2): it takes the cockpit's
// EXISTING read view-models (the same objects the audited cockpit renders —
// buildWorkingCommandCenterModel / loadCockpitWorkflowbox / the E-020 voice
// view) and reshapes them into a SceneDescription. It reads nothing itself,
// mutates nothing, and invents nothing: every node/edge/state below traces to
// a field of those projections, and the provenance badge says honestly whether
// the backing rows were live or the documented labelled sample.

import type {
  WorkingCommandCenterModel,
  WorkingGateProposal,
} from "@/lib/command-center/liquid-command-center-data";
import type { CockpitWorkflowbox } from "@/app/working/workflowbox-live";
import type { CockpitVoiceView } from "@/components/working/voice-view";

import type {
  SceneChip,
  SceneDescription,
  SceneEdge,
  SceneNode,
  SceneProvenance,
} from "./scene";

export const GATE_NODE_ID = "human-gate";

const STAGE_LABELS: Record<WorkingGateProposal["lifecycle"][number], string> = {
  dry_run: "Dry run",
  approval: "Approval",
  execute: "Execute",
  verify: "Verify",
  audit_event: "Audit event",
};

export interface OperatingMapInputs {
  readonly model: WorkingCommandCenterModel;
  readonly workflowbox: CockpitWorkflowbox;
  readonly voice: CockpitVoiceView;
}

export function buildOperatingMapScene(
  inputs: OperatingMapInputs,
): SceneDescription {
  const { model, workflowbox, voice } = inputs;
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];

  // --- the center: the Human Gate ------------------------------------------
  // A pending proposal is REAL Gate state — the heart pulses amber for it.
  const pending = model.proposal !== undefined;
  nodes.push({
    id: GATE_NODE_ID,
    label: "Human Gate",
    sublabel: pending ? model.proposal.id : "no proposal pending",
    tone: "gate",
    state: pending ? "pending" : "calm",
    weight: 1,
    ring: 0,
  });

  // --- ring 1: the proposal lifecycle (the governed pipeline) --------------
  // The five stages come straight off the proposal's lifecycle field; the
  // approval stage is the Gate-touching one and lights amber while pending.
  const lifecycle = model.proposal.lifecycle;
  lifecycle.forEach((stage, index) => {
    const isApproval = stage === "approval";
    const id = `stage-${stage}`;
    nodes.push({
      id,
      label: STAGE_LABELS[stage],
      sublabel: stage,
      tone: isApproval ? "gate" : "signal",
      state: isApproval && pending ? "pending" : "calm",
      weight: 0.55,
      ring: 1,
      angle: -Math.PI / 2 + (2 * Math.PI * index) / lifecycle.length,
    });
    if (index > 0) {
      edges.push({
        from: `stage-${lifecycle[index - 1]}`,
        to: id,
        tone: "signal",
        flow: 0.35,
      });
    }
  });
  // The approval stage IS the Gate's moment — the amber thread ties them.
  edges.push({
    from: GATE_NODE_ID,
    to: "stage-approval",
    tone: "gate",
    flow: pending ? 1 : 0.15,
  });

  // --- ring 2: the governed surfaces ----------------------------------------
  nodes.push({
    id: "surface-chat",
    label: "Chat",
    sublabel: model.chat.proposalChip,
    tone: "accent",
    state: pending ? "active" : "calm",
    weight: 0.7,
    ring: 2,
  });
  // The chat authored the proposal: its thread feeds the Gate.
  edges.push({
    from: "surface-chat",
    to: GATE_NODE_ID,
    tone: "gate",
    flow: pending ? 0.9 : 0.1,
  });

  const voiceDegraded =
    voice.failed_over || voice.providers.some((p) => !p.ok || p.degraded);
  nodes.push({
    id: "surface-voice",
    label: "Voice",
    sublabel: voice.selected_provider,
    tone: "signal",
    state: voiceDegraded ? "active" : "calm",
    weight: 0.6,
    ring: 2,
  });
  edges.push({
    from: "surface-voice",
    to: "surface-chat",
    tone: "signal",
    flow: 0.4,
  });

  nodes.push({
    id: "surface-workflowbox",
    label: "WorkflowBox",
    sublabel: `${workflowbox.lane.projects.length} project${workflowbox.lane.projects.length === 1 ? "" : "s"}`,
    tone: "life",
    state: workflowbox.lane.projects.length > 0 ? "active" : "empty",
    weight: 0.7,
    ring: 2,
  });

  nodes.push({
    id: "surface-room",
    label: "Room",
    sublabel: `${model.room.length} device${model.room.length === 1 ? "" : "s"}`,
    tone: "accent",
    state: "calm",
    weight: 0.6,
    ring: 2,
  });
  // Execution flows outward from the pipeline to the room — but only through
  // the Gate-governed stages (the map draws what the architecture enforces).
  edges.push({
    from: "stage-execute",
    to: "surface-room",
    tone: "accent",
    flow: 0.3,
  });

  nodes.push({
    id: "surface-audit",
    label: "Audit trail",
    sublabel: `${model.activity.length} recent`,
    tone: "signal",
    state: "calm",
    weight: 0.6,
    ring: 2,
  });
  edges.push({
    from: "stage-audit_event",
    to: "surface-audit",
    tone: "signal",
    flow: 0.5,
  });

  nodes.push({
    id: "surface-observability",
    label: "Observability",
    sublabel: model.marker.toLowerCase(),
    tone: "stone",
    state: "calm",
    weight: 0.55,
    ring: 2,
  });
  edges.push({
    from: "surface-audit",
    to: "surface-observability",
    tone: "stone",
    flow: 0.2,
  });

  // --- ring 3: the real leaves — devices and projects -----------------------
  for (const device of model.room) {
    const id = `device-${slug(device.name)}`;
    nodes.push({
      id,
      label: device.name,
      sublabel: `${device.zone} · ${device.trustClass}`,
      tone: device.trustClass === "observe_only" ? "signal" : "accent",
      state: "calm",
      weight: 0.35,
      ring: 3,
    });
    edges.push({ from: "surface-room", to: id, tone: "stone", flow: 0.12 });
  }

  for (const project of workflowbox.lane.projects) {
    const id = `project-${slug(project.id)}`;
    nodes.push({
      id,
      label: project.title,
      sublabel: `${project.node_count} nodes · ${project.rollup_percent}%`,
      tone: "life",
      state: project.rollup_percent >= 100 ? "done" : "active",
      weight: 0.45,
      fill: project.rollup_percent / 100,
      ring: 3,
    });
    edges.push({
      from: "surface-workflowbox",
      to: id,
      tone: "life",
      flow: Math.max(0.15, project.rollup_percent / 100),
    });
  }

  // --- telemetry chips (mono register strip) --------------------------------
  const chips: SceneChip[] = [
    { label: "GATES", value: String(model.gateCount) },
    ...model.cost.map((metric) => ({
      label: metric.label,
      value: metric.value,
    })),
    {
      label: "VOICE",
      value: voiceDegraded ? "degraded — failed over" : "healthy",
    },
  ];

  return {
    id: "operating-map",
    title: "JARVIS — the operating map",
    subtitle:
      "The governed system, alive. Every mutation waits at the amber heart.",
    centerNodeId: GATE_NODE_ID,
    nodes,
    edges,
    provenance: buildProvenance(inputs),
    chips,
  };
}

// Honest provenance (I-SHOW-2): "live" only where the projection actually
// produced live rows; anything synthetic is said out loud, per source. The
// badge never claims more than the weakest true statement.
function buildProvenance(inputs: OperatingMapInputs): SceneProvenance {
  const { model, workflowbox, voice } = inputs;
  const sources = [
    `workflowbox: ${workflowbox.provenance === "live" ? "live store" : "labelled sample"}`,
    `room: ${model.provenance.room}`,
    `cost: ${model.provenance.cost}`,
    `activity: ${model.provenance.activity}`,
    `voice: ${voice.provenance}`,
  ];
  const allLive =
    workflowbox.provenance === "live" &&
    voice.provenance === "live" &&
    model.provenance.room === "live" &&
    model.provenance.cost === "live" &&
    model.provenance.activity === "live";
  const anyLive =
    workflowbox.provenance === "live" ||
    voice.provenance === "live" ||
    Object.values(model.provenance).includes("live");
  return {
    live: allLive,
    label: allLive
      ? "LIVE GOVERNED STATE"
      : anyLive
        ? "MIXED — LIVE + LABELLED SAMPLE"
        : "LABELLED SAMPLE — SYNTHETIC FIXTURE",
    sources,
  };
}

function slug(input: string): string {
  return input.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
