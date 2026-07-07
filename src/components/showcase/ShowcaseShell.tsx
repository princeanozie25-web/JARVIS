"use client";

// SHOWCASE SHELL — the reference frame, replicated exactly: the multi-color
// plexus burst behind a fixed overlay of terminal-style region boxes, six
// AGENT-J cards with progress bars, the LIVE counter chip, and the boot line.
// The copy below is VERBATIM from the reference image — it is the spec.
//
// Display-only (I-SHOW-1): no buttons, no approve/deny, no mutation path.
// The page still builds the real projection-backed scene (the data layer is
// unchanged); the shell renders the reference layout and carries the scene's
// provenance on data attributes. Reduced motion selects the calm engine
// variant; without WebGL the overlay stands alone on black (never blank).

import { useSyncExternalStore } from "react";

import type { SceneDescription } from "@/lib/showcase/scene";

import { CinematicEngine } from "./CinematicEngine";
import "./showcase.css";

export interface ShowcaseShellProps {
  readonly scene: SceneDescription;
}

// --- the reference copy, verbatim -------------------------------------------

const REGIONS: ReadonlyArray<{
  id: string;
  title: string;
  tagline: string;
  /** viewport position (percent) */
  left: number;
  top: number;
  prominent?: boolean;
}> = [
  {
    id: "core",
    title: "JARVIS CORE",
    tagline: "Active · Adaptive · Predictive",
    left: 44,
    top: 27,
    prominent: true,
  },
  {
    id: "humanGate",
    title: "HUMAN GATE",
    tagline: "Auth: Authorized · Trust 0.98",
    left: 66,
    top: 17,
  },
  {
    id: "memory",
    title: "MEMORY LAYER",
    tagline: "Cache · Index · Recall",
    left: 26,
    top: 32,
  },
  {
    id: "voice",
    title: "VOICE RUNTIME",
    tagline: "Listening · STT · TTS",
    left: 64,
    top: 33,
  },
  {
    id: "council",
    title: "COUNCIL",
    tagline: "Consensus Engine · Voting",
    left: 26,
    top: 69,
  },
  {
    id: "roomOs",
    title: "ROOM OS",
    tagline: "Devices · IoT · Control",
    left: 42,
    top: 70,
  },
  {
    id: "knowledge",
    title: "KNOWLEDGE COMPOUNDING",
    tagline: "Synthesize · Expand · Evolve",
    left: 63,
    top: 74,
  },
  {
    id: "pipeline",
    title: "PIPELINE",
    tagline: "Automate · Orchestrate · Deliver",
    left: 53,
    top: 81,
  },
];

const AGENTS: ReadonlyArray<{
  id: string;
  title: string;
  progress: number;
}> = [
  { id: "AGENT-J01", title: "Morning Brief", progress: 82 },
  { id: "AGENT-J02", title: "Job Scout", progress: 68 },
  { id: "AGENT-J03", title: "Google Stack Sync", progress: 74 },
  { id: "AGENT-J04", title: "Knowledge Compounding", progress: 55 },
  { id: "AGENT-J05", title: "Bursar Cost Guard", progress: 71 },
  { id: "AGENT-J06", title: "Enterprise Brain Pilot", progress: 64 },
];

// LIVE counter: the agents plus the core itself — derived from what renders.
const LIVE_COUNT = AGENTS.length + 1;
const pad2 = (n: number) => String(n).padStart(2, "0");

// --- shell -------------------------------------------------------------------

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
      aria-label="JARVIS live system map"
      data-showcase-scene={scene.id}
      data-showcase-motion={calm ? "calm" : "full"}
      data-showcase-renderer={engineEnabled ? "webgl" : "dom-fallback"}
      data-showcase-provenance={scene.provenance.live ? "live" : "sample"}
    >
      {engineEnabled && <CinematicEngine calm={calm} />}

      <div className="showcase-overlay">
        <div className="showcase-live" data-showcase-live>
          <span className="showcase-live-dot" aria-hidden="true" />
          <span className="showcase-live-word">LIVE</span>
          <span className="showcase-live-count">
            {pad2(LIVE_COUNT)} / {pad2(LIVE_COUNT)}
          </span>
        </div>

        {REGIONS.map((region) => (
          <div
            key={region.id}
            className={`showcase-region showcase-region-${region.id}${region.prominent ? " showcase-region-prominent" : ""}`}
            style={{ left: `${region.left}%`, top: `${region.top}%` }}
            data-showcase-region={region.id}
          >
            <span className="showcase-region-title">{region.title}</span>
            <span className="showcase-region-tagline">{region.tagline}</span>
          </div>
        ))}

        <div className="showcase-agents" data-showcase-agents>
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="showcase-agent"
              data-showcase-agent={agent.id}
            >
              <span className="showcase-agent-id">{agent.id}</span>
              <span className="showcase-agent-title">{agent.title}</span>
              <span className="showcase-agent-bar" aria-hidden="true">
                <span
                  className="showcase-agent-bar-fill"
                  style={{ width: `${agent.progress}%` }}
                />
              </span>
              <span className="showcase-agent-state">Running...</span>
            </div>
          ))}
        </div>

        <div className="showcase-terminal" data-showcase-terminal>
          <span>&gt; JARVIS online.</span>
          <span>Listening, learning, and building the impossible.</span>
        </div>
      </div>
    </main>
  );
}
