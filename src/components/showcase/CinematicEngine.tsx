"use client";

// THE CINEMATIC ENGINE — scene-agnostic showreel renderer (I-SHOW-4).
//
// SYNAPSE-WEB PASS 2 (per the strict visual review): the scene renders as
// REGIONAL NEURAL TISSUE, not a constellation of long arcs. Every labelled
// node grows a local cloud of tiny junction points; short segments
// triangulate each cloud into a webbed region in the node's tone family;
// kinked bridges hop cluster-to-cluster through junctions; every region
// feeds filaments INWARD that BRIGHTEN toward the center, where an amber
// tissue cluster wraps a compact white-hot core — the brightest knot of the
// web, not a soft sun. Junction glints put the sparks ON the threads.
//
// It knows NOTHING about scenes' meaning — Scene 1 (the operating map) and
// Scene 2 (the WorkflowBox mind-map) are just SceneDescription inputs.
//
// DISPLAY-ONLY (I-SHOW-1): renders props; no store, no fetch, no mutation,
// no runtime access, zero interactive affordances (pointer movement only
// steers the parallax camera).
//
// UNCHAINED by design (non-mutating), DNA inherited: amber is still ONLY the
// Gate's — the warm tissue grows solely at the center. Colors mirror
// src/lib/design-tokens/tokens.css (lockstep asserted in the suite).

import { Html } from "@react-three/drei";
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
  layoutScene,
  positionIndex,
  type SceneDescription,
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
const SKY = "#38bdf8"; // --jarvis-color-sky-focus
const FIELD_BG = "#010409"; // deep end of --jarvis-color-panel's void
const INK = "#eaf1fb"; // --jarvis-shell-ink

/** Depth emphasis per ring: primaries forward/bright, leaves receding. */
const RING_EMPHASIS: Record<number, { z: number; dim: number; scale: number }> =
  {
    1: { z: 0.1, dim: 0.8, scale: 0.92 },
    2: { z: 0.7, dim: 1.0, scale: 1.0 },
    3: { z: -1.7, dim: 0.6, scale: 0.85 },
  };

function emphasisFor(ring: number): { z: number; dim: number; scale: number } {
  return RING_EMPHASIS[ring] ?? { z: 0, dim: 1, scale: 1 };
}

export interface CinematicEngineProps {
  readonly scene: SceneDescription;
  /** Reduced-motion calm variant: fully assembled, depth-lit, still —
   * no materialization sweep, no flow, no pulse, no camera breathing. */
  readonly calm: boolean;
}

/** Deterministic [0,1) per (seed,i) — stable geometry, no Math.random. */
function hash01(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % 100000;
}

function worldOf(p: ScenePosition, ring: number): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z + emphasisFor(ring).z);
}

interface PlacedNode {
  readonly node: SceneNode;
  readonly at: THREE.Vector3;
  readonly color: THREE.Color;
  /** The node's local junction cloud — the tissue's joints. */
  readonly junctions: readonly THREE.Vector3[];
}

/** Scatter a flattened ellipsoid junction cloud around a node. */
function cloudOf(
  at: THREE.Vector3,
  seed: number,
  count: number,
  reach: number,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const theta = hash01(seed, i) * Math.PI * 2;
    const phi = Math.acos(2 * hash01(seed + 1, i) - 1);
    const r = reach * (0.25 + 0.75 * Math.cbrt(hash01(seed + 2, i)));
    out.push(
      new THREE.Vector3(
        at.x + Math.sin(phi) * Math.cos(theta) * r,
        at.y + Math.sin(phi) * Math.sin(theta) * r * 0.7,
        at.z + Math.cos(phi) * r * 0.8,
      ),
    );
  }
  return out;
}

