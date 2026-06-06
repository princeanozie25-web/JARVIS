"use client";

import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import type {
  AuditCommandCenterModel,
  AuditStage,
  AuditTrace,
} from "@/lib/command-center/liquid-command-center-data";

export interface AuditCockpitProps {
  model: AuditCommandCenterModel;
}

const STAGE_COLORS: Record<AuditStage["tone"], string> = {
  cyan: "#5fe6e0",
  blue: "#86bcff",
  green: "#74e8b4",
  amber: "#ffb24d",
  red: "#ff6b6b",
  dim: "#8ea4c4",
};

const TRUST_SWATCH = {
  observe_only: "var(--tc-observe)",
  safe_mutate: "var(--tc-safe)",
  restricted_mutate: "var(--tc-restricted)",
  forbidden: "var(--tc-forbidden)",
} as const;

export function AuditCockpit({ model }: AuditCockpitProps) {
  const clock = useClock();
  const depthRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState(() => ({
    traceIndex: 0,
    stageIndex: Math.max(0, (model.traces[0]?.stages.length ?? 1) - 1),
  }));
  const trace = model.traces[selection.traceIndex] ?? model.traces[0];
  const stageIndex = Math.min(
    selection.stageIndex,
    Math.max(0, trace.stages.length - 1),
  );

  useBackgroundParallax(depthRef);

  const scrubPct =
    trace.stages.length === 0
      ? 100
      : ((stageIndex + 1) / trace.stages.length) * 100;
  const sparkPoints = useMemo(
    () => sparklinePoints(model.sparkline),
    [model.sparkline],
  );

  return (
    <section
      aria-label="JARVIS Audit"
      className="jcc jcc-audit"
      data-command-center-shell="audit-liquid-glass"
      data-command-center-route="audit"
      data-audit-cockpit="read-only-fortress"
      data-audit-shell="read-only"
      data-audit-authority={model.surfaceAuthority}
      data-metadata-only="true"
      data-zero-mutation="true"
      data-replay-non-executable={String(model.replayNonExecutable)}
      data-observability-marker={model.marker}
    >
      <CommandCenterField depthRef={depthRef} />

      <main className="jcc-stage jcc-shell-stage">
        <header className="jcc-topbar">
          <div className="jcc-brand">
            <div className="jcc-brand-name">Audit</div>
            <div className="jcc-brand-sub">
              FORENSIC - READ-ONLY OBSERVABILITY
            </div>
          </div>
          <CommandCenterNav active="audit" />
          <div className="jcc-pills">
            <StatusPill label="TRACES" value={model.traceCountLabel} />
            <StatusPill label="INTEGRITY" value={model.integrity} ok />
            <StatusPill label="RETENTION" value={model.retention} />
            <StatusPill label="CLOCK" value={clock} />
          </div>
        </header>

        <div className="jcc-audit-grid">
          <div className="jcc-col">
            <section className="jcc-timeline jcc-glass">
              <PanelHead label="TRACE TIMELINE" tag="READ-ONLY" readOnly />
              <div
                className="jcc-body-scroll"
                data-trace-selection="inspection-only"
              >
                {model.traces.map((item, index) => (
                  <TraceItem
                    key={item.id}
                    trace={item}
                    active={index === selection.traceIndex}
                    onSelect={() =>
                      setSelection({
                        traceIndex: index,
                        stageIndex: Math.max(0, item.stages.length - 1),
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="jcc-col">
            <section className="jcc-replay jcc-glass">
              <div className="jcc-panel-head">
                <span className="jcc-label">REPLAY VIEWER</span>
                <span className="jcc-replay-tag">
                  METADATA-ONLY - NON-EXECUTABLE
                </span>
              </div>
              <div className="jcc-replay-head">
                <div className="q">{trace.question}</div>
                <div className="m">{trace.model}</div>
              </div>
              <div className="jcc-stages" data-raw-payloads-rendered="false">
                {trace.stages.map((stage, index) => (
                  <StageRow
                    key={`${stage.name}-${index}`}
                    stage={stage}
                    dim={index > stageIndex}
                    onSelect={() =>
                      setSelection((current) => ({
                        ...current,
                        stageIndex: index,
                      }))
                    }
                  />
                ))}
              </div>
              <div className="jcc-scrub" data-replay-control="inspection-only">
                <div
                  className="jcc-scrub-control"
                  tabIndex={0}
                  aria-label="Previous replay metadata stage"
                  onClick={() =>
                    setSelection((current) => ({
                      ...current,
                      stageIndex: Math.max(0, current.stageIndex - 1),
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelection((current) => ({
                        ...current,
                        stageIndex: Math.max(0, current.stageIndex - 1),
                      }));
                    }
                  }}
                >
                  &lt;
                </div>
                <div className="jcc-scrub-track">
                  <i style={{ width: `${scrubPct}%` }} />
                </div>
                <div
                  className="jcc-scrub-control"
                  tabIndex={0}
                  aria-label="Next replay metadata stage"
                  onClick={() =>
                    setSelection((current) => ({
                      ...current,
                      stageIndex: Math.min(
                        trace.stages.length - 1,
                        current.stageIndex + 1,
                      ),
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelection((current) => ({
                        ...current,
                        stageIndex: Math.min(
                          trace.stages.length - 1,
                          current.stageIndex + 1,
                        ),
                      }));
                    }
                  }}
                >
                  &gt;
                </div>
                <div className="jcc-scrub-pos">
                  {stageIndex + 1} / {trace.stages.length}
                </div>
              </div>
            </section>
          </div>

          <div className="jcc-col">
            <section className="jcc-context jcc-glass">
              <PanelHead label="GOVERNANCE BOUNDARY" />
              <div className="jcc-context-body">
                <div className="jcc-tripwire" data-tripwire-status="armed">
                  <span className="dot" />
                  <span>
                    TRIPWIRE ARMED - {model.forbiddenEdgesObserved} FORBIDDEN
                    EDGES OBSERVED
                  </span>
                </div>
                {model.trustClasses.map((item) => (
                  <div
                    key={item.id}
                    className="jcc-trust-row"
                    data-trust-class={item.id}
                  >
                    <div className="l">
                      <span
                        className="sw"
                        style={{ background: TRUST_SWATCH[item.id] }}
                      />
                      {item.label}
                    </div>
                    <div className="c">{item.detail}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="jcc-context two jcc-glass">
              <PanelHead label="TELEMETRY" />
              <div className="jcc-context-body">
                <div className="jcc-telemetry-grid">
                  {model.telemetry.map((metric) => (
                    <div key={metric.label} className="jcc-metric">
                      <div className="k">{metric.label}</div>
                      <div className="v">{metric.value}</div>
                    </div>
                  ))}
                </div>
                <svg
                  className="jcc-spark"
                  viewBox="0 0 300 44"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline
                    fill="none"
                    stroke="#5fe6e0"
                    strokeWidth="1.5"
                    opacity="0.8"
                    points={sparkPoints}
                  />
                  <polyline
                    fill="rgba(95,230,224,0.08)"
                    stroke="none"
                    points={`0,44 ${sparkPoints} 300,44`}
                  />
                </svg>
              </div>
            </section>

            <section
              className="jcc-context three jcc-glass"
              style={{ flex: 1, minHeight: 0 }}
            >
              <PanelHead label="DISABLED MATRIX" />
              <div className="jcc-context-body" style={{ overflowY: "auto" }}>
                {model.disabledFeatures.map((feature) => (
                  <div
                    key={feature.name}
                    className="jcc-disabled-row"
                    data-disabled-feature={feature.name}
                  >
                    <span>{feature.name}</span>
                    <span className="s">{feature.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className="jcc-statusbar">
          <span>
            SURFACE <b>READ-ONLY</b>
          </span>
          <span>
            <b>NO ACTION AUTHORITY</b>
          </span>
          <span>
            STORE <b>APPEND-ONLY</b>
          </span>
          <span>
            REPLAY <b>NON-EXECUTABLE</b>
          </span>
          <span>
            BUILD <b>PHASE 21</b>
          </span>
        </footer>
      </main>
    </section>
  );
}

function TraceItem({
  trace,
  active,
  onSelect,
}: Readonly<{
  trace: AuditTrace;
  active: boolean;
  onSelect: () => void;
}>) {
  return (
    <div
      className={`jcc-trace ${active ? "on" : ""}`}
      tabIndex={0}
      data-trace-id={trace.id}
      data-trace-selection-only="true"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="jcc-trace-top">
        <span className="ts">{trace.ts}</span>
        <span className={`st ${trace.status}`}>{trace.statusLabel}</span>
      </div>
      <div className="ti">{trace.title}</div>
      <div className="mt">{trace.meta}</div>
    </div>
  );
}

function StageRow({
  stage,
  dim,
  onSelect,
}: Readonly<{
  stage: AuditStage;
  dim: boolean;
  onSelect: () => void;
}>) {
  const style = {
    "--stage-color": STAGE_COLORS[stage.tone],
  } as CSSProperties;

  return (
    <div
      className={`jcc-stage-row ${dim ? "dim" : ""}`}
      style={style}
      tabIndex={0}
      data-replay-stage={stage.name}
      data-stage-trigger="none"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="node" />
      <div className="nm">{stage.name}</div>
      <div className="meta">{stage.meta}</div>
      {stage.redactionTag ? (
        <div className="red">{stage.redactionTag}</div>
      ) : null}
    </div>
  );
}

function PanelHead({
  label,
  tag,
  readOnly = false,
}: Readonly<{ label: string; tag?: string; readOnly?: boolean }>) {
  return (
    <div className="jcc-panel-head">
      <span className="jcc-label">{label}</span>
      {tag ? (
        <span className={`jcc-tag ${readOnly ? "ro" : ""}`}>{tag}</span>
      ) : null}
    </div>
  );
}

function StatusPill({
  label,
  value,
  ok = false,
}: Readonly<{ label: string; value: string; ok?: boolean }>) {
  return (
    <div className="jcc-pill">
      <div className="jcc-pill-key">{label}</div>
      <div className={`jcc-pill-value ${ok ? "ok" : ""}`}>{value}</div>
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

function sparklinePoints(values: readonly number[]): string {
  if (values.length === 0) return "0,24 300,24";
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 300;
      const y = 40 - (value / max) * 32;
      return `${x.toFixed(0)},${y.toFixed(0)}`;
    })
    .join(" ");
}
