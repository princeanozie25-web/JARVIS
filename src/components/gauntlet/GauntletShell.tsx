"use client";

import { useState } from "react";

import {
  GauntletCanvas,
  type GauntletCanvasTelemetry,
  type GauntletFocusTarget,
} from "./GauntletCanvas";
import { GauntletOverlay } from "./GauntletOverlay";

const EMPTY_TELEMETRY: GauntletCanvasTelemetry = {
  focusTarget: "overview",
  lodByZone: {
    space: "far",
    time: "far",
    mind: "far",
    soul: "far",
    reality: "far",
    power: "far",
  },
  distanceByZone: {
    space: 0,
    time: 0,
    mind: 0,
    soul: 0,
    reality: 0,
    power: 0,
  },
  screenLabels: [],
};

export function GauntletShell() {
  const [focusTarget, setFocusTarget] =
    useState<GauntletFocusTarget>("overview");
  const [telemetry, setTelemetry] =
    useState<GauntletCanvasTelemetry>(EMPTY_TELEMETRY);

  return (
    <main
      aria-label="JARVIS Cosmic System Map"
      data-audit-surface="gauntlet"
      data-gauntlet-surface-style="navigable-cosmic-constellation-map"
      data-gauntlet-cinematic-shell="true"
      data-gauntlet-two-layer-architecture="canvas-plus-react-overlay"
      className="jarvis-gauntlet-cinematic relative min-h-screen overflow-hidden text-ink"
    >
      <a className="jarvis-skip-link" href="#gauntlet-pipeline">
        Skip to cosmic system map
      </a>
      <div
        aria-hidden="true"
        data-gauntlet-galaxy-backdrop="starfield"
        className="jarvis-gauntlet-galaxy-backdrop pointer-events-none fixed inset-0"
      />
      <div
        aria-hidden="true"
        data-gauntlet-nebula-backdrop="cosmic-depth"
        className="jarvis-gauntlet-nebula pointer-events-none fixed inset-0"
      />
      <div
        aria-hidden="true"
        data-gauntlet-asset-backdrop="nasa-webb-carina-cosmic-cliffs"
        className="jarvis-gauntlet-cosmic-asset-backdrop pointer-events-none fixed inset-0"
      />
      <GauntletCanvas
        focusTarget={focusTarget}
        onTelemetry={setTelemetry}
        onUserNavigate={() => setFocusTarget("overview")}
      />
      <GauntletOverlay
        focusTarget={focusTarget}
        telemetry={telemetry}
        onFocus={setFocusTarget}
      />
    </main>
  );
}
