"use client";

// THE CINEMATIC ENGINE — scene-agnostic showreel renderer (I-SHOW-4).
//
// Takes ANY SceneDescription and renders it as a living, depth-lit organism:
// the center node as a pulsing heart wrapped in radiant streaks, every core a
// crisp faceted solid growing a synaptic dendrite burst, edges as energy
// threads with comet-trains firing along them, all over a deep dust field
// with selective bloom. It knows NOTHING about scenes' meaning — Scene 1
// (the operating map) and Scene 2 (the WorkflowBox mind-map) are just inputs.
//
// DISPLAY-ONLY (I-SHOW-1): renders props; no store, no fetch, no mutation,
// no runtime access, zero interactive affordances (no buttons, no handlers
// that change anything — pointer movement only steers the parallax camera).
//
// UNCHAINED by design: this surface is non-mutating, so the cockpit's audit
// constraints (SVG-only, motion vocabulary, flat amber) do not bind it. The
// DNA is inherited expressively: amber is still ONLY the Gate — here it may
// bloom, pulse, and throw streaks. Colors mirror
// src/lib/design-tokens/tokens.css (WebGL materials cannot consume CSS custom
// properties, so the hex is restated with its token name — the lockstep is
// asserted in the showcase suite).
//
// COMPOSITION LAW (the R3 polish passes): deliberate depth hierarchy — the
// Gate dominates; ring-2 primaries sit bright and close; ring-3 leaves
// recede dim and deep. Bloom is SELECTIVE (high threshold): the Gate,
// pending states, and comet heads bloom — cores stay crisp. Density comes
// from the dendrite plexus, whose color families are the scene's tones.

import { Html, Line } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  ELLIPSE_Y,
  RING_RADIUS_STEP,
  layoutScene,
  positionIndex,
  type SceneDescription,
  type SceneEdge,
  type SceneNode,
  type ScenePosition,
  type SceneTone,
} from "@/lib/showcase/scene";

// Token mirror (names from tokens.css / the shell registers):
export const TONE_HEX: Record<SceneTone, string> = {
  gate: "#ffb24d", // --jarvis-shell-gate (amber — Gate ONLY)
  life: "#6ee7b7", // --jarvis-color-emerald-local
  signal: "#5fe6e0", // --jarvis-shell-signal (cyan, read-only evidence)
  accent: "#86bcff", // --jarvis-shell-accent (sky register)
  stone: "#8ea4c4", // --jarvis-shell-ink-dim
};
const GATE_DEEP = "#ff8a1f"; // --jarvis-shell-gate-deep
const SKY = "#38bdf8"; // --jarvis-color-sky-focus (the life range's far end)
const FIELD_BG = "#020617"; // --jarvis-color-panel (the void the field sits in)
const INK = "#eaf1fb"; // --jarvis-shell-ink (neutral white for streaks)

/** Depth hierarchy per ring (world z): primaries forward, leaves receding. */
const RING_EMPHASIS: Record<number, { z: number; dim: number; scale: number }> =
  {
    1: { z: 0.1, dim: 0.78, scale: 0.92 }, // pipeline stages — supporting cast
    2: { z: 0.7, dim: 1.0, scale: 1.0 }, // governed surfaces — the primaries
    3: { z: -1.7, dim: 0.55, scale: 0.82 }, // leaves — recede into the field
  };

function emphasisFor(ring: number): { z: number; dim: number; scale: number } {
  return RING_EMPHASIS[ring] ?? { z: 0, dim: 1, scale: 1 };
}

export interface CinematicEngineProps {
  readonly scene: SceneDescription;
  /** Reduced-motion calm variant: the field still renders depth-lit, but
   * nothing travels — no pulse, no particle flow, no camera breathing. */
  readonly calm: boolean;
}

/** Deterministic [0,1) per (seed,i) — stable dust/particles, no Math.random. */
function hash01(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Deterministic numeric seed from a node id. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % 100000;
}

