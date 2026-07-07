"use client";

// SHOWCASE SHELL — the presentation frame around the cinematic engine.
//
// Display-only (I-SHOW-1): no buttons, no approve/deny, no mutation path —
// the ONLY interactive surface is pointer parallax inside the engine. The
// shell owns the honest layers around the spectacle:
//   * the HONEST-DATA BADGE (I-SHOW-2): says plainly whether the field is
//     live governed state or a labelled sample, per source;
//   * the mono telemetry chips (real cost/gate/voice values);
//   * graceful degradation (I-SHOW-6): SSR / WebGL-less / first paint render
//     a static DOM constellation from the SAME layout math, so the scene is
//     never blank and never blocks; prefers-reduced-motion selects the calm
//     engine variant (still rendered, nothing travels).

import { useSyncExternalStore } from "react";

import {
  layoutScene,
  positionIndex,
  type SceneDescription,
} from "@/lib/showcase/scene";

import { CinematicEngine } from "./CinematicEngine";
import "./showcase.css";

export interface ShowcaseShellProps {
  readonly scene: SceneDescription;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useCalmPreferred(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/** WebGL + mount gate, following the orb atmosphere's pattern: the canvas
 * layer only takes over client-side when a context is actually available.
 * The probe runs once and is cached; the server snapshot is false, so first
 * paint is the DOM constellation and the engine takes over after hydration. */
let webglProbeResult: boolean | null = null;

function probeWebgl(): boolean {
  if (webglProbeResult === null) {
    try {
      const probe = document.createElement("canvas");
      webglProbeResult =
        (probe.getContext("webgl2") ?? probe.getContext("webgl")) !== null;
    } catch {
      webglProbeResult = false;
    }
  }
  return webglProbeResult;
}

const subscribeNever = () => () => {};

function useEngineEnabled(): boolean {
  return useSyncExternalStore(subscribeNever, probeWebgl, () => false);
}

export function ShowcaseShell({ scene }: ShowcaseShellProps) {
  const calm = useCalmPreferred();
  const engineEnabled = useEngineEnabled();

  return (
    <main
      className="showcase-stage"
      aria-label={scene.title}
      data-showcase-scene={scene.id}
      data-showcase-motion={calm ? "calm" : "full"}
      data-showcase-renderer={engineEnabled ? "webgl" : "dom-fallback"}
      data-showcase-provenance={scene.provenance.live ? "live" : "sample"}
    >
      {engineEnabled ? (
        <CinematicEngine scene={scene} calm={calm} />
      ) : (
        <FallbackConstellation scene={scene} />
      )}

      <header className="showcase-masthead">
        <h1 className="showcase-title">{scene.title}</h1>
        <p className="showcase-subtitle">{scene.subtitle}</p>
      </header>

      <aside className="showcase-badge" data-showcase-badge>
        <span
          className="showcase-badge-state"
          data-live={scene.provenance.live}
        >
          {scene.provenance.label}
        </span>
        <ul className="showcase-badge-sources">
          {scene.provenance.sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </aside>

      <footer className="showcase-chips" aria-label="Telemetry">
        {scene.chips.map((chip) => (
          <span className="showcase-chip" key={`${chip.label}-${chip.value}`}>
            <span className="showcase-chip-label">{chip.label}</span>
            <span className="showcase-chip-value">{chip.value}</span>
          </span>
        ))}
      </footer>
    </main>
  );
}

/** The no-WebGL / first-paint constellation: same scene, same layout math,
 * rendered as positioned DOM. Still, dark, depth-lit by CSS — honest and
 * never blank. */
function FallbackConstellation({ scene }: { scene: SceneDescription }) {
  const positions = layoutScene(scene);
  const index = positionIndex(positions);
  // Project layout space (x ~ [-9,9], y ~ [-6,6]) onto viewport percentages.
  const toLeft = (x: number) => 50 + x * 4.6;
  const toTop = (y: number) => 46 - y * 6.2;

  return (
    <div
      className="showcase-fallback"
      data-showcase-fallback
      aria-hidden="true"
    >
      {scene.nodes.map((node) => {
        const at = index.get(node.id);
        if (!at) return null;
        const isCenter = node.id === scene.centerNodeId;
        return (
          <div
            key={node.id}
            className={`showcase-fallback-node showcase-tone-${node.tone}${isCenter ? " showcase-fallback-center" : ""}`}
            data-showcase-node={node.id}
            data-showcase-state={node.state}
            style={{
              left: `${toLeft(at.x)}%`,
              top: `${toTop(at.y)}%`,
            }}
          >
            <span className="showcase-fallback-dot" />
            <span className="showcase-label">
              <span className="showcase-label-title">{node.label}</span>
              {node.sublabel !== undefined && (
                <span className="showcase-label-sub">{node.sublabel}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
