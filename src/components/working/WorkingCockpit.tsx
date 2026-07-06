"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { WorkflowLane } from "@/components/working/WorkflowLane";
import {
  WorkflowMap,
  type WorkflowMapActions,
} from "@/components/working/WorkflowMap";
import { SYNTHETIC_WORKFLOW_LANE } from "@/components/working/workflow-lane-fixture";
import {
  syntheticCockpitVoiceView,
  type CockpitVoiceView,
} from "@/components/working/voice-view";
import type {
  WorkingActivity,
  WorkingCommandCenterModel,
} from "@/lib/command-center/liquid-command-center-data";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";
import { buildVoicePipelineVisibilityModel } from "@/lib/voice-operating-mode/pipeline-visibility";
import { buildWorkflowMapViewModel } from "@/lib/workflowbox";
import type { WorkflowLaneViewModel } from "@/lib/workflowbox";

export interface WorkingCockpitProps {
  model?: WorkingCommandCenterModel;
  /** v1b — the WorkflowBox lane view-model. E-019: the route passes the LIVE
   * store projection when real projects exist; the default is the fixture,
   * labelled "sample" via `laneProvenance`. */
  lane?: WorkflowLaneViewModel;
  /** E-019 per-panel provenance: "live" iff `lane` came from the live store. */
  laneProvenance?: "live" | "sample";
  /** E-019: the ONE mutation-callback object (host-wired to the v1a store's
   * single API — server actions from the route). Passed to BOTH the lane and
   * the map so a mark from either is the SAME store op. Omitted => display. */
  laneActions?: WorkflowMapActions;
  /** E-020: initial voice-pill view (tests/SSR). Defaults to the honest
   * synthetic Phase 22 picture until real probes report. */
  voiceView?: CockpitVoiceView;
  /** E-020: read-only health reader (a server action from the route). Called
   * once after mount to upgrade the pill to the REAL probed engine status.
   * Strictly display: it returns data and can trigger no synthesis. */
  voiceHealthReader?: () => Promise<CockpitVoiceView>;
}

const FALLBACK_WORKING_MODEL: WorkingCommandCenterModel = {
  marker: SYNTHETIC_OBSERVABILITY_MARKER,
  gateCount: 1,
  // Capstone honesty pass: non-staling truths — no phase number that rots, no
  // hardcoded test count shaped like a live claim (the gate is a property:
  // every commit runs the full suite in the pre-commit hook).
  phase: "Expansion Era - post-Phase-24",
  testCount: "full suite gated in-hook",
  chat: {
    operator: "Can you set the office for deep work?",
    assistant:
      "I cannot act directly. I prepared a room proposal in the Human Gate for your approval.",
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
      name: "Nanoleaf wall",
      zone: "office",
      state: "SCENE - FOCUS",
      trustClass: "safe_mutate",
    },
    {
      name: "Door sensor",
      zone: "entry",
      state: "CLOSED",
      trustClass: "observe_only",
    },
  ],
  cost: [
    { label: "TODAY", value: "$1.82 / $3.00", pct: 61 },
    { label: "WEEK", value: "$11.40 / $40.00", pct: 29 },
    { label: "LOCAL", value: "76%" },
    { label: "CLOUD", value: "24%" },
  ],
  provenance: { room: "synthetic", cost: "synthetic", activity: "synthetic" },
  activity: [
    {
      ts: "09:31",
      tag: "VOICE",
      text: "Wake event observed - conversation active - T0 route available",
    },
    {
      ts: "09:28",
      tag: "PROP",
      text: "Chat created room proposal prop-room-1842",
    },
    {
      ts: "09:21",
      tag: "INFO",
      text: "Cost rollup refreshed from metadata projection",
    },
    {
      ts: "09:14",
      tag: "INFO",
      text: "Local model warm - llama3.2:3b ready",
    },
  ],
  voiceActivity: buildVoicePipelineVisibilityModel().events,
};