export function CinematicEngine({ scene, calm }: CinematicEngineProps) {
  const positions = useMemo(() => layoutScene(scene), [scene]);
  const index = useMemo(() => positionIndex(positions), [positions]);

  return (
    <Canvas
      aria-hidden="true"
      data-showcase-canvas="cinematic-engine"
      camera={{ position: [0, 4.2, 10.8], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[FIELD_BG]} />
      <fog attach="fog" args={[FIELD_BG, 16, 34]} />
      <ambientLight intensity={0.32} />
      <pointLight position={[0, 6, 6]} intensity={0.55} color={SKY} />

      <ParallaxRig calm={calm}>
        <DustField calm={calm} />
        {scene.edges.map((edge) => {
          const from = index.get(edge.from);
          const to = index.get(edge.to);
          if (!from || !to) return null;
          return (
            <FlowEdge
              key={`${edge.from}->${edge.to}`}
              edge={edge}
              from={from}
              to={to}
              calm={calm}
            />
          );
        })}
        {scene.nodes.map((node) => {
          const at = index.get(node.id);
          if (!at) return null;
          return node.id === scene.centerNodeId ? (
            <GateHeart key={node.id} node={node} calm={calm} />
          ) : (
            <OrbNode key={node.id} node={node} at={at} calm={calm} />
          );
        })}
      </ParallaxRig>

      <EffectComposer>
        <Bloom
          intensity={1.05}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.22}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.22} darkness={0.85} />
        <Noise opacity={0.025} />
      </EffectComposer>
    </Canvas>
  );
}

/** Pointer parallax + camera breathing. Pointer input only STEERS the view —
 * it changes nothing but the camera, which is the one interaction a
 * display-only surface may honestly offer. */
function ParallaxRig({
  calm,
  children,
}: {
  calm: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera, pointer, clock }) => {
    const rig = group.current;
    if (!rig) return;
    const targetY = pointer.x * 0.22;
    const targetX = -0.32 + pointer.y * 0.12;
    rig.rotation.y += (targetY - rig.rotation.y) * 0.04;
    rig.rotation.x += (targetX - rig.rotation.x) * 0.04;
    if (!calm) {
      const t = clock.elapsedTime;
      rig.rotation.y += Math.sin(t * 0.05) * 0.0008; // slow ambient drift
      camera.position.z = 10.8 + Math.sin(t * 0.24) * 0.3; // breathing
      camera.lookAt(0, 0, 0);
    }
  });
  return (
    <group ref={group} rotation={[-0.32, 0, 0]}>
      {children}
    </group>
  );
}

/** The center of gravity: the Gate as a pulsing amber heart — a crisp
 * faceted core inside two gyroscope rings, wrapped in its own synaptic
 * burst and radiant streaks. DOMINANT in the hierarchy. Pending state
 * (REAL proposal) drives the pulse. */
function GateHeart({ node, calm }: { node: SceneNode; calm: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const pending = node.state === "pending";
  const outerHalo = useMemo(() => makeHaloTexture(TONE_HEX.gate), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!calm && core.current) {
      const beat = pending ? 1 + Math.sin(t * 2.6) * 0.06 : 1;
      core.current.scale.setScalar(beat);
      core.current.rotation.y = t * 0.12;
      const material = core.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = pending
        ? 1.9 + Math.sin(t * 2.6) * 0.7
        : 1.2;
    }
    if (!calm && ringA.current && ringB.current) {
      ringA.current.rotation.z = t * 0.21;
      ringA.current.rotation.x = 0.6 + Math.sin(t * 0.11) * 0.2;
      ringB.current.rotation.z = -t * 0.16;
      ringB.current.rotation.y = 0.8 + Math.cos(t * 0.09) * 0.2;
    }
  });

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshStandardMaterial
          color={GATE_DEEP}
          emissive={TONE_HEX.gate}
          emissiveIntensity={pending ? 2.1 : 1.2}
          roughness={0.3}
          metalness={0.2}
          flatShading
        />
      </mesh>
      <mesh ref={ringA} rotation={[0.6, 0, 0]}>
        <torusGeometry args={[1.55, 0.02, 12, 96]} />
        <meshStandardMaterial
          color={TONE_HEX.gate}
          emissive={TONE_HEX.gate}
          emissiveIntensity={1.1}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={ringB} rotation={[1.4, 0.5, 0]}>
        <torusGeometry args={[1.95, 0.013, 12, 96]} />
        <meshStandardMaterial
          color={GATE_DEEP}
          emissive={GATE_DEEP}
          emissiveIntensity={0.75}
          transparent
          opacity={0.65}
        />
      </mesh>
      <DendriteBurst
        color={TONE_HEX.gate}
        seed={7}
        reach={2.7}
        count={110}
        dim={pending ? 1 : 0.7}
        calm={calm}
      />
      <RadiantStreaks calm={calm} />
      <sprite scale={7.5}>
        <spriteMaterial
          map={outerHalo}
          transparent
          opacity={pending ? 0.5 : 0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <pointLight
        color={TONE_HEX.gate}
        intensity={pending ? 3.2 : 1.8}
        distance={10}
      />
      <NodeLabel node={node} hero />
    </group>
  );
}

