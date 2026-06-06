"use client";

import {
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CINEMATIC_PROTOTYPE_CONTRACT,
  COSMIC_GAUNTLET_GALAXIES,
  COSMIC_PIPELINE_PATHS,
  COSMIC_WORLD,
  EXTERNAL_FIDELITY_RESEARCH,
  HUMAN_GATE,
  NASA_M83_GALAXY_CLOUD_ASSET,
  TIME_STONE_REFERENCE_ASSET,
  type CosmicGalaxy,
  type CosmicPoint,
} from "./data";

type SceneFocus = "overview" | "human-gate" | CosmicGalaxy["id"];

type CameraView = Readonly<{
  x: number;
  y: number;
  scale: number;
}>;

type DragState = Readonly<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}>;

type PrototypeStyle = CSSProperties & Record<`--${string}`, string | number>;

const TIME_GALAXY = COSMIC_GAUNTLET_GALAXIES.find(
  (galaxy) => galaxy.id === "time",
)!;

const OVERVIEW_VIEW: CameraView = Object.freeze({
  x: 0,
  y: 0,
  scale: COSMIC_WORLD.overviewScale,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cameraFor(point: CosmicPoint, scale: number): CameraView {
  return {
    x: -((point.x - COSMIC_WORLD.width / 2) * scale),
    y: -((point.y - COSMIC_WORLD.height / 2) * scale),
    scale,
  };
}

function buildPipelineCurve(from: CosmicPoint, to: CosmicPoint): string {
  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2;
  const pullX = to.x - from.x;
  const pullY = to.y - from.y;
  const bend = Math.sign(pullY || 1) * 210;

  return [
    `M ${from.x.toFixed(1)} ${from.y.toFixed(1)}`,
    `C ${(midpointX - pullY * 0.09).toFixed(1)} ${(midpointY + bend).toFixed(1)}`,
    `${(midpointX + pullX * 0.09).toFixed(1)} ${(midpointY - bend).toFixed(1)}`,
    `${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
  ].join(" ");
}

export function CosmicGauntletPrototype() {
  const dragRef = useRef<DragState | null>(null);
  const [camera, setCamera] = useState<CameraView>(() =>
    cameraFor(TIME_GALAXY.position, TIME_GALAXY.focusScale),
  );
  const [focus, setFocus] = useState<SceneFocus>("time");
  const [hovered, setHovered] = useState<SceneFocus>("time");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function resetView() {
    setFocus("time");
    setHovered("time");
    setCamera(cameraFor(TIME_GALAXY.position, TIME_GALAXY.focusScale));
  }

  function focusGalaxy(galaxy: CosmicGalaxy) {
    setFocus(galaxy.id);
    setHovered(galaxy.id);
    setCamera(cameraFor(galaxy.position, galaxy.focusScale));
  }

  function focusHumanGate() {
    setFocus("human-gate");
    setHovered("human-gate");
    setCamera(cameraFor(HUMAN_GATE.position, HUMAN_GATE.focusScale));
  }

  function focusOverview() {
    setFocus("overview");
    setHovered("overview");
    setCamera(OVERVIEW_VIEW);
  }

  function zoomBy(delta: number) {
    setFocus("overview");
    setCamera((current) => ({
      ...current,
      scale: clamp(
        current.scale + delta,
        COSMIC_WORLD.minScale,
        COSMIC_WORLD.maxScale,
      ),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-cg-interactive]")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: camera.x,
      startY: camera.y,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    setFocus("overview");
    setCamera((current) => ({
      ...current,
      x: drag.startX + event.clientX - drag.startClientX,
      y: drag.startY + event.clientY - drag.startClientY,
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.075 : 0.075);
  }

  const worldStyle: PrototypeStyle = {
    "--cg-pan-x": `${camera.x.toFixed(1)}px`,
    "--cg-pan-y": `${camera.y.toFixed(1)}px`,
    "--cg-scale": camera.scale.toFixed(3),
    "--cg-world-width": `${COSMIC_WORLD.width}px`,
    "--cg-world-height": `${COSMIC_WORLD.height}px`,
    "--cg-cloud-texture": `url("${NASA_M83_GALAXY_CLOUD_ASSET}")`,
    "--cg-reference-texture": `url("${TIME_STONE_REFERENCE_ASSET}")`,
  };

  return (
    <main
      aria-label="JARVIS Cosmic Gauntlet cinematic prototype"
      className="cg-root"
      data-cosmic-gauntlet-prototype="cinematic-scene"
      data-cinematic-priority={CINEMATIC_PROTOTYPE_CONTRACT.priority}
      data-scene-intent={CINEMATIC_PROTOTYPE_CONTRACT.sceneIntent}
      data-visual-reference={CINEMATIC_PROTOTYPE_CONTRACT.visualReference}
      data-navigation-model={CINEMATIC_PROTOTYPE_CONTRACT.navigationModel}
      data-isolated-prototype={CINEMATIC_PROTOTYPE_CONTRACT.isolated}
      data-read-only-prototype={CINEMATIC_PROTOTYPE_CONTRACT.readOnly}
      data-reduced-motion={reducedMotion ? "active" : "available"}
    >
      <a className="cg-skip-link" href="#cosmic-gauntlet-navigation">
        Skip to galaxy navigation
      </a>

      <section
        className="cg-viewport"
        aria-label="Zoomable cinematic universe of six galaxy-scale stone systems"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div aria-hidden="true" className="cg-star-parallax cg-star-a" />
        <div aria-hidden="true" className="cg-star-parallax cg-star-b" />
        <div
          className="cg-world"
          data-cg-cinematic-world="procedural-8k-capable-six-galaxy-universe"
          data-cg-starts-focused-galaxy="time"
          style={worldStyle}
        >
          <div aria-hidden="true" className="cg-world-clouds" />
          <PipelineField />
          <HumanGate
            active={focus === "human-gate" || hovered === "human-gate"}
            onFocus={focusHumanGate}
            onHover={setHovered}
          />
          {COSMIC_GAUNTLET_GALAXIES.map((galaxy) => (
            <GalaxyRealm
              key={galaxy.id}
              galaxy={galaxy}
              active={focus === galaxy.id || hovered === galaxy.id}
              onFocus={focusGalaxy}
              onHover={setHovered}
            />
          ))}
          <div aria-hidden="true" className="cg-world-vignette" />
        </div>
      </section>

      <div
        className="cg-camera-controls"
        data-cg-interactive="true"
        data-cg-pan-zoom-controls="true"
        aria-label="Camera controls"
      >
        <button type="button" onClick={() => zoomBy(0.12)} aria-label="Zoom in">
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-0.12)}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={focusOverview}
          aria-label="View full universe"
        >
          Universe
        </button>
        <button type="button" onClick={resetView} aria-label="Reset to Time">
          Time
        </button>
      </div>

      <nav
        id="cosmic-gauntlet-navigation"
        className="cg-focus-nav"
        data-cg-interactive="true"
        data-cg-focus-controls="true"
        aria-label="Galaxy focus controls"
      >
        <button
          type="button"
          data-cg-focus-target="overview"
          aria-pressed={focus === "overview"}
          onClick={focusOverview}
        >
          Universe
        </button>
        <button
          type="button"
          data-cg-focus-target="human-gate"
          aria-pressed={focus === "human-gate"}
          onClick={focusHumanGate}
        >
          Human Gate
        </button>
        {COSMIC_GAUNTLET_GALAXIES.map((galaxy) => (
          <button
            key={galaxy.id}
            type="button"
            data-cg-focus-target={galaxy.id}
            aria-pressed={focus === galaxy.id}
            onClick={() => focusGalaxy(galaxy)}
          >
            {galaxy.label}
          </button>
        ))}
      </nav>

      <aside className="cg-reference-audit" aria-label="Prototype asset audit">
        <span>Reference: Time Stone Galaxy</span>
        <span>Cloud source: NASA M83 6000x3903</span>
        <span>
          Tools checked:{" "}
          {EXTERNAL_FIDELITY_RESEARCH.map((tool) => tool.name).join(", ")}
        </span>
      </aside>

      <p className="cg-screen-reader-only" data-reduced-motion-fallback="true">
        Reduced motion freezes starfield parallax, packet flow, orbital nodes,
        galaxy breathing, and crystal pulse animation while preserving the full
        navigable cosmic universe.
      </p>
    </main>
  );
}

function PipelineField() {
  return (
    <svg
      className="cg-pipeline-field"
      viewBox={`0 0 ${COSMIC_WORLD.width} ${COSMIC_WORLD.height}`}
      role="img"
      aria-label="Space tesseract pipeline connecting each galaxy to the Human Gate"
      data-space-tesseract-pipeline="blue-glass-energy-streams"
      preserveAspectRatio="none"
    >
      <defs>
        <filter
          id="cg-pipeline-glow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur stdDeviation="11" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="cg-pipeline-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0644ff" stopOpacity="0.1" />
          <stop offset="35%" stopColor="#1db4ff" />
          <stop offset="60%" stopColor="#c9fbff" />
          <stop offset="100%" stopColor="#086cff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {COSMIC_PIPELINE_PATHS.map((path, pathIndex) => {
        const curve = buildPipelineCurve(path.from, path.to);

        return (
          <g key={path.id} data-cg-pipeline-lane={path.id}>
            <path className="cg-pipeline-halo" d={curve} />
            <path className="cg-pipeline-core" d={curve} />
            <path className="cg-pipeline-spark" d={curve} />
            {Array.from({ length: path.packets }).map((_, packetIndex) => (
              <circle
                key={`${path.id}-${packetIndex}`}
                className="cg-data-packet"
                r={packetIndex % 2 === 0 ? 13 : 8}
              >
                <animateMotion
                  dur={`${18 + pathIndex * 1.7}s`}
                  begin={`${packetIndex * -2.8}s`}
                  repeatCount="indefinite"
                  path={curve}
                />
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function HumanGate({
  active,
  onFocus,
  onHover,
}: Readonly<{
  active: boolean;
  onFocus: () => void;
  onHover: (focus: SceneFocus) => void;
}>) {
  const style: PrototypeStyle = {
    "--cg-x": `${HUMAN_GATE.position.x}px`,
    "--cg-y": `${HUMAN_GATE.position.y}px`,
    "--cg-size": `${HUMAN_GATE.radius}px`,
    "--cg-color": HUMAN_GATE.colorToken,
    "--cg-accent": HUMAN_GATE.accentToken,
  };

  return (
    <button
      type="button"
      className="cg-human-gate"
      style={style}
      data-cg-interactive="true"
      data-human-gate-core="golden-authority-crystal"
      data-active={active}
      aria-label={`${HUMAN_GATE.title}: ${HUMAN_GATE.subtitle}`}
      onClick={onFocus}
      onFocus={() => onHover("human-gate")}
      onBlur={() => onHover("overview")}
      onMouseEnter={() => onHover("human-gate")}
      onMouseLeave={() => onHover("overview")}
    >
      <span aria-hidden="true" className="cg-human-nebula" />
      <span aria-hidden="true" className="cg-human-authority-rings" />
      <span aria-hidden="true" className="cg-human-crystal" />
      <span className="cg-galaxy-hud cg-human-hud">
        <strong>{HUMAN_GATE.title}</strong>
        <span>{HUMAN_GATE.subtitle}</span>
        <em>{HUMAN_GATE.description}</em>
      </span>
    </button>
  );
}

function GalaxyRealm({
  galaxy,
  active,
  onFocus,
  onHover,
}: Readonly<{
  galaxy: CosmicGalaxy;
  active: boolean;
  onFocus: (galaxy: CosmicGalaxy) => void;
  onHover: (focus: SceneFocus) => void;
}>) {
  const style: PrototypeStyle = {
    "--cg-x": `${galaxy.position.x}px`,
    "--cg-y": `${galaxy.position.y}px`,
    "--cg-size": `${galaxy.radius * 2}px`,
    "--cg-color": galaxy.colorToken,
    "--cg-accent": galaxy.accentToken,
    "--cg-deep": galaxy.deepToken,
  };

  return (
    <button
      type="button"
      className={`cg-galaxy-realm cg-galaxy-${galaxy.id}`}
      style={style}
      data-cg-interactive="true"
      data-cg-territory={galaxy.id}
      data-cg-cloudy-galaxy="true"
      data-cg-molten-artifact-centre="true"
      data-stone-type={galaxy.stoneType}
      data-active={active}
      aria-label={`${galaxy.title}: ${galaxy.subtitle}`}
      onClick={() => onFocus(galaxy)}
      onFocus={() => onHover(galaxy.id)}
      onBlur={() => onHover("overview")}
      onMouseEnter={() => onHover(galaxy.id)}
      onMouseLeave={() => onHover("overview")}
    >
      <span aria-hidden="true" className="cg-cloud-field" />
      <span aria-hidden="true" className="cg-cloud-field cg-cloud-field-two" />
      <span aria-hidden="true" className="cg-orbit-rings" />
      <span
        aria-hidden="true"
        className={`cg-stone-core cg-stone-${galaxy.id}`}
      >
        <span />
      </span>
      <span aria-hidden="true" className="cg-orbit-system">
        {galaxy.orbitNodes.map((node, index) => {
          const nodeStyle: PrototypeStyle = {
            "--cg-node-angle": `${(360 / galaxy.orbitNodes.length) * index - 92}deg`,
            "--cg-node-delay": `${index * -1.1}s`,
          };
          return (
            <span
              key={node.label}
              className="cg-orbit-node"
              style={nodeStyle}
              data-node-label={node.label}
            >
              <span className="cg-node-glyph">{node.glyph}</span>
              <span className="cg-node-copy">
                <strong>{node.label}</strong>
                <em>{node.summary}</em>
              </span>
            </span>
          );
        })}
      </span>
      <span className="cg-galaxy-title">
        <strong>{galaxy.title}</strong>
        <span>{galaxy.subtitle}</span>
      </span>
      <span className="cg-core-label">
        {galaxy.label} Stone
        <em>Core</em>
      </span>
      <span className="cg-galaxy-hud">
        <strong>{galaxy.title}</strong>
        <span>{galaxy.description}</span>
        <em>Status: {galaxy.status}</em>
        <em>Flow: {galaxy.flow}</em>
      </span>
    </button>
  );
}
