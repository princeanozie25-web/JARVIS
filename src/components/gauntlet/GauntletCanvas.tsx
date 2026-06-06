"use client";

import { OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { random } from "maath";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Vector3,
  type Camera,
  type Group,
  type Mesh,
  type Points,
  type Texture,
} from "three";
import { useEffect, useMemo, useRef, useState, type ElementRef } from "react";

import { CosmicStarfield } from "./CosmicStarfield";
import { GauntletPostProcessing } from "./PostProcessing";
import { StoneMaterial } from "./zones/stone-material";

export type GauntletZoneId =
  | "space"
  | "time"
  | "mind"
  | "soul"
  | "reality"
  | "power";
export type GauntletFocusTarget = "overview" | "human_gate" | GauntletZoneId;
export type GauntletLodTier = "far" | "mid" | "near";

export interface GauntletScreenLabel {
  id: string;
  label: string;
  kind: "constellation" | "attribute" | "gate";
  zoneId?: GauntletZoneId;
  x: number;
  y: number;
  visible: boolean;
  lod: GauntletLodTier;
  importance: number;
}

export interface GauntletCanvasTelemetry {
  focusTarget: GauntletFocusTarget;
  lodByZone: Record<GauntletZoneId, GauntletLodTier>;
  distanceByZone: Record<GauntletZoneId, number>;
  screenLabels: GauntletScreenLabel[];
}

interface GauntletCanvasProps {
  focusTarget: GauntletFocusTarget;
  onTelemetry: (telemetry: GauntletCanvasTelemetry) => void;
  onUserNavigate: () => void;
}

interface WorldPoint {
  readonly position: readonly [number, number, number];
}

interface AttributeNode extends WorldPoint {
  readonly id: string;
  readonly label: string;
  readonly radius: number;
  readonly verticalRadius: number;
  readonly speed: number;
  readonly phase: number;
  readonly importance: number;
}

interface ConstellationDefinition extends WorldPoint {
  readonly id: GauntletZoneId;
  readonly label: string;
  readonly color: string;
  readonly secondaryColor: string;
  readonly core: string;
  readonly attributes: readonly AttributeNode[];
}

const LOD_FAR_DISTANCE = 400;
const LOD_NEAR_DISTANCE = 150;

const HUMAN_GATE = {
  label: "Human Gate",
  position: [0, 0, 0] as const,
  color: "#fbbf24",
};

export const GAUNTLET_WORLD_COORDINATES: Readonly<
  Record<GauntletFocusTarget, readonly [number, number, number]>
> = {
  overview: [0, 0, 0],
  human_gate: HUMAN_GATE.position,
  space: [-420, 40, -80],
  time: [-180, 360, -120],
  mind: [380, 320, -100],
  soul: [-260, -340, -90],
  reality: [440, -120, -110],
  power: [200, -400, -140],
};

export const GAUNTLET_LOD_THRESHOLDS = {
  far: LOD_FAR_DISTANCE,
  near: LOD_NEAR_DISTANCE,
} as const;

const CONSTELLATIONS: readonly ConstellationDefinition[] = [
  {
    id: "time",
    label: "Time",
    color: "#4ade80",
    secondaryColor: "#bbf7d0",
    core: "green fire crystal",
    position: GAUNTLET_WORLD_COORDINATES.time,
    attributes: makeOrbitNodes(
      "time",
      [
        "Agent Coordinator",
        "Life Coach",
        "Build Monitor",
        "Research",
        "CV Maintenance",
        "Job Scout",
        "Morning Brief",
        "Deadline Monitor",
        "Cost Monitor",
        "Suggestion Inbox",
      ],
      36,
    ),
  },
  {
    id: "mind",
    label: "Mind",
    color: "#c084fc",
    secondaryColor: "#f0abfc",
    core: "violet cognition crystal",
    position: GAUNTLET_WORLD_COORDINATES.mind,
    attributes: makeOrbitNodes(
      "mind",
      [
        "Council Orchestrator",
        "DeepSeek",
        "GPT",
        "Gemini",
        "Claude",
        "Members",
        "Assistant Reviewer",
        "Chairman",
        "Synthesis Output",
      ],
      38,
    ),
  },
  {
    id: "soul",
    label: "Soul",
    color: "#f59e0b",
    secondaryColor: "#fed7aa",
    core: "molten amber crystal",
    position: GAUNTLET_WORLD_COORDINATES.soul,
    attributes: makeOrbitNodes(
      "soul",
      [
        "Obsidian Vault",
        "Vector DB",
        "Knowledge Compounding",
        "Session Memory",
        "Project Intelligence",
        "LLM Wiki",
        "Librarian",
      ],
      42,
    ),
  },
  {
    id: "reality",
    label: "Reality",
    color: "#22d3ee",
    secondaryColor: "#a5f3fc",
    core: "cyan electrical crystal",
    position: GAUNTLET_WORLD_COORDINATES.reality,
    attributes: makeOrbitNodes(
      "reality",
      [
        "Room Registry",
        "Hue Bridge",
        "Theme Engine",
        "Nanoleaf",
        "RuView Sensors",
        "FancyLED",
        "Fan/Ceiling",
        "Sensors",
      ],
      40,
    ),
  },
  {
    id: "power",
    label: "Power",
    color: "#f43f5e",
    secondaryColor: "#c084fc",
    core: "sealed fortress reactor",
    position: GAUNTLET_WORLD_COORDINATES.power,
    attributes: makeOrbitNodes(
      "power",
      [
        "Architecture Graph",
        "Telemetry Cockpit",
        "Governance Visualizer",
        "CAI Sandbox",
        "Execution Gates",
        "Policy Enforcer",
      ],
      43,
    ),
  },
];

