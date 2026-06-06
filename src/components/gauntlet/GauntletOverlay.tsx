"use client";

import type { CSSProperties } from "react";

import {
  GAUNTLET_LOD_THRESHOLDS,
  type GauntletCanvasTelemetry,
  type GauntletFocusTarget,
  type GauntletScreenLabel,
  type GauntletZoneId,
} from "./GauntletCanvas";
import { GauntletPipeline } from "./GauntletPipeline";

interface GauntletOverlayProps {
  focusTarget: GauntletFocusTarget;
  telemetry: GauntletCanvasTelemetry;
  onFocus: (target: GauntletFocusTarget) => void;
}

const FOCUS_TARGETS: readonly {
  id: GauntletFocusTarget;
  label: string;
  description: string;
}[] = [
  { id: "overview", label: "Overview", description: "Full cosmos" },
  { id: "human_gate", label: "Human Gate", description: "Authority centre" },
  { id: "space", label: "Space", description: "Tesseract routing" },
  { id: "time", label: "Time", description: "Agent orbit" },
  { id: "mind", label: "Mind", description: "Council orbit" },
  { id: "soul", label: "Soul", description: "Memory orbit" },
  { id: "reality", label: "Reality", description: "Room orbit" },
  { id: "power", label: "Power", description: "Policy orbit" },
];

const ZONE_ORDER: readonly GauntletZoneId[] = [
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
];

export function GauntletOverlay({
  focusTarget,
  telemetry,
  onFocus,
}: GauntletOverlayProps) {
  const visibleLabels = declutterLabels(
    telemetry.screenLabels.filter((label) => {
      if (!label.visible) return false;
      if (label.kind === "attribute") {
        return label.zoneId === focusTarget && label.lod === "near";
      }
      return true;
    }),
  );
  const focusedZone =
    focusTarget !== "overview" && focusTarget !== "human_gate"
      ? focusTarget
      : null;

  return (
    <section
      id="gauntlet-pipeline"
      aria-label="Navigable cosmic system map"
      data-gauntlet-react-overlay="truth-layer"
      data-gauntlet-overlay-owns-labels="true"
      data-gauntlet-overlay-owns-metadata="true"
      data-gauntlet-overlay-owns-approval="false"
      data-gauntlet-cinematic-stage="galaxy-map"
      className="jarvis-gauntlet-overlay pointer-events-none absolute inset-0 z-10"
    >
      <div className="jarvis-gauntlet-titleplate pointer-events-none">
        <p className="font-mono text-[0.68rem] uppercase text-cyan-100/72">
          JARVIS - Cosmic System Map
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
          Navigable Constellation Audit
        </h1>
        <p className="mt-2 max-w-[34rem] text-sm leading-6 text-slate-300/72">
          Metadata-only governance surface. No execute, approve, mutation,
          recording, voice, export, or live telemetry subscription controls.
        </p>
      </div>

      <div
        aria-label="Cosmic map labels"
        data-gauntlet-label-layer="lod-react-overlay"
        className="absolute inset-0"
      >
        {visibleLabels.map((label) =>
          label.kind === "attribute" ? (
            <span
              key={label.id}
              data-gauntlet-node-label={label.id}
              data-gauntlet-node-label-zone={label.zoneId}
              data-gauntlet-label-lod={label.lod}
              className="jarvis-gauntlet-node-label"
              style={labelStyle(label)}
            >
              {label.label}
            </span>
          ) : (
            <button
              key={label.id}
              type="button"
              data-gauntlet-constellation-label={label.id}
              data-gauntlet-label-lod={label.lod}
              className="jarvis-gauntlet-constellation-label pointer-events-auto"
              style={labelStyle(label)}
              onClick={() => onFocus(label.id as GauntletFocusTarget)}
            >
              {label.label}
            </button>
          ),
        )}
      </div>

      <aside
        aria-label="LOD status"
        data-gauntlet-lod-status="distance-based"
        className="jarvis-gauntlet-lod-readout pointer-events-none"
      >
        <p className="font-mono text-[0.62rem] uppercase text-slate-400">
          LOD thresholds: near {"<="} {GAUNTLET_LOD_THRESHOLDS.near}, mid {"<="}{" "}
          {GAUNTLET_LOD_THRESHOLDS.far}, far &gt; {GAUNTLET_LOD_THRESHOLDS.far}
        </p>
        <dl className="mt-3 grid gap-2">
          {ZONE_ORDER.map((zone) => (
            <div key={zone} className="grid grid-cols-[5rem_3rem_auto] gap-2">
              <dt className="font-mono text-[0.62rem] uppercase text-slate-300">
                {zone}
              </dt>
              <dd
                className="font-mono text-[0.62rem] uppercase text-cyan-100"
                data-gauntlet-zone-lod={telemetry.lodByZone[zone]}
              >
                {telemetry.lodByZone[zone]}
              </dd>
              <dd className="font-mono text-[0.62rem] text-slate-500">
                {Math.round(telemetry.distanceByZone[zone] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      </aside>

      {focusedZone ? (
        <aside
          aria-label={`${focusedZone} detail status`}
          data-gauntlet-focused-detail={focusedZone}
          className="jarvis-gauntlet-focus-readout pointer-events-none"
        >
          <p className="font-mono text-[0.64rem] uppercase text-cyan-100/70">
            Focus
          </p>
          <p className="mt-1 font-display text-xl capitalize text-white">
            {focusedZone}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300/72">
            Node labels are only visible in near LOD for this constellation.
          </p>
        </aside>
      ) : null}

      <nav
        aria-label="Focus constellations"
        data-gauntlet-navigation-affordance="pan-zoom-focus"
        data-gauntlet-navigation-authority="presentational-only"
        className="jarvis-gauntlet-focus-nav pointer-events-auto"
      >
        {FOCUS_TARGETS.map((target) => (
          <button
            key={target.id}
            type="button"
            data-gauntlet-focus-target={target.id}
            aria-pressed={focusTarget === target.id}
            title={target.description}
            onClick={() => onFocus(target.id)}
          >
            <span>{target.label}</span>
          </button>
        ))}
      </nav>

      <div
        aria-hidden="true"
        data-gauntlet-contract-layer="hidden-read-only-svg"
        className="jarvis-gauntlet-contract-layer"
      >
        <GauntletPipeline presentation="cinematic" />
      </div>
    </section>
  );
}

function labelStyle(label: GauntletScreenLabel): CSSProperties {
  return {
    "--label-x": `clamp(3.5rem, ${label.x}px, calc(100vw - 3.5rem))`,
    "--label-y": `clamp(4.5rem, ${label.y}px, calc(100vh - 7rem))`,
  } as CSSProperties;
}

function declutterLabels(
  labels: readonly GauntletScreenLabel[],
): readonly GauntletScreenLabel[] {
  const kept: GauntletScreenLabel[] = [];
  const sorted = [...labels].sort((a, b) => a.importance - b.importance);

  for (const label of sorted) {
    const minDistance = label.kind === "attribute" ? 42 : 72;
    const overlaps = kept.some(
      (other) =>
        Math.hypot(other.x - label.x, other.y - label.y) < minDistance &&
        other.kind === label.kind,
    );
    if (!overlaps) kept.push(label);
  }

  return kept.sort((a, b) => {
    if (a.kind === b.kind) return a.importance - b.importance;
    return a.kind === "attribute" ? 1 : -1;
  });
}