export function CinematicEngine({ scene, calm }: CinematicEngineProps) {
  const placed = useMemo<readonly PlacedNode[]>(() => {
    const index = positionIndex(layoutScene(scene));
    return scene.nodes.flatMap((node) => {
      const p = index.get(node.id);
      if (!p) return [];
      const isCenter = node.id === scene.centerNodeId;
      const ring = isCenter ? 0 : node.ring;
      const at = worldOf(p, ring);
      const seed = seedOf(node.id);
      const count = isCenter ? 34 : node.ring === 3 ? 14 : 24;
      const reach = isCenter ? 2.1 : 0.9 + node.weight * 1.0;
      return [
        {
          node,
          at,
          color: new THREE.Color(TONE_HEX[node.tone]),
          junctions: cloudOf(at, seed + 50, count, reach),
        },
      ];
    });
  }, [scene]);
  const byId = useMemo(
    () => new Map(placed.map((entry) => [entry.node.id, entry])),
    [placed],
  );

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
      <fog attach="fog" args={[FIELD_BG, 18, 40]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 6, 6]} intensity={0.4} color={SKY} />

      <ParallaxRig calm={calm}>
        <DustField calm={calm} />
        <TissueMesh scene={scene} placed={placed} byId={byId} calm={calm} />
        <InwardFlow scene={scene} byId={byId} calm={calm} />
        {placed.map((entry) =>
          entry.node.id === scene.centerNodeId ? (
            <GateCore key={entry.node.id} node={entry.node} calm={calm} />
          ) : (
            <NodePoint key={entry.node.id} entry={entry} calm={calm} />
          ),
        )}
      </ParallaxRig>

      <EffectComposer>
        <Bloom
          intensity={1.0}
          luminanceThreshold={0.28}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.88} />
        <Noise opacity={0.03} />
      </EffectComposer>
    </Canvas>
  );
}

/** Pointer parallax + camera breathing — the one honest interaction. The rig
 * sits slightly high so the bottom ring's chips clear the telemetry strip. */
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
    const targetY = pointer.x * 0.24;
    const targetX = -0.3 + pointer.y * 0.12;
    rig.rotation.y += (targetY - rig.rotation.y) * 0.04;
    rig.rotation.x += (targetX - rig.rotation.x) * 0.04;
    if (!calm) {
      const t = clock.elapsedTime;
      rig.rotation.y += Math.sin(t * 0.045) * 0.0008;
      // breathing varies position ONLY — no re-aim, so the full variant keeps
      // the calm variant's exact framing (bottom chips stay clear).
      camera.position.z = 10.8 + Math.sin(t * 0.22) * 0.28;
    }
  });
  return (
    <group ref={group} rotation={[-0.3, 0, 0]} position={[0, 0.35, 0]}>
      {children}
    </group>
  );
}

function ramp(t: number, delay: number, duration: number, calm: boolean) {
  if (calm) return 1;
  return THREE.MathUtils.clamp((t - delay) / duration, 0, 1);
}

// ---------------------------------------------------------------------------
// THE TISSUE — regional neural mesh. Per-vertex-colored static systems:
//   1. REGION TISSUE: each cluster's junctions triangulated by short straight
//      segments (nearest neighbors + spokes to the anchor) — the webbing;
//   2. BRIDGES: for each scene edge, kinked threads hopping junction ->
//      junction between the two clusters (no smooth long-haul arcs);
//   3. INWARD FILAMENTS: junctions stream to the core, BRIGHTENING as they
//      arrive (the moat is tissue, not emptiness);
//   4. JUNCTION GLINTS: every junction is a tiny bright point — the sparks
//      live ON the threads.
// Luminance is jittered per segment so each family reads as living tissue.
// ---------------------------------------------------------------------------

function pushSegment(
  pos: number[],
  col: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  color: THREE.Color,
  alphaA: number,
  alphaB: number,
) {
  pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  col.push(
    color.r * alphaA,
    color.g * alphaA,
    color.b * alphaA,
    color.r * alphaB,
    color.g * alphaB,
    color.b * alphaB,
  );
}