const SPACE_PIPELINE: readonly AttributeNode[] = [
  "Input Gateway",
  "Intent Classifier",
  "Safety Classifier",
  "Router",
  "Tier 0",
  "Tier 1",
  "Tier 2",
  "Tier 3",
  "Tier 4",
].map((label, index) => ({
  id: `space-${label.toLowerCase().replaceAll(" ", "-")}`,
  label,
  radius: 0,
  verticalRadius: 0,
  speed: 0,
  phase: 0,
  importance: index,
  position: [
    -86 + index * 19,
    Math.sin(index * 0.78) * 9,
    index < 4 ? -7 : 7,
  ] as const,
}));

export function GauntletCanvas({
  focusTarget,
  onTelemetry,
  onUserNavigate,
}: GauntletCanvasProps) {
  const reducedMotion = useReducedMotionPreference();

  return (
    <div
      aria-hidden="true"
      data-gauntlet-cosmic-canvas-layer="r3f-presentational"
      data-gauntlet-canvas-owns-metadata="false"
      data-gauntlet-canvas-owns-routing="false"
      data-gauntlet-canvas-owns-approval="false"
      className="jarvis-gauntlet-canvas-layer absolute"
    >
      <span className="pointer-events-none hidden" />
      <Canvas
        aria-hidden="true"
        data-gauntlet-canvas="react-three-fiber"
        className="h-full w-full"
        camera={{ position: [0, 0, 1080], fov: 48, near: 0.1, far: 3200 }}
        dpr={[1, 1.65]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 760, 2100]} />
        <ambientLight intensity={0.18} />
        <CosmicStarfield reducedMotion={reducedMotion} />
        <DeepNebula />
        <HumanGateMesh reducedMotion={reducedMotion} />
        <SpaceTesseract reducedMotion={reducedMotion} />
        {CONSTELLATIONS.map((constellation) => (
          <ConstellationMesh
            key={constellation.id}
            constellation={constellation}
            reducedMotion={reducedMotion}
          />
        ))}
        <RoutingNetwork reducedMotion={reducedMotion} />
        <CameraTelemetryBridge
          focusTarget={focusTarget}
          onTelemetry={onTelemetry}
        />
        <CameraController
          focusTarget={focusTarget}
          reducedMotion={reducedMotion}
          onUserNavigate={onUserNavigate}
        />
        <GauntletPostProcessing />
      </Canvas>
    </div>
  );
}

function ConstellationMesh({
  constellation,
  reducedMotion,
}: {
  constellation: ConstellationDefinition;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.08) * 0.035;
  });

  return (
    <group
      ref={groupRef}
      data-gauntlet-canvas-zone={constellation.id}
      position={constellation.position}
    >
      <pointLight color={constellation.color} intensity={8} distance={160} />
      <GalaxyDisk constellation={constellation} reducedMotion={reducedMotion} />
      <ContainedFireCrystal constellation={constellation} />
      <AttributeOrbiters
        constellation={constellation}
        reducedMotion={reducedMotion}
      />
      {constellation.id === "power" ? <CaiLockSeal /> : null}
    </group>
  );
}

