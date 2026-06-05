"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

type FocusTarget =
  | "overview"
  | "space"
  | "time"
  | "mind"
  | "soul"
  | "reality"
  | "power"
  | "human_gate";

interface CameraState {
  focus: FocusTarget;
  scale: number;
  x: number;
  y: number;
}

export interface GauntletCosmicViewportProps {
  children: ReactNode;
}

const FOCUS_TARGETS: readonly {
  id: FocusTarget;
  label: string;
  state: CameraState;
}[] = [
  {
    id: "overview",
    label: "Overview",
    state: { focus: "overview", scale: 1, x: 0, y: 0 },
  },
  {
    id: "human_gate",
    label: "Human Gate",
    state: { focus: "human_gate", scale: 1.2, x: -56, y: -10 },
  },
  {
    id: "space",
    label: "Space",
    state: { focus: "space", scale: 1.32, x: 150, y: -8 },
  },
  {
    id: "time",
    label: "Time",
    state: { focus: "time", scale: 1.3, x: 120, y: 105 },
  },
  {
    id: "mind",
    label: "Mind",
    state: { focus: "mind", scale: 1.3, x: -150, y: 100 },
  },
  {
    id: "soul",
    label: "Soul",
    state: { focus: "soul", scale: 1.28, x: 110, y: -120 },
  },
  {
    id: "reality",
    label: "Reality",
    state: { focus: "reality", scale: 1.25, x: -170, y: -115 },
  },
  {
    id: "power",
    label: "Power",
    state: { focus: "power", scale: 1.3, x: -42, y: -135 },
  },
];

export function GauntletCosmicViewport({
  children,
}: GauntletCosmicViewportProps) {
  const [camera, setCamera] = useState<CameraState>(FOCUS_TARGETS[0].state);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );

  const setFocus = (target: FocusTarget) => {
    const match = FOCUS_TARGETS.find((item) => item.id === target);
    if (match) setCamera(match.state);
  };

  const zoomBy = (delta: number) => {
    setCamera((current) => ({
      ...current,
      focus: "overview",
      scale: clamp(current.scale + delta, 0.82, 1.56),
    }));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setCamera((current) => ({
      ...current,
      focus: "overview",
      x: clamp(current.x + dx, -260, 260),
      y: clamp(current.y + dy, -180, 180),
    }));
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const style = {
    "--gauntlet-camera-x": `${camera.x}px`,
    "--gauntlet-camera-y": `${camera.y}px`,
    "--gauntlet-camera-scale": String(camera.scale),
  } as CSSProperties;

  return (
    <section
      aria-label="Living System Map viewport"
      data-gauntlet-pan-zoom="interactive"
      data-gauntlet-focus-affordance="stone-territory"
      data-gauntlet-focused-territory={camera.focus}
      className="jarvis-gauntlet-cosmic-viewport"
    >
      <div
        aria-label="Living System Map navigation"
        data-gauntlet-navigation-affordance="pan-zoom-focus"
        data-gauntlet-navigation-authority="presentational-only"
        className="jarvis-gauntlet-camera-controls"
      >
        <button
          type="button"
          data-gauntlet-camera-control="zoom-out"
          onClick={() => zoomBy(-0.12)}
        >
          Zoom -
        </button>
        <button
          type="button"
          data-gauntlet-camera-control="reset"
          onClick={() => setFocus("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          data-gauntlet-camera-control="zoom-in"
          onClick={() => zoomBy(0.12)}
        >
          Zoom +
        </button>
        <div data-gauntlet-focus-controls="stone-territories">
          {FOCUS_TARGETS.slice(1).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              data-gauntlet-focus-target={id}
              aria-pressed={camera.focus === id}
              onClick={() => setFocus(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label="Drag to pan the Living System Map. Use the focus controls to zoom into a stone territory."
        data-gauntlet-drag-surface="pointer-drag"
        data-gauntlet-execution-authority="none"
        className="jarvis-gauntlet-drag-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={style}
      >
        <div className="jarvis-gauntlet-camera-plane">
          <CosmicTerritoryArtifactLayer />
          {children}
        </div>
      </div>
    </section>
  );
}

function CosmicTerritoryArtifactLayer() {
  return (
    <div
      aria-hidden="true"
      data-gauntlet-territory-artifact-layer="cosmic-fields"
      className="jarvis-gauntlet-territory-artifact-layer pointer-events-none"
    >
      {["space", "time", "mind", "soul", "reality", "power", "human_gate"].map(
        (territory) => (
          <span
            key={territory}
            data-gauntlet-territory-artifact={territory}
            className="jarvis-gauntlet-territory-artifact"
          />
        ),
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