export function WorkingCockpit({
  model = FALLBACK_WORKING_MODEL,
  lane = SYNTHETIC_WORKFLOW_LANE,
  laneProvenance = "sample",
  laneActions,
  voiceView,
  voiceHealthReader,
}: WorkingCockpitProps) {
  const clock = useClock();
  const depthRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(model.gateCount);
  const [resolved, setResolved] = useState<string | null>(null);
  const [events, setEvents] = useState<readonly WorkingActivity[]>(
    model.activity,
  );
  // E-020: the pill starts on the honest synthetic default and upgrades to
  // the REAL probed engine picture when the read-only reader reports.
  const [voice, setVoice] = useState<CockpitVoiceView>(
    voiceView ?? syntheticCockpitVoiceView(),
  );

  useEffect(() => {
    if (!voiceHealthReader) return;
    let alive = true;
    voiceHealthReader()
      .then((view) => {
        if (alive && view) setVoice(view);
      })
      .catch(() => {
        // fail-closed: keep the labelled synthetic default
      });
    return () => {
      alive = false;
    };
  }, [voiceHealthReader]);

  useBackgroundParallax(depthRef);

  function flashGate() {
    gateRef.current?.animate(
      [
        { boxShadow: "0 0 6vmin rgba(255,150,40,.10)" },
        { boxShadow: "0 0 9vmin rgba(255,170,70,.50)" },
        { boxShadow: "0 0 6vmin rgba(255,150,40,.10)" },
      ],
      { duration: 900 },
    );
  }

  function resolveGate(approved: boolean) {
    if (resolved) return;
    const now = clock === "00:00" ? "now" : clock;
    setPending(0);
    // Capstone honesty pass (SI-3): this gate is an interactive DEMO — it
    // writes NO audit row and performs NO action, and its copy must say so.
    // The real Human Gate lifecycle (Phase 18) persists its audit elsewhere;
    // this surface must never claim that work as its own.
    if (approved) {
      setResolved(
        model.proposal.executionAvailable
          ? "Approved - executed - verified"
          : "Approved (demo) - execution blocked pending real service - no audit row written",
      );
      setEvents((current) => [
        {
          ts: now,
          tag: "INFO",
          text: `${model.proposal.id} demo lifecycle simulated - not persisted: dry-run -> approval -> execute -> verify`,
        },
        ...current,
      ]);
      return;
    }
    setResolved("Denied (demo) - no side effect taken - nothing persisted");
    setEvents((current) => [
      {
        ts: now,
        tag: "INFO",
        text: `${model.proposal.id} denied in the demo gate - not persisted`,
      },
      ...current,
    ]);
  }

  return (
    <section
      aria-label="JARVIS Working Cockpit"
      className="jcc jcc-working"
      data-command-center-shell="working-liquid-glass"
      data-command-center-route="working"
      data-working-cockpit="working-cockpit"
      data-working-shell="approval-gated"
      data-only-mutator="human-gate"
      data-voice-tts-provider={voice.selected_provider}
      data-voice-tts-provenance={voice.provenance}
      data-voice-tts-failed-over={String(voice.failed_over)}
      data-observability-marker={model.marker}
    >
      <CommandCenterField depthRef={depthRef} />

      <main className="jcc-stage jcc-shell-stage">
        <header className="jcc-topbar">
          <div className="jcc-brand">
            <div className="jcc-brand-name">Working Cockpit</div>
            <div className="jcc-brand-sub">SYNTHETIC - METADATA-ONLY</div>
          </div>
          <CommandCenterNav active="working" />
          <div className="jcc-pills">
            <StatusPill label="PIPELINE" value="no-int" />
            <StatusPill
              label="GATE"
              value={pending === 0 ? "clear" : `${pending} pending`}
              warn={pending > 0}
            />
            <StatusPill label="MODEL" value="local-primary" />
            {/* E-020: real probed engine status, honestly labelled — LIVE
                when probes ran (even if they say "down"), SYNTHETIC when the
                Phase 22 default picture is all we have. */}
            <StatusPill
              label={`TTS - ${voice.provenance.toUpperCase()}`}
              value={voicePillValue(voice)}
              warn={
                voice.provenance === "live" &&
                (voice.failed_over ||
                  !voice.providers.some((entry) => entry.ok))
              }
            />
            <StatusPill label="CLOCK" value={clock} />
          </div>
        </header>

        <div className="jcc-work-grid">
          <div className="jcc-col">
            <LeftRail phase={model.phase} />
          </div>

          <div className="jcc-col">
            <section className="jcc-chat jcc-glass">
              <PanelHead label="CHAT" tag="CHAT ADAPTER" />
              <div className="jcc-body-scroll">
                <Message who="OPERATOR" text={model.chat.operator} />
                <Message who="JARVIS" text={model.chat.assistant} jarvis />
                <div
                  className="jcc-chip"
                  role="button"
                  tabIndex={0}
                  onClick={flashGate}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      flashGate();
                    }
                  }}
                >
                  {model.chat.proposalChip} -&gt;
                </div>
              </div>
              <div className="jcc-composer">
                <div className="note">PROPOSE-ONLY INPUT</div>
                <div className="inp">Ask, draft, or prepare a proposal...</div>
              </div>
            </section>
          </div>

          <div className="jcc-col">
            <section
              ref={gateRef}
              className={`jcc-gate jcc-glass ${resolved ? "resolved" : ""}`}
              data-human-gate-panel="true"
              data-only-path-to-side-effects="true"
              data-mutator-entrypoint="human-gate-approval-lifecycle"
              data-approval-service={model.proposal.approvalService}
              data-execution-available={String(
                model.proposal.executionAvailable,
              )}
            >
              <div className="jcc-panel-head">
                <div>
                  <div className="jcc-label">HUMAN GATE</div>
                  <div className="jcc-gate-title">Approve - Deny - Verify</div>
                  <div className="jcc-gate-sub">
                    THE ONLY PATH TO SIDE EFFECTS
                  </div>
                </div>
                <span className="jcc-gate-only">GATED</span>
              </div>
              <div className="jcc-gate-body">
                <div className="jcc-live-prop">
                  <div className="jcc-prop-meta">
                    {model.proposal.id} - {model.proposal.kind} -{" "}
                    {model.proposal.tier} - {model.proposal.trustClass}
                  </div>
                  <div className="jcc-prop-title">{model.proposal.title}</div>
                  <div className="jcc-diff">
                    <div className="h">DRY-RUN DIFF</div>
                    <div className="d">
                      {model.proposal.diffBefore} <b>-&gt;</b>{" "}
                      {model.proposal.diffAfter}
                    </div>
                  </div>
                  <div className="jcc-gate-foot">
                    <div className="jcc-expiry">
                      EXPIRES IN <span>{model.proposal.expiresIn}</span>
                    </div>
                    <div className="jcc-buttons">
                      <button
                        type="button"
                        className="jcc-btn deny wc-gate-deny"
                        onClick={() => resolveGate(false)}
                      >
                        DENY
                      </button>
                      <button
                        type="button"
                        className="jcc-btn approve wc-gate-approve"
                        onClick={() => resolveGate(true)}
                      >
                        APPROVE
                      </button>
                    </div>
                  </div>
                </div>
                <div className="jcc-resolved-msg">{resolved}</div>
              </div>
            </section>
          </div>

          <div className="jcc-col">
            <ContextPanels model={model} events={events} />
          </div>
        </div>

        {/* E-019: ONE lane view-model + ONE actions object feed BOTH views —
            the single-source-of-truth / mark-from-either guarantee, now over
            the live store when provenance is "live". */}
        <div
          data-workflowbox-provenance={laneProvenance}
          data-panel-provenance={
            laneProvenance === "live" ? "live" : "synthetic"
          }
        >
          <div className="jcc-label wfl-provenance">
            WORKFLOWBOX - {laneProvenance.toUpperCase()}
          </div>
          <WorkflowLane model={lane} actions={laneActions} />

          <WorkflowMap
            model={buildWorkflowMapViewModel(lane)}
            actions={laneActions}
          />
        </div>

        <footer className="jcc-statusbar">
          <span>
            STATUS <b>NORMAL</b>
          </span>
          <span>
            TESTS <b>{model.testCount}</b>
          </span>
          <span>
            GATE <b>{pending === 0 ? "0 PENDING" : `${pending} PENDING`}</b>
          </span>
          <span>
            RUNTIME <b>LOCAL-FIRST</b>
          </span>
          <span>
            BUILD <b>{model.phase.replace(" active", "")}</b>
          </span>
        </footer>
      </main>
    </section>
  );
}