function TissueMesh({
  scene,
  placed,
  byId,
  calm,
}: {
  scene: SceneDescription;
  placed: readonly PlacedNode[];
  byId: ReadonlyMap<string, PlacedNode>;
  calm: boolean;
}) {
  const tissueMat = useRef<THREE.LineBasicMaterial>(null);
  const bridgeMat = useRef<THREE.LineBasicMaterial>(null);
  const inwardMat = useRef<THREE.LineBasicMaterial>(null);
  const glintMat = useRef<THREE.PointsMaterial>(null);

  const { tissue, bridges, inward, glints, glintColors } = useMemo(() => {
    const tPos: number[] = [];
    const tCol: number[] = [];
    const gPos: number[] = [];
    const gCol: number[] = [];
    const origin = new THREE.Vector3(0, 0, 0);
    const gateColor = new THREE.Color(TONE_HEX.gate);

    // 1. REGION TISSUE — triangulate every cluster with short segments.
    for (const entry of placed) {
      const isCenter = entry.node.id === scene.centerNodeId;
      const color = isCenter ? gateColor : entry.color;
      const dim = isCenter ? 1 : emphasisFor(entry.node.ring).dim;
      const seed = seedOf(entry.node.id);
      const js = entry.junctions;
      js.forEach((j, i) => {
        // glint at every junction
        gPos.push(j.x, j.y, j.z);
        const gl = (0.65 + hash01(seed + 3, i) * 0.35) * dim;
        gCol.push(color.r * gl, color.g * gl, color.b * gl);
        // nearest-2 neighbor links (the local web)
        const near = js
          .map((other, k) => ({
            k,
            d: k === i ? Infinity : j.distanceTo(other),
          }))
          .sort((x, y) => x.d - y.d)
          .slice(0, 2);
        for (const { k } of near) {
          if (k < i) continue; // dedupe
          const lum = (0.28 + hash01(seed + 4, i * 31 + k) * 0.3) * dim;
          pushSegment(tPos, tCol, j, js[k], color, lum, lum * 0.7);
        }
        // spoke to the anchor for ~55% of junctions
        if (hash01(seed + 5, i) < 0.55) {
          const lum = (0.3 + hash01(seed + 6, i) * 0.25) * dim;
          pushSegment(tPos, tCol, j, entry.at, color, lum * 0.8, lum);
        }
      });
    }

    // 2. BRIDGES — kinked junction-to-junction threads per real edge.
    const bPos: number[] = [];
    const bCol: number[] = [];
    scene.edges.forEach((edge, e) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return;
      const color = new THREE.Color(TONE_HEX[edge.tone]);
      const threads = 3 + Math.round(edge.flow * 2);
      for (let s = 0; s < threads; s++) {
        const a =
          from.junctions[
            Math.floor(hash01(60 + e, s) * from.junctions.length)
          ] ?? from.at;
        const b =
          to.junctions[Math.floor(hash01(61 + e, s) * to.junctions.length)] ??
          to.at;
        // two kinks make it a thread through the web, not a smooth arc
        const k1 = a
          .clone()
          .lerp(b, 0.33)
          .add(
            new THREE.Vector3(
              (hash01(62 + e, s) - 0.5) * 1.2,
              (hash01(63 + e, s) - 0.5) * 1.0,
              (hash01(64 + e, s) - 0.5) * 1.0,
            ),
          );
        const k2 = a
          .clone()
          .lerp(b, 0.66)
          .add(
            new THREE.Vector3(
              (hash01(65 + e, s) - 0.5) * 1.2,
              (hash01(66 + e, s) - 0.5) * 1.0,
              (hash01(67 + e, s) - 0.5) * 1.0,
            ),
          );
        const strength = 0.3 + edge.flow * 0.35;
        const l1 = strength * (0.7 + hash01(68 + e, s) * 0.3);
        pushSegment(bPos, bCol, a, k1, color, l1, l1 * 0.85);
        pushSegment(bPos, bCol, k1, k2, color, l1 * 0.85, l1 * 0.85);
        pushSegment(bPos, bCol, k2, b, color, l1 * 0.85, l1);
      }
    });

    // 3. INWARD FILAMENTS — junctions stream home, brightening on arrival.
    const iPos: number[] = [];
    const iCol: number[] = [];
    for (const entry of placed) {
      if (entry.node.id === scene.centerNodeId) continue;
      const seed = seedOf(entry.node.id);
      const count = entry.node.ring === 3 ? 3 : 5;
      for (let s = 0; s < count; s++) {
        const start =
          entry.junctions[
            Math.floor(hash01(seed + 12, s) * entry.junctions.length)
          ] ?? entry.at;
        const kink = start
          .clone()
          .multiplyScalar(0.5)
          .add(
            new THREE.Vector3(
              (hash01(seed + 13, s) - 0.5) * 1.8,
              (hash01(seed + 14, s) - 0.5) * 1.5,
              (hash01(seed + 15, s) - 0.5) * 1.5,
            ),
          );
        // the thread walks in: node tone at the rim, warming as it arrives
        const lumOut = 0.2 + hash01(seed + 16, s) * 0.12;
        pushSegment(iPos, iCol, start, kink, entry.color, lumOut, lumOut * 1.4);
        // arrival segment brightens INTO the core (no moat) and hands the
        // last step to the gate family
        const arrival = kink.clone().lerp(origin, 0.86);
        pushSegment(
          iPos,
          iCol,
          kink,
          arrival,
          entry.color,
          lumOut * 1.4,
          lumOut * 2.1,
        );
        pushSegment(iPos, iCol, arrival, origin, gateColor, 0.5, 0.75);
      }
    }

    const build = (pos: number[], col: number[]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pos, 3),
      );
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      return geometry;
    };
    const glintGeometry = new THREE.BufferGeometry();
    glintGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gPos, 3),
    );
    glintGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(gCol, 3),
    );
    return {
      tissue: build(tPos, tCol),
      bridges: build(bPos, bCol),
      inward: build(iPos, iCol),
      glints: glintGeometry,
      glintColors: gCol.length / 3,
    };
  }, [scene, placed, byId]);

  // MATERIALIZATION (tissue -> bridges -> inward -> glints) + breathing.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tissueMat.current)
      tissueMat.current.opacity =
        ramp(t, 0.1, 1.2, calm) * (calm ? 1 : 0.92 + Math.sin(t * 0.9) * 0.08);
    if (bridgeMat.current)
      bridgeMat.current.opacity =
        ramp(t, 0.8, 1.2, calm) *
        (calm ? 1 : 0.92 + Math.sin(t * 1.1 + 2) * 0.08);
    if (inwardMat.current)
      inwardMat.current.opacity =
        ramp(t, 1.4, 1.4, calm) *
        (calm ? 1 : 0.9 + Math.sin(t * 0.7 + 4) * 0.1);
    if (glintMat.current)
      glintMat.current.opacity =
        ramp(t, 0.4, 1.4, calm) *
        (calm ? 1 : 0.85 + Math.sin(t * 1.6 + 1) * 0.15);
  });

  return (
    <group>
      <lineSegments geometry={tissue}>
        <lineBasicMaterial
          ref={tissueMat}
          vertexColors
          transparent
          opacity={calm ? 1 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={bridges}>
        <lineBasicMaterial
          ref={bridgeMat}
          vertexColors
          transparent
          opacity={calm ? 1 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={inward}>
        <lineBasicMaterial
          ref={inwardMat}
          vertexColors
          transparent
          opacity={calm ? 1 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points geometry={glints}>
        <pointsMaterial
          ref={glintMat}
          vertexColors
          size={0.055}
          transparent
          opacity={calm ? 1 : 0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {glintColors === 0 && null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// INWARD FLOW — sparks ride the web home to the core (HDR, they bloom).
// ---------------------------------------------------------------------------

interface SparkTrack {
  readonly curve: THREE.QuadraticBezierCurve3;
  readonly color: THREE.Color;
  readonly speed: number;
  readonly offset: number;
}

function InwardFlow({
  scene,
  byId,
  calm,
}: {
  scene: SceneDescription;
  byId: ReadonlyMap<string, PlacedNode>;
  calm: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const { tracks, positions, colors } = useMemo(() => {
    const list: SparkTrack[] = [];
    const origin = new THREE.Vector3(0, 0, 0);
    scene.edges.forEach((edge, e) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return;
      const inwardAB = to.at.length() <= from.at.length();
      const a = inwardAB ? from.at : to.at;
      const b = inwardAB ? to.at : from.at;
      const mid = a
        .clone()
        .add(b)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 0.4 + a.distanceTo(b) * 0.07, 0.2));
      const n = Math.max(2, Math.round(2 + edge.flow * 6));
      for (let s = 0; s < n; s++) {
        list.push({
          curve: new THREE.QuadraticBezierCurve3(a, mid, b),
          color: new THREE.Color(TONE_HEX[edge.tone]),
          speed: 0.1 + edge.flow * 0.22 + hash01(31 + e, s) * 0.05,
          offset: hash01(32 + e, s),
        });
      }
    });
    for (const entry of byId.values()) {
      if (entry.node.id === scene.centerNodeId) continue;
      const seed = seedOf(entry.node.id);
      const n = entry.node.ring === 3 ? 2 : 4;
      for (let s = 0; s < n; s++) {
        const mid = entry.at
          .clone()
          .multiplyScalar(0.5)
          .add(
            new THREE.Vector3(
              (hash01(seed + 7, s) - 0.5) * 2.2,
              (hash01(seed + 8, s) - 0.5) * 1.8,
              (hash01(seed + 9, s) - 0.5) * 1.8,
            ),
          );
        list.push({
          curve: new THREE.QuadraticBezierCurve3(entry.at, mid, origin),
          color: entry.color.clone(),
          speed: 0.07 + hash01(seed + 10, s) * 0.06,
          offset: hash01(seed + 11, s),
        });
      }
    }
    const pos = new Float32Array(list.length * 3);
    const col = new Float32Array(list.length * 3);
    list.forEach((track, i) => {
      col.set([track.color.r, track.color.g, track.color.b], i * 3);
    });
    return { tracks: list, positions: pos, colors: col };
  }, [scene, byId]);

  useFrame(({ clock }) => {
    const cloud = points.current;
    if (!cloud) return;
    const t = clock.elapsedTime;
    const attr = cloud.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const appear = ramp(t, 1.6, 1.2, calm);
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const phase = calm ? track.offset : (track.offset + t * track.speed) % 1;
      const p = track.curve.getPoint(phase);
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
    (cloud.material as THREE.PointsMaterial).opacity = appear;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.1}
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// NODES — crisp anchor points where the tissue converges.
// ---------------------------------------------------------------------------

function NodePoint({ entry, calm }: { entry: PlacedNode; calm: boolean }) {
  const { node, at, color } = entry;
  const group = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Sprite>(null);
  const seed = seedOf(node.id);
  const emphasis = emphasisFor(node.ring);
  const lit = node.state === "active" || node.state === "pending";
  const size = (0.07 + node.weight * 0.07) * emphasis.scale;
  const dim = emphasis.dim * (node.state === "empty" ? 0.55 : 1);
  const flareTexture = useMemo(
    () => makeFlareTexture(`#${color.getHexString()}`),
    [color],
  );
  const birthDelay = 0.4 + hash01(seed, 1) * 1.6;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const appear = ramp(t, birthDelay, 0.5, calm);
    if (group.current) {
      const overshoot = calm ? 1 : 1 + Math.sin(appear * Math.PI) * 0.4;
      group.current.scale.setScalar(Math.max(0.0001, appear * overshoot));
    }
    if (flare.current) {
      const cycle = calm ? 0.5 : (t * 0.14 + hash01(seed, 2)) % 1;
      const glint = calm ? 0 : Math.max(0, 1 - Math.abs(cycle - 0.5) * 10);
      const base = lit ? 1.1 : 0.75;
      flare.current.scale.setScalar(size * (6 + glint * 4.5) * base);
      (flare.current.material as THREE.SpriteMaterial).opacity =
        appear * (lit ? 0.8 : 0.5) * dim * (1 + glint * 0.6);
    }
  });

  return (
    <group position={at}>
      <group ref={group}>
        <mesh>
          <octahedronGeometry args={[size, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={(lit ? 2.2 : 1.3) * dim}
            roughness={0.3}
            flatShading
          />
        </mesh>
        <sprite ref={flare} scale={size * 6}>
          <spriteMaterial
            map={flareTexture}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        {node.fill !== undefined && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[
                size * 2.6,
                0.013,
                6,
                40,
                Math.max(0.02, node.fill) * Math.PI * 2,
              ]}
            />
            <meshStandardMaterial
              color={TONE_HEX.life}
              emissive={TONE_HEX.life}
              emissiveIntensity={1.6}
              toneMapped={false}
            />
          </mesh>
        )}
      </group>
      <NodeLabel node={node} />
    </group>
  );
}

/** The core: the brightest KNOT of the web — a compact white-hot point in a
 * tight faceted shell and one thin ring. Pulses with the REAL pending
 * proposal. No wide soft halo: its amber tissue cluster (TissueMesh) is the
 * corona. */
function GateCore({ node, calm }: { node: SceneNode; calm: boolean }) {
  const hot = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pending = node.state === "pending";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const appear = ramp(t, 0, 0.9, calm);
    const beat = calm ? 1 : pending ? 1 + Math.sin(t * 2.6) * 0.1 : 1;
    if (hot.current) hot.current.scale.setScalar(appear * beat);
    if (shell.current) {
      shell.current.scale.setScalar(appear);
      shell.current.rotation.y = calm ? 0 : t * 0.16;
      (shell.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        pending && !calm ? 1.8 + Math.sin(t * 2.6) * 0.6 : 1.3;
    }
    if (ring.current && !calm) {
      ring.current.rotation.z = t * 0.2;
      ring.current.rotation.x = 0.6 + Math.sin(t * 0.1) * 0.22;
    }
  });

  return (
    <group>
      <mesh ref={hot}>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshBasicMaterial color="#fff3dd" toneMapped={false} />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color={GATE_DEEP}
          emissive={TONE_HEX.gate}
          emissiveIntensity={pending ? 1.8 : 1.3}
          roughness={0.3}
          metalness={0.2}
          flatShading
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={ring} rotation={[0.6, 0, 0]}>
        <torusGeometry args={[0.85, 0.01, 10, 96]} />
        <meshStandardMaterial
          color={TONE_HEX.gate}
          emissive={TONE_HEX.gate}
          emissiveIntensity={1.2}
          transparent
          opacity={0.85}
        />
      </mesh>
      <pointLight
        color={TONE_HEX.gate}
        intensity={pending ? 2.6 : 1.6}
        distance={9}
      />
      <NodeLabel node={node} hero />
    </group>
  );
}

/** Label chip: small clean terminal box over the mesh — mono chip register,
 * real values only, measured fill bar when the node carries a REAL rollup. */
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
      distanceFactor={hero ? 6.8 : 9}
      position={[0, hero ? 1.35 : -0.42, 0]}
      wrapperClass="showcase-label-wrap"
      zIndexRange={[40, 0]}
    >
      <div
        className={`showcase-label${hero ? " showcase-label-hero" : ""}`}
        data-showcase-node={node.id}
        data-showcase-state={node.state}
        data-showcase-ring={node.ring}
        data-showcase-tone={node.tone}
      >
        <span className="showcase-label-title">{node.label}</span>
        <span className="showcase-label-sub">
          {node.sublabel !== undefined ? `${node.sublabel} · ` : ""}
          {node.state}
        </span>
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

/** The spark field behind the organism — quiet, so the tissue dominates. */
function DustField({ calm }: { calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const COUNT = 700;
  const MOTES = 120;
  const { positions, motes } = useMemo(() => {
    const out = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      out[i * 3] = (hash01(1, i) - 0.5) * 28;
      out[i * 3 + 1] = (hash01(2, i) - 0.5) * 15;
      out[i * 3 + 2] = (hash01(3, i) - 0.5) * 17;
    }
    const bright = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      bright[i * 3] = (hash01(4, i) - 0.5) * 23;
      bright[i * 3 + 1] = (hash01(5, i) - 0.5) * 13;
      bright[i * 3 + 2] = (hash01(6, i) - 0.5) * 15;
    }
    return { positions: out, motes: bright };
  }, []);

  useFrame(({ clock }) => {
    if (calm || !points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.007;
  });

  return (
    <group>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={TONE_HEX.stone}
          size={0.02}
          transparent
          opacity={0.32}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[motes, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={INK}
          size={0.045}
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Thin 4-point cross flare — the crisp materializing-point signature. */
function makeFlareTexture(hex: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const c = size / 2;
    const arm = (angle: number) => {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(0, 0, c, 0);
      gradient.addColorStop(0, `${hex}ee`);
      gradient.addColorStop(0.25, `${hex}55`);
      gradient.addColorStop(1, `${hex}00`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, -1.2, c, 2.4);
      ctx.restore();
    };
    arm(0);
    arm(Math.PI / 2);
    arm(Math.PI);
    arm(-Math.PI / 2);
    const core = ctx.createRadialGradient(c, c, 0, c, c, 9);
    core.addColorStop(0, "#ffffffee");
    core.addColorStop(1, `${hex}00`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(c, c, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