/** A ring node: crisp faceted core + hairline equator + synaptic dendrite
 * burst + disciplined halo + optional progress arc (the life range) + its
 * label in the app's real type registers. Emphasis (brightness/scale/depth)
 * follows the ring hierarchy. */
function OrbNode({
  node,
  at,
  calm,
}: {
  node: SceneNode;
  at: ScenePosition;
  calm: boolean;
}) {
  const halo = useRef<THREE.Sprite>(null);
  const emphasis = emphasisFor(node.ring);
  const radius = (0.16 + node.weight * 0.3) * emphasis.scale;
  const color = TONE_HEX[node.tone];
  const lit = node.state === "active" || node.state === "pending";
  const dim = emphasis.dim * (node.state === "empty" ? 0.55 : 1);

  const haloTexture = useMemo(() => makeHaloTexture(color), [color]);

  useFrame(({ clock }) => {
    if (calm || !halo.current) return;
    const t = clock.elapsedTime + at.x * 2.1; // desynchronize the shimmer
    const s = 1 + Math.sin(t * 1.4) * (lit ? 0.1 : 0.04);
    halo.current.scale.setScalar(radius * 5.2 * s);
  });

  return (
    <group position={[at.x, at.y, at.z + emphasis.z]}>
      <mesh rotation={[0.4, 0.7, 0]}>
        <icosahedronGeometry args={[radius, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={(lit ? 1.15 : 0.55) * dim}
          roughness={0.42}
          metalness={0.12}
          flatShading
        />
      </mesh>
      {/* crisp structural equator — the line that keeps the core an object,
          not a blob */}
      <mesh rotation={[Math.PI / 2.4, 0.4, 0]}>
        <torusGeometry args={[radius * 1.28, 0.008, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={(lit ? 1.6 : 0.9) * dim}
          transparent
          opacity={0.9}
        />
      </mesh>
      <DendriteBurst
        color={color}
        seed={seedOf(node.id)}
        reach={radius * 4.4}
        count={node.ring === 3 ? 22 : 46}
        dim={dim * (lit ? 1 : 0.72)}
        calm={calm}
      />
      <sprite ref={halo} scale={radius * 5.2}>
        <spriteMaterial
          map={haloTexture}
          transparent
          opacity={(lit ? 0.34 : 0.16) * emphasis.dim}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {node.fill !== undefined && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry
            args={[
              radius + 0.16,
              0.022,
              8,
              48,
              Math.max(0.02, node.fill) * Math.PI * 2,
            ]}
          />
          <meshStandardMaterial
            color={TONE_HEX.life}
            emissive={TONE_HEX.life}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      )}
      <NodeLabel node={node} />
    </group>
  );
}

/** DOM label riding the 3D node — the app's REAL fonts and registers
 * (Fraunces display, JetBrains Mono for the id chip) on a legibility pill,
 * with a measured progress bar when the node carries a REAL fill (the
 * terminal-card read). zIndexRange keeps every label under the chrome. */
function NodeLabel({
  node,
  hero = false,
}: {
  node: SceneNode;
  hero?: boolean;
}) {
  return (
    <Html
      center
      distanceFactor={hero ? 6.5 : 8.5}
      position={[0, hero ? 2.05 : -0.62, 0]}
      wrapperClass="showcase-label-wrap"
      zIndexRange={[40, 0]}
    >
      <div
        className={`showcase-label${hero ? " showcase-label-hero" : ""}`}
        data-showcase-node={node.id}
        data-showcase-state={node.state}
        data-showcase-ring={node.ring}
      >
        <span className="showcase-label-title">{node.label}</span>
        {node.sublabel !== undefined && (
          <span className="showcase-label-sub">{node.sublabel}</span>
        )}
        {node.fill !== undefined && (
          <span className="showcase-label-bar" aria-hidden="true">
            <span
              className="showcase-label-bar-fill"
              style={{ width: `${Math.round(node.fill * 100)}%` }}
            />
          </span>
        )}
      </div>
    </Html>
  );
}

/** An edge: an energy thread + a comet-train FIRING along it. Flow intensity
 * comes from the scene (REAL state — a pending proposal pushes the
 * chat->gate thread to full fire). The train is two layers: a bead stream
 * and brighter comet heads that punch past the bloom threshold. */
function FlowEdge({
  edge,
  from,
  to,
  calm,
}: {
  edge: SceneEdge;
  from: ScenePosition;
  to: ScenePosition;
  calm: boolean;
}) {
  const color = TONE_HEX[edge.tone];
  const { curve, linePoints } = useMemo(() => {
    const a = new THREE.Vector3(
      from.x,
      from.y,
      from.z + emphasisFor(ringOfPosition(from)).z,
    );
    const b = new THREE.Vector3(
      to.x,
      to.y,
      to.z + emphasisFor(ringOfPosition(to)).z,
    );
    const mid = a
      .clone()
      .add(b)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 0.35 + a.distanceTo(b) * 0.08, 0.25));
    const bezier = new THREE.QuadraticBezierCurve3(a, mid, b);
    return { curve: bezier, linePoints: bezier.getPoints(40) };
  }, [from, to]);

  const beadCount = Math.max(2, Math.round(3 + edge.flow * 9));
  const headCount = Math.max(1, Math.round(edge.flow * 2));
  const beads = useRef<THREE.Points>(null);
  const heads = useRef<THREE.Points>(null);
  const beadPositions = useMemo(
    () => new Float32Array(beadCount * 3),
    [beadCount],
  );
  const headPositions = useMemo(
    () => new Float32Array(headCount * 3),
    [headCount],
  );

  useFrame(({ clock }) => {
    const t = calm ? 0.37 : clock.elapsedTime;
    const speed = 0.16 + edge.flow * 0.34;
    const write = (
      cloud: THREE.Points | null,
      count: number,
      trail: number,
    ) => {
      if (!cloud) return;
      const attr = cloud.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const phase = calm
          ? (i + 0.5) / count
          : (t * speed + i / count + trail) % 1;
        const p = curve.getPoint(phase);
        attr.setXYZ(i, p.x, p.y, p.z);
      }
      attr.needsUpdate = true;
    };
    write(beads.current, beadCount, 0);
    write(heads.current, headCount, 0.04);
  });

  return (
    <group>
      <Line
        points={linePoints}
        color={color}
        transparent
        opacity={0.18 + edge.flow * 0.3}
        lineWidth={0.7 + edge.flow * 1.6}
      />
      <points ref={beads}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[beadPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.13 + edge.flow * 0.05}
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={heads}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[headPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.24 + edge.flow * 0.1}
          transparent
          opacity={1}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/** Ring lookup for edge endpoint depth — positions carry no ring, so infer
 * from radius (the layout's own geometry, via the SHARED constants). */
function ringOfPosition(p: ScenePosition): number {
  const radius = Math.hypot(p.x, p.y / ELLIPSE_Y);
  return Math.round(radius / RING_RADIUS_STEP);
}

/** A synaptic filament burst — the plexus of kinked dendrites that makes a
 * core read as ALIVE tissue, not a lone orb. Deterministic per seed; each
 * dendrite is two chained segments (core->kink->tip) with a sparkle at the
 * tip. Additive, tone-colored: the field's color families are the scene's
 * tones, so the amber family still only ever grows from the Gate. */
function DendriteBurst({
  color,
  seed,
  reach,
  count,
  dim,
  calm,
}: {
  color: string;
  seed: number;
  reach: number;
  count: number;
  dim: number;
  calm: boolean;
}) {
  const lines = useRef<THREE.LineSegments>(null);
  const { segments, tips } = useMemo(() => {
    const segs = new Float32Array(count * 4 * 3); // 2 segments x 2 points each
    const tipPts = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = hash01(seed, i * 3) * Math.PI * 2;
      const phi = Math.acos(2 * hash01(seed + 1, i * 3 + 1) - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta) * 0.8,
        Math.cos(phi),
      );
      const kinkLen = reach * (0.35 + hash01(seed + 2, i) * 0.4);
      const tipLen = reach * (0.85 + hash01(seed + 3, i) * 0.9);
      const kink = dir.clone().multiplyScalar(kinkLen);
      // the kink bends each dendrite off its ray — organic, not spoked
      kink.x += (hash01(seed + 4, i) - 0.5) * reach * 0.5;
      kink.y += (hash01(seed + 5, i) - 0.5) * reach * 0.5;
      const tip = dir.clone().multiplyScalar(tipLen);
      tip.y += (hash01(seed + 6, i) - 0.5) * reach * 0.6;
      const base = i * 12;
      segs.set([0, 0, 0, kink.x, kink.y, kink.z], base);
      segs.set([kink.x, kink.y, kink.z, tip.x, tip.y, tip.z], base + 6);
      tipPts.set([tip.x, tip.y, tip.z], i * 3);
    }
    return { segments: segs, tips: tipPts };
  }, [seed, reach, count]);

  useFrame(({ clock }) => {
    if (calm || !lines.current) return;
    const t = clock.elapsedTime;
    lines.current.rotation.y = Math.sin(t * 0.07 + seed) * 0.14;
    const material = lines.current.material as THREE.LineBasicMaterial;
    material.opacity = (0.3 + Math.sin(t * 1.1 + seed) * 0.08) * dim;
  });

  return (
    <group>
      <lineSegments ref={lines}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[segments, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.3 * dim}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[tips, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.05}
          transparent
          opacity={0.8 * dim}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** The Gate's radiant streaks — long thin rays exploding from the heart,
 * the starburst energy. Gate-scoped, so the warm family stays legal under
 * the amber law; every third ray is neutral ink-white. */
function RadiantStreaks({ calm }: { calm: boolean }) {
  const group = useRef<THREE.Group>(null);
  const STREAKS = 30;
  const { warm, white } = useMemo(() => {
    const warmSegs: number[] = [];
    const whiteSegs: number[] = [];
    for (let i = 0; i < STREAKS; i++) {
      const theta = hash01(90, i) * Math.PI * 2;
      const phi = Math.acos(2 * hash01(91, i) - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta) * 0.7,
        Math.cos(phi) * 0.8,
      );
      const inner = dir.clone().multiplyScalar(1.2 + hash01(92, i) * 0.6);
      const outer = dir.clone().multiplyScalar(3.6 + hash01(93, i) * 5.4);
      const target = i % 3 === 0 ? whiteSegs : warmSegs;
      target.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
    }
    return {
      warm: new Float32Array(warmSegs),
      white: new Float32Array(whiteSegs),
    };
  }, []);

  useFrame(({ clock }) => {
    if (calm || !group.current) return;
    group.current.rotation.z = clock.elapsedTime * 0.014;
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[warm, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={TONE_HEX.gate}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[white, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={INK}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

/** The ambient dust the organism floats in — deterministic, slow, deep.
 * Two layers: a broad faint field and sparse bright motes for depth. */
function DustField({ calm }: { calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const COUNT = 760;
  const MOTES = 120;
  const { positions, motes } = useMemo(() => {
    const out = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      out[i * 3] = (hash01(1, i) - 0.5) * 26;
      out[i * 3 + 1] = (hash01(2, i) - 0.5) * 14;
      out[i * 3 + 2] = (hash01(3, i) - 0.5) * 16;
    }
    const bright = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      bright[i * 3] = (hash01(4, i) - 0.5) * 22;
      bright[i * 3 + 1] = (hash01(5, i) - 0.5) * 12;
      bright[i * 3 + 2] = (hash01(6, i) - 0.5) * 14;
    }
    return { positions: out, motes: bright };
  }, []);

  useFrame(({ clock }) => {
    if (calm || !points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.008;
  });

  return (
    <group>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={TONE_HEX.stone}
          size={0.03}
          transparent
          opacity={0.42}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[motes, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={SKY}
          size={0.06}
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Radial-gradient halo sprite texture, built once per tone. */
function makeHaloTexture(hex: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, `${hex}cc`);
    gradient.addColorStop(0.4, `${hex}44`);
    gradient.addColorStop(1, `${hex}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