function ContainedFireCrystal({
  constellation,
}: {
  constellation: ConstellationDefinition;
}) {
  return (
    <group data-gauntlet-crystal-core={constellation.core}>
      <mesh rotation={[0.4, 0.7, 0.12]}>
        <icosahedronGeometry args={[13, 4]} />
        <StoneMaterial
          color={constellation.color}
          opacity={0.78}
          emissiveIntensity={0.92}
        />
      </mesh>
      <mesh rotation={[0.2, -0.3, 0.6]} scale={0.72}>
        <octahedronGeometry args={[13, 2]} />
        <meshBasicMaterial
          transparent
          color={constellation.secondaryColor}
          opacity={0.48}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh scale={1.35}>
        <sphereGeometry args={[13.5, 32, 18]} />
        <meshBasicMaterial
          transparent
          color={constellation.color}
          opacity={0.08}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function GalaxyDisk({
  constellation,
  reducedMotion,
}: {
  constellation: ConstellationDefinition;
  reducedMotion: boolean;
}) {
  const pointsRef = useRef<Points>(null);
  const { geometry, colors } = useMemo(
    () => makeGalaxyGeometry(constellation.id, constellation.color),
    [constellation.color, constellation.id],
  );

  useFrame(({ clock }) => {
    if (reducedMotion || !pointsRef.current) return;
    pointsRef.current.rotation.z = clock.elapsedTime * 0.028;
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      data-gauntlet-galaxy-disk="milky-spiral-particles"
      rotation={[0.15, -0.1, 0]}
    >
      <pointsMaterial
        vertexColors={colors}
        transparent
        opacity={0.72}
        size={1.15}
        sizeAttenuation
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function AttributeOrbiters({
  constellation,
  reducedMotion,
}: {
  constellation: ConstellationDefinition;
  reducedMotion: boolean;
}) {
  const texture = useTexture(
    "/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi/PNG/Extra/Default/button_square.png",
  );

  return (
    <group data-gauntlet-orbiting-attributes={constellation.id}>
      {constellation.attributes.map((node, index) => (
        <OrbitingNode
          key={node.id}
          node={node}
          index={index}
          color={constellation.secondaryColor}
          reducedMotion={reducedMotion}
          texture={texture}
        />
      ))}
    </group>
  );
}

function OrbitingNode({
  node,
  index,
  color,
  reducedMotion,
  texture,
}: {
  node: AttributeNode;
  index: number;
  color: string;
  reducedMotion: boolean;
  texture: Texture;
}) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = reducedMotion
      ? node.phase
      : clock.elapsedTime * node.speed + node.phase;
    groupRef.current.position.set(
      Math.cos(t) * node.radius,
      Math.sin(t) * node.verticalRadius,
      Math.sin(t * 0.72 + index) * 7,
    );
  });

  return (
    <group ref={groupRef} data-gauntlet-attribute-node={node.id}>
      <mesh>
        <sphereGeometry args={[2.4, 18, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh scale={7.5} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          map={texture}
          color={color}
          opacity={0.62}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function SpaceTesseract({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<Group>(null);
  const innerRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    if (groupRef.current) {
      groupRef.current.rotation.set(
        clock.elapsedTime * 0.07,
        clock.elapsedTime * 0.12,
        clock.elapsedTime * 0.04,
      );
    }
    if (innerRef.current) {
      innerRef.current.rotation.set(
        -clock.elapsedTime * 0.18,
        clock.elapsedTime * 0.1,
        clock.elapsedTime * 0.14,
      );
    }
  });

  return (
    <group
      data-gauntlet-canvas-zone="space"
      position={GAUNTLET_WORLD_COORDINATES.space}
    >
      <pointLight color="#38bdf8" intensity={10} distance={200} />
      <group ref={groupRef} data-gauntlet-space-tesseract="nested-cube">
        <mesh>
          <boxGeometry args={[30, 30, 30, 2, 2, 2]} />
          <StoneMaterial
            color="#38bdf8"
            opacity={0.52}
            emissiveIntensity={1.1}
          />
        </mesh>
        <mesh ref={innerRef} scale={0.62}>
          <boxGeometry args={[30, 30, 30, 1, 1, 1]} />
          <meshBasicMaterial
            wireframe
            transparent
            color="#bae6fd"
            opacity={0.72}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh scale={1.55}>
          <boxGeometry args={[30, 30, 30, 1, 1, 1]} />
          <meshBasicMaterial
            wireframe
            transparent
            color="#7dd3fc"
            opacity={0.28}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
      <SpacePipelineNodes reducedMotion={reducedMotion} />
    </group>
  );
}

function SpacePipelineNodes({ reducedMotion }: { reducedMotion: boolean }) {
  const texture = useTexture(
    "/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi/PNG/Extra/Default/crosshair_a.png",
  );

  return (
    <group data-gauntlet-space-pipeline-spine="routing">
      {SPACE_PIPELINE.map((node, index) => (
        <group key={node.id} position={node.position}>
          <mesh>
            <sphereGeometry args={[2.2, 16, 10]} />
            <meshBasicMaterial color="#bae6fd" transparent opacity={0.82} />
          </mesh>
          <mesh scale={6} rotation={[0, 0, reducedMotion ? 0 : index * 0.2]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              transparent
              map={texture}
              color="#38bdf8"
              opacity={0.58}
              side={DoubleSide}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function HumanGateMesh({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.4) * 0.025;
    groupRef.current.scale.setScalar(pulse);
    groupRef.current.rotation.z = clock.elapsedTime * 0.05;
  });

  return (
    <group
      ref={groupRef}
      data-gauntlet-canvas-zone="human_gate"
      position={HUMAN_GATE.position}
    >
      <pointLight color={HUMAN_GATE.color} intensity={23} distance={440} />
      <mesh rotation={[0.28, 0.36, 0.12]}>
        <icosahedronGeometry args={[24, 4]} />
        <StoneMaterial
          color={HUMAN_GATE.color}
          opacity={0.92}
          emissiveIntensity={1.8}
        />
      </mesh>
      {[38, 58, 82].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2, index * 0.18, index * 0.36]}>
          <torusGeometry args={[radius, 0.4, 12, 160]} />
          <meshBasicMaterial
            transparent
            color="#fde68a"
            opacity={0.26 - index * 0.045}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
      <mesh scale={2.7}>
        <sphereGeometry args={[24, 42, 24]} />
        <meshBasicMaterial
          transparent
          color="#facc15"
          opacity={0.09}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function RoutingNetwork({ reducedMotion }: { reducedMotion: boolean }) {
  const lines = useMemo(() => {
    const space = new Vector3(...GAUNTLET_WORLD_COORDINATES.space);
    const gate = new Vector3(...HUMAN_GATE.position);
    return [
      {
        id: "space-gate",
        from: space,
        to: gate,
        color: "#38bdf8",
        index: 0,
      },
      ...CONSTELLATIONS.map((constellation, index) => ({
        id: `${constellation.id}-space-gate`,
        from: new Vector3(...constellation.position),
        to: gate,
        via: space,
        color: constellation.color,
        index: index + 1,
      })),
    ];
  }, []);

  return (
    <group data-gauntlet-cross-space-routing="space-tesseract-human-gate">
      {lines.map((line) => (
        <EnergyRoute
          key={line.id}
          from={line.from}
          via={"via" in line ? line.via : undefined}
          to={line.to}
          color={line.color}
          index={line.index}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

function EnergyRoute({
  from,
  via,
  to,
  color,
  index,
  reducedMotion,
}: {
  from: Vector3;
  via?: Vector3;
  to: Vector3;
  color: string;
  index: number;
  reducedMotion: boolean;
}) {
  const pulseRef = useRef<Mesh>(null);
  const curve = useMemo(() => {
    const midA = from.clone().lerp(via ?? to, 0.46);
    midA.z += 36 + index * 2;
    midA.y += index % 2 === 0 ? 28 : -22;
    if (!via) return new CatmullRomCurve3([from, midA, to]);
    const midB = via.clone().lerp(to, 0.48);
    midB.z += 42;
    return new CatmullRomCurve3([from, midA, via, midB, to]);
  }, [from, index, to, via]);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const progress = reducedMotion
      ? 0.86
      : (clock.elapsedTime * 0.035 + index * 0.11) % 0.92;
    pulseRef.current.position.copy(curve.getPointAt(progress));
  });

  return (
    <group data-gauntlet-connection-pulse="tube-geometry">
      <mesh>
        <tubeGeometry args={[curve, 160, 0.5, 8, false]} />
        <meshBasicMaterial
          transparent
          color={color}
          opacity={0.16}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[4.6, 24, 14]} />
        <meshBasicMaterial
          transparent
          color={color}
          opacity={0.86}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function CaiLockSeal() {
  return (
    <group data-gauntlet-cai-lock="sealed">
      <mesh position={[0, -58, 4]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[18, 18, 2]} />
        <meshBasicMaterial
          transparent
          color="#f43f5e"
          opacity={0.38}
          wireframe
        />
      </mesh>
      <mesh position={[0, -58, 5]}>
        <torusGeometry args={[15, 0.8, 10, 80]} />
        <meshBasicMaterial
          transparent
          color="#c084fc"
          opacity={0.56}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function DeepNebula() {
  const texture = useTexture(
    "/assets/cosmic-gauntlet/nasa-webb-carina-cosmic-cliffs.webp",
  );

  return (
    <mesh position={[120, -80, -980]} scale={[1800, 1020, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

function CameraController({
  focusTarget,
  reducedMotion,
  onUserNavigate,
}: {
  focusTarget: GauntletFocusTarget;
  reducedMotion: boolean;
  onUserNavigate: () => void;
}) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const desired = useMemo(
    () => getCameraDestination(focusTarget),
    [focusTarget],
  );

  useFrame(({ clock }, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const ease = 1 - Math.pow(0.015, Math.min(delta * 1.35, 1));
    camera.position.lerp(desired.position, ease);
    controls.target.lerp(desired.target, ease);

    if (!reducedMotion && focusTarget === "overview") {
      const drift = Math.sin(clock.elapsedTime * 0.08) * 18;
      controls.target.x = drift;
      controls.target.y = Math.cos(clock.elapsedTime * 0.06) * 12;
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      autoRotate={!reducedMotion && focusTarget === "overview"}
      autoRotateSpeed={0.08}
      minDistance={30}
      maxDistance={1400}
      zoomSpeed={1.2}
      panSpeed={1}
      rotateSpeed={0.36}
      target={[0, 0, 0]}
      onStart={onUserNavigate}
    />
  );
}

function CameraTelemetryBridge({
  focusTarget,
  onTelemetry,
}: {
  focusTarget: GauntletFocusTarget;
  onTelemetry: (telemetry: GauntletCanvasTelemetry) => void;
}) {
  const { camera, size } = useThree();
  const tickRef = useRef(0);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - tickRef.current < 0.12) return;
    tickRef.current = clock.elapsedTime;

    const distanceByZone = Object.fromEntries(
      CONSTELLATIONS.map((constellation) => [
        constellation.id,
        camera.position.distanceTo(new Vector3(...constellation.position)),
      ]),
    ) as Record<GauntletZoneId, number>;
    const spaceDistance = camera.position.distanceTo(
      new Vector3(...GAUNTLET_WORLD_COORDINATES.space),
    );
    distanceByZone.space = spaceDistance;

    const lodByZone = Object.fromEntries(
      (Object.keys(distanceByZone) as GauntletZoneId[]).map((id) => [
        id,
        getLodTier(distanceByZone[id]),
      ]),
    ) as Record<GauntletZoneId, GauntletLodTier>;

    onTelemetry({
      focusTarget,
      lodByZone,
      distanceByZone,
      screenLabels: collectScreenLabels(
        camera,
        size.width,
        size.height,
        lodByZone,
      ),
    });
  });

  return null;
}

function collectScreenLabels(
  camera: Camera,
  width: number,
  height: number,
  lodByZone: Record<GauntletZoneId, GauntletLodTier>,
): GauntletScreenLabel[] {
  const labels: GauntletScreenLabel[] = [
    makeScreenLabel({
      id: "human-gate",
      label: HUMAN_GATE.label,
      kind: "gate",
      position: [0, 34, 0],
      camera,
      width,
      height,
      lod: "near",
      importance: -1,
    }),
    makeScreenLabel({
      id: "space",
      label: "Space",
      kind: "constellation",
      zoneId: "space",
      position: addPoint(GAUNTLET_WORLD_COORDINATES.space, [0, 42, 0]),
      camera,
      width,
      height,
      lod: lodByZone.space,
      importance: 0,
    }),
  ];

  for (const constellation of CONSTELLATIONS) {
    labels.push(
      makeScreenLabel({
        id: constellation.id,
        label: constellation.label,
        kind: "constellation",
        zoneId: constellation.id,
        position: addPoint(constellation.position, [0, 44, 0]),
        camera,
        width,
        height,
        lod: lodByZone[constellation.id],
        importance: 0,
      }),
    );

    if (lodByZone[constellation.id] === "near") {
      constellation.attributes.forEach((node, index) => {
        const angle = node.phase;
        labels.push(
          makeScreenLabel({
            id: node.id,
            label: node.label,
            kind: "attribute",
            zoneId: constellation.id,
            position: addPoint(constellation.position, [
              Math.cos(angle) * node.radius,
              Math.sin(angle) * node.verticalRadius,
              10 + Math.sin(angle * 0.7 + index) * 7,
            ]),
            camera,
            width,
            height,
            lod: "near",
            importance: node.importance,
          }),
        );
      });
    }
  }

  if (lodByZone.space === "near") {
    SPACE_PIPELINE.forEach((node) => {
      labels.push(
        makeScreenLabel({
          id: node.id,
          label: node.label,
          kind: "attribute",
          zoneId: "space",
          position: addPoint(GAUNTLET_WORLD_COORDINATES.space, node.position),
          camera,
          width,
          height,
          lod: "near",
          importance: node.importance,
        }),
      );
    });
  }

  return labels;
}

function makeScreenLabel({
  id,
  label,
  kind,
  zoneId,
  position,
  camera,
  width,
  height,
  lod,
  importance,
}: {
  id: string;
  label: string;
  kind: GauntletScreenLabel["kind"];
  zoneId?: GauntletZoneId;
  position: readonly [number, number, number];
  camera: Camera;
  width: number;
  height: number;
  lod: GauntletLodTier;
  importance: number;
}): GauntletScreenLabel {
  const projected = new Vector3(...position).project(camera);
  const x = (projected.x * 0.5 + 0.5) * width;
  const y = (-projected.y * 0.5 + 0.5) * height;
  const topInset = width <= 600 ? 120 : -80;
  const bottomInset = width <= 600 ? 230 : 70;
  return {
    id,
    label,
    kind,
    zoneId,
    x,
    y,
    lod,
    importance,
    visible:
      projected.z < 1 &&
      projected.z > -1 &&
      x > -80 &&
      x < width + 80 &&
      y > topInset &&
      y < height - bottomInset,
  };
}

function makeGalaxyGeometry(seed: string, color: string) {
  const count = 2400;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeded = new random.Generator(seed);
  const baseColor = new Color(color);
  const white = new Color("#ffffff");
  const jitter = new Float32Array(3);

  for (let i = 0; i < count; i += 1) {
    random.inSphere(jitter, { radius: 1 }, seeded);
    const arm = i % 5;
    const radius = 8 + Math.pow(seeded.value(), 0.56) * 62;
    const theta = arm * ((Math.PI * 2) / 5) + radius * 0.085 + jitter[0] * 0.42;
    const flatness = 0.36 + seeded.value() * 0.34;
    positions[i * 3] = Math.cos(theta) * radius + jitter[0] * 6;
    positions[i * 3 + 1] = Math.sin(theta) * radius * flatness + jitter[1] * 4;
    positions[i * 3 + 2] = jitter[2] * 7;

    const particleColor = baseColor.clone().lerp(white, seeded.value() * 0.45);
    colors[i * 3] = particleColor.r;
    colors[i * 3 + 1] = particleColor.g;
    colors[i * 3 + 2] = particleColor.b;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return { geometry, colors: true };
}

function makeOrbitNodes(
  zoneId: GauntletZoneId,
  labels: readonly string[],
  baseRadius: number,
): readonly AttributeNode[] {
  return labels.map((label, index) => {
    const radius = baseRadius + (index % 4) * 7 + Math.floor(index / 4) * 3;
    return {
      id: `${zoneId}-${label.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}`,
      label,
      radius,
      verticalRadius: radius * (0.42 + (index % 3) * 0.08),
      speed: 0.06 + (index % 5) * 0.012,
      phase: (index / labels.length) * Math.PI * 2,
      importance: index,
      position: [0, 0, 0] as const,
    };
  });
}

function getCameraDestination(focusTarget: GauntletFocusTarget) {
  if (focusTarget === "overview") {
    return {
      position: new Vector3(0, 0, 1080),
      target: new Vector3(0, 0, 0),
    };
  }

  const target = new Vector3(...GAUNTLET_WORLD_COORDINATES[focusTarget]);
  const offset =
    focusTarget === "human_gate"
      ? new Vector3(0, 0, 95)
      : new Vector3(0, 0, 118);
  return {
    position: target.clone().add(offset),
    target,
  };
}

function getLodTier(distance: number): GauntletLodTier {
  if (distance <= LOD_NEAR_DISTANCE) return "near";
  if (distance <= LOD_FAR_DISTANCE) return "mid";
  return "far";
}

function addPoint(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}