function LeftRail({ phase }: { phase: string }) {
  return (
    <aside className="jcc-rail jcc-glass">
      <div className="jcc-rail-group">WORKFLOWS</div>
      <RailItem label="Project" detail="chat - room - cost - activity" active />
      <RailItem label="Research" detail="agents - gate - vault" />
      <RailItem label="Build Monitor" detail="repos - alerts - deadlines" />
      <RailItem label="Morning Brief" detail="digest - suggestions - gate" />
      <div className="jcc-rail-group">SYSTEM</div>
      {["Inbox", "Audit", "Cost", "Room"].map((item) => (
        <RailItem key={item} label={item} />
      ))}
      <div className="jcc-phase">
        <div className="t">{phase}</div>
        <div className="d">
          Expansion Era - governed operationalisation - UI polish
        </div>
        <div className="jcc-bar">
          <i style={{ width: "64%" }} />
        </div>
      </div>
    </aside>
  );
}

function RailItem({
  label,
  detail,
  active = false,
}: Readonly<{ label: string; detail?: string; active?: boolean }>) {
  return (
    <div className={`jcc-navitem ${active ? "on" : ""}`}>
      <div className="t">{label}</div>
      {detail ? <div className="d">{detail}</div> : null}
    </div>
  );
}

function ContextPanels({
  model,
  events,
}: Readonly<{
  model: WorkingCommandCenterModel;
  events: readonly WorkingActivity[];
}>) {
  return (
    <>
      <section
        className="jcc-context jcc-glass"
        data-read-only-context-panel="room"
        data-panel-provenance={model.provenance.room}
      >
        <PanelHead
          label="ROOM"
          tag={`OBSERVABILITY - ${model.provenance.room.toUpperCase()}`}
        />
        <div className="jcc-context-body">
          {model.room.map((device) => (
            <div key={`${device.zone}-${device.name}`} className="jcc-device">
              <div>
                <div className="n">{device.name}</div>
                <div className="sub">{device.zone}</div>
              </div>
              <div className="st">
                <div>{device.state}</div>
                <div
                  className={
                    device.trustClass === "safe_mutate" ? "safe" : "observe"
                  }
                >
                  {device.trustClass.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="jcc-context two jcc-glass"
        data-read-only-context-panel="cost"
        data-panel-provenance={model.provenance.cost}
      >
        <PanelHead
          label="COST"
          tag={`OBSERVABILITY - ${model.provenance.cost.toUpperCase()}`}
        />
        <div className="jcc-context-body">
          <div className="jcc-cost-grid">
            {model.cost.map((metric) => (
              <div key={metric.label} className="jcc-metric">
                <div className="k">{metric.label}</div>
                <div className="v">{metric.value}</div>
                {typeof metric.pct === "number" ? (
                  <div className="jcc-bar">
                    <i style={{ width: `${metric.pct}%` }} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="jcc-context three jcc-glass"
        data-read-only-context-panel="activity"
        data-panel-provenance={model.provenance.activity}
        style={{ flex: 1, minHeight: 0 }}
      >
        <PanelHead
          label="ACTIVITY"
          tag={`OBSERVABILITY - ${model.provenance.activity.toUpperCase()}`}
        />
        <div className="jcc-context-body" style={{ overflowY: "auto" }}>
          <div className="jcc-activity">
            {events.map((event) => (
              <div key={`${event.ts}-${event.tag}-${event.text}`}>
                <div className="ts">
                  {event.ts} - {event.tag}
                </div>
                <div className="tx">{event.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function PanelHead({ label, tag }: Readonly<{ label: string; tag?: string }>) {
  return (
    <div className="jcc-panel-head">
      <span className="jcc-label">{label}</span>
      {tag ? <span className="jcc-tag">{tag}</span> : null}
    </div>
  );
}

function Message({
  who,
  text,
  jarvis = false,
}: Readonly<{ who: string; text: string; jarvis?: boolean }>) {
  return (
    <div className={`jcc-msg ${jarvis ? "jarvis" : ""}`}>
      <div className="who">{who}</div>
      <div className="txt">{text}</div>
    </div>
  );
}

// E-020: the pill headline stays honest in every live state — "(failover)"
// when a lower engine is the live pick, "(down)" when NO engine probed
// healthy. The synthetic default renders unadorned (it is labelled by the
// pill's SYNTHETIC tag, not disguised as a probe result).
function voicePillValue(voice: CockpitVoiceView): string {
  if (voice.provenance !== "live") return voice.selected_provider;
  if (!voice.providers.some((entry) => entry.ok)) {
    return `${voice.selected_provider} (down)`;
  }
  if (voice.failed_over) return `${voice.selected_provider} (failover)`;
  return voice.selected_provider;
}

function StatusPill({
  label,
  value,
  warn = false,
}: Readonly<{ label: string; value: string; warn?: boolean }>) {
  return (
    <div className="jcc-pill">
      <div className="jcc-pill-key">{label}</div>
      <div className={`jcc-pill-value ${warn ? "warn" : ""}`}>{value}</div>
    </div>
  );
}

function CommandCenterField({
  depthRef,
}: Readonly<{ depthRef: RefObject<HTMLDivElement | null> }>) {
  return (
    <>
      <div className="jcc-field" />
      <div ref={depthRef} className="jcc-depth">
        <div className="jcc-blob jcc-b1" />
        <div className="jcc-blob jcc-b2" />
        <div className="jcc-blob jcc-b3" />
      </div>
      <div className="jcc-grain" />
    </>
  );
}

function useClock() {
  const [clock, setClock] = useState("00:00");

  useEffect(() => {
    function update() {
      const date = new Date();
      setClock(
        `${String(date.getHours()).padStart(2, "0")}:${String(
          date.getMinutes(),
        ).padStart(2, "0")}`,
      );
    }
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return clock;
}

function useBackgroundParallax(depthRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let frameId = 0;

    function onMouseMove(event: MouseEvent) {
      targetX = event.clientX / window.innerWidth - 0.5;
      targetY = event.clientY / window.innerHeight - 0.5;
    }

    function frame() {
      x += (targetX - x) * 0.05;
      y += (targetY - y) * 0.05;
      if (depthRef.current) {
        depthRef.current.style.transform = `translate(${x * 10}px, ${y * 10}px)`;
      }
      frameId = window.requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMouseMove);
    frameId = window.requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.cancelAnimationFrame(frameId);
    };
  }, [depthRef]);
}
