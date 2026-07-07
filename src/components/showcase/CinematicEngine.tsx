"use client";

// THE PLEXUS ENGINE — the reference frame's background, ALIVE.
//
// MOTION PASS (matched to the reference clips): the mesh never sits still —
//   1. TRAVELING PULSES: hundreds of staggered light beads run the threads
//      continuously, flowing along the bridges and feeder filaments INTO the
//      bright center;
//   2. SPARK SPRAY: the mass continuously throws off bright sparks that
//      shoot outward on gently curving paths, each trailing a fading ribbon
//      of light, respawning forever;
//   3. BREATHING + DRIFT: the core heat swells and contracts (harder and
//      faster while a REAL proposal is pending), and the whole web drifts
//      in a slow oscillating idle — a living pause, never a paused frame.
//
// DISPLAY-ONLY (I-SHOW-1): renders props; no store, no fetch, no mutation,
// no runtime access, zero interactive affordances (pointer movement only
// steers the parallax camera). Reduced-motion renders the fully assembled
// field, still and at reduced density (calm).

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// The reference frame's palette — exact hues per region (the user's spec
// image is the source of truth for this surface).
export const REFERENCE_PALETTE = {
  core: "#ff4d4d",
  humanGate: "#8c8cff",
  memory: "#5c8cff",
  voice: "#ffa24d",
  council: "#ff6b4d",
  roomOs: "#5cc8ff",
  knowledge: "#ffb838",
  pipeline: "#58d858",
  white: "#f2f6ff",
} as const;

/** Fixed cluster composition matching the reference (world units; camera at
 * z 11.4, fov 40 — visible ~±8.6 x, ~±4.6 y). */
const CLUSTERS: ReadonlyArray<{
  id: keyof typeof REFERENCE_PALETTE;
  x: number;
  y: number;
  z: number;
  count: number;
  reach: number;
}> = [
  { id: "core", x: 0, y: 0.9, z: 0, count: 96, reach: 2.9 },
  { id: "humanGate", x: 4.7, y: 2.7, z: -0.6, count: 52, reach: 2.2 },
  { id: "memory", x: -3.5, y: 0.9, z: 0.2, count: 48, reach: 2.0 },
  { id: "voice", x: 4.3, y: 0.7, z: 0.3, count: 48, reach: 2.1 },
  { id: "council", x: -4.0, y: -1.9, z: -0.2, count: 46, reach: 2.0 },
  { id: "roomOs", x: -0.6, y: -2.3, z: 0.4, count: 42, reach: 1.8 },
  { id: "knowledge", x: 3.5, y: -2.5, z: -0.3, count: 52, reach: 2.2 },
  { id: "pipeline", x: 0.9, y: -3.3, z: 0.1, count: 46, reach: 2.0 },
];

/** Bridges between visually adjacent regions. */
const BRIDGES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
  [1, 3],
  [2, 4],
  [3, 6],
  [4, 5],
  [5, 7],
  [6, 7],
  [2, 5],
];

const CORE = new THREE.Vector3(0, 0.9, 0);

export interface CinematicEngineProps {
  /** Reduced-motion calm variant: fully assembled, still. */
  readonly calm: boolean;
  /** REAL Gate state — a pending proposal makes the core breathe harder. */
  readonly pending?: boolean;
}

/** Deterministic [0,1) per (seed,i) — stable geometry, no Math.random. */
function hash01(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function ramp(t: number, delay: number, duration: number, calm: boolean) {
  if (calm) return 1;
  return THREE.MathUtils.clamp((t - delay) / duration, 0, 1);
}

function cloudOf(
  cx: number,
  cy: number,
  cz: number,
  seed: number,
  count: number,
  reach: number,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const theta = hash01(seed, i) * Math.PI * 2;
    const phi = Math.acos(2 * hash01(seed + 1, i) - 1);
    const r = reach * (0.2 + 0.8 * Math.cbrt(hash01(seed + 2, i)));
    out.push(
      new THREE.Vector3(
        cx + Math.sin(phi) * Math.cos(theta) * r,
        cy + Math.sin(phi) * Math.sin(theta) * r * 0.72,
        cz + Math.cos(phi) * r * 0.8,
      ),
    );
  }
  return out;
}

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

/** A polyline a pulse can ride: waypoints + cumulative arc lengths. */
interface PulseTrack {
  readonly points: readonly THREE.Vector3[];
  readonly cum: readonly number[];
  readonly total: number;
  readonly color: THREE.Color;
}

function makeTrack(
  points: readonly THREE.Vector3[],
  color: THREE.Color,
): PulseTrack {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += points[i].distanceTo(points[i - 1]);
    cum.push(total);
  }
  return { points, cum, total, color };
}

function sampleTrack(track: PulseTrack, t01: number, out: THREE.Vector3) {
  const d = t01 * track.total;
  let i = 1;
  while (i < track.cum.length - 1 && track.cum[i] < d) i++;
  const segStart = track.cum[i - 1];
  const segLen = Math.max(1e-6, track.cum[i] - segStart);
  const f = (d - segStart) / segLen;
  out.copy(track.points[i - 1]).lerp(track.points[i], f);
}

/** All static geometry + the pulse tracks + spark spawn points, built once. */
function useMeshData() {
  return useMemo(() => {
    const tPos: number[] = [];
    const tCol: number[] = [];
    const gPos: number[] = [];
    const gCol: number[] = [];
    const tracks: PulseTrack[] = [];
    const spawns: { pos: THREE.Vector3; color: THREE.Color }[] = [];
    const clusterClouds: THREE.Vector3[][] = [];
    const white = new THREE.Color(REFERENCE_PALETTE.white);

    CLUSTERS.forEach((cluster, c) => {
      const color = new THREE.Color(REFERENCE_PALETTE[cluster.id]);
      const seed = 100 + c * 37;
      const js = cloudOf(
        cluster.x,
        cluster.y,
        cluster.z,
        seed,
        cluster.count,
        cluster.reach,
      );
      clusterClouds.push(js);
      js.forEach((j, i) => {
        gPos.push(j.x, j.y, j.z);
        const gl = 0.55 + hash01(seed + 3, i) * 0.45;
        gCol.push(color.r * gl, color.g * gl, color.b * gl);
        const near = js
          .map((other, k) => ({
            k,
            d: k === i ? Infinity : j.distanceTo(other),
          }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 3);
        for (const { k } of near) {
          if (k < i) continue;
          const lum = 0.32 + hash01(seed + 4, i * 31 + k) * 0.38;
          pushSegment(tPos, tCol, j, js[k], color, lum, lum * 0.75);
        }
        if (hash01(seed + 9, i) < 0.3) spawns.push({ pos: j, color });
      });
    });

    // inter-cluster threads — each one is also a pulse track
    BRIDGES.forEach(([a, b], e) => {
      const ja = clusterClouds[a];
      const jb = clusterClouds[b];
      const colorA = new THREE.Color(REFERENCE_PALETTE[CLUSTERS[a].id]);
      const colorB = new THREE.Color(REFERENCE_PALETTE[CLUSTERS[b].id]);
      for (let s = 0; s < 7; s++) {
        const p = ja[Math.floor(hash01(500 + e, s) * ja.length)];
        const q = jb[Math.floor(hash01(501 + e, s) * jb.length)];
        const k1 = p
          .clone()
          .lerp(q, 0.34)
          .add(
            new THREE.Vector3(
              (hash01(503 + e, s) - 0.5) * 1.1,
              (hash01(504 + e, s) - 0.5) * 0.9,
              (hash01(505 + e, s) - 0.5) * 0.9,
            ),
          );
        const k2 = p
          .clone()
          .lerp(q, 0.67)
          .add(
            new THREE.Vector3(
              (hash01(506 + e, s) - 0.5) * 1.1,
              (hash01(507 + e, s) - 0.5) * 0.9,
              (hash01(508 + e, s) - 0.5) * 0.9,
            ),
          );
        const mixed = colorA.clone().lerp(colorB, 0.5).lerp(white, 0.3);
        const lum = 0.2 + hash01(502 + e, s) * 0.22;
        pushSegment(tPos, tCol, p, k1, mixed, lum, lum);
        pushSegment(tPos, tCol, k1, k2, mixed, lum, lum);
        pushSegment(tPos, tCol, k2, q, mixed, lum, lum);
        tracks.push(makeTrack([p, k1, k2, q], mixed));
      }
    });

    // feeder filaments — every cluster streams into the core; faint static
    // lines whose pulses carry the visible current inward
    CLUSTERS.forEach((cluster, c) => {
      if (cluster.id === "core") return;
      const js = clusterClouds[c];
      const color = new THREE.Color(REFERENCE_PALETTE[cluster.id]);
      const seed = 900 + c * 53;
      for (let s = 0; s < 6; s++) {
        const start = js[Math.floor(hash01(seed, s) * js.length)];
        const kink = start
          .clone()
          .lerp(CORE, 0.5)
          .add(
            new THREE.Vector3(
              (hash01(seed + 1, s) - 0.5) * 1.6,
              (hash01(seed + 2, s) - 0.5) * 1.3,
              (hash01(seed + 3, s) - 0.5) * 1.3,
            ),
          );
        const lum = 0.14 + hash01(seed + 4, s) * 0.1;
        pushSegment(tPos, tCol, start, kink, color, lum, lum * 1.3);
        pushSegment(tPos, tCol, kink, CORE, color, lum * 1.3, lum * 1.9);
        tracks.push(makeTrack([start, kink, CORE], color));
      }
    });

    const build = (pos: number[], col: number[]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pos, 3),
      );
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      return geometry;
    };
    return {
      tissue: build(tPos, tCol),
      glints: build(gPos, gCol),
      tracks,
      spawns,
    };
  }, []);
}

type MeshData = ReturnType<typeof useMeshData>;

export function CinematicEngine({
  calm,
  pending = false,
}: CinematicEngineProps) {
  return (
    <Canvas
      aria-hidden="true"
      data-showcase-canvas="cinematic-engine"
      camera={{ position: [0, 0, 11.4], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 16, 34]} />
      <ambientLight intensity={0.3} />

      <SceneBody calm={calm} pending={pending} />

      {calm ? (
        <EffectComposer>
          <Bloom
            intensity={0.95}
            luminanceThreshold={0.24}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.18} darkness={0.9} />
        </EffectComposer>
      ) : (
        <EffectComposer>
          <Bloom
            intensity={0.95}
            luminanceThreshold={0.24}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.18} darkness={0.9} />
          {/* animated film grain is MOTION — reduced-motion drops it */}
          <Noise opacity={0.03} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

/** Everything inside the rig shares one mesh-data build. */
function SceneBody({ calm, pending }: { calm: boolean; pending: boolean }) {
  const data = useMeshData();
  return (
    <ParallaxRig calm={calm}>
      <CoreGlow calm={calm} pending={pending} />
      <PlexusField data={data} calm={calm} />
      <PulseFlow data={data} calm={calm} />
      <SparkSpray data={data} calm={calm} />
      <RadiantStreaks calm={calm} />
      <DustField calm={calm} />
    </ParallaxRig>
  );
}

/** Pointer parallax + the living idle: slow oscillating drift and a barely
 * perceptible breathing of the whole web — never frozen, never wandering
 * away from the fixed DOM overlay. */
function ParallaxRig({
  calm,
  children,
}: {
  calm: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ pointer, clock }) => {
    const rig = group.current;
    if (!rig) return;
    const t = clock.elapsedTime;
    // the whole web SWIMS — a visible slow sway, never a locked camera
    const driftY = calm ? 0 : Math.sin(t * 0.14) * 0.11;
    const driftX = calm ? 0 : Math.cos(t * 0.1) * 0.05;
    rig.rotation.y += (pointer.x * 0.16 + driftY - rig.rotation.y) * 0.03;
    rig.rotation.x += (-pointer.y * 0.08 + driftX - rig.rotation.x) * 0.03;
    if (!calm) {
      rig.rotation.z = Math.sin(t * 0.07) * 0.012;
      const breathe = 1 + Math.sin(t * 0.24) * 0.012;
      rig.scale.setScalar(breathe);
    }
  });
  return <group ref={group}>{children}</group>;
}

/** Static tissue + junction glints (with a gentle shimmer). */
function PlexusField({ data, calm }: { data: MeshData; calm: boolean }) {
  const tissueMat = useRef<THREE.LineBasicMaterial>(null);
  const glintMat = useRef<THREE.PointsMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tissueMat.current)
      tissueMat.current.opacity =
        ramp(t, 0.1, 1.3, calm) * (calm ? 1 : 0.9 + Math.sin(t * 0.8) * 0.1);
    if (glintMat.current)
      glintMat.current.opacity =
        ramp(t, 0.5, 1.3, calm) * (calm ? 1 : 0.82 + Math.sin(t * 1.5) * 0.18);
  });

  return (
    <group>
      <lineSegments geometry={data.tissue}>
        <lineBasicMaterial
          ref={tissueMat}
          vertexColors
          transparent
          opacity={calm ? 1 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points geometry={data.glints}>
        <pointsMaterial
          ref={glintMat}
          vertexColors
          size={0.05}
          transparent
          opacity={calm ? 1 : 0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 1. TRAVELING PULSES — light beads riding every thread, staggered, endless.
// ---------------------------------------------------------------------------

const PULSES_PER_TRACK = 2;

function PulseFlow({ data, calm }: { data: MeshData; calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const { positions, colors, meta } = useMemo(() => {
    const n = data.tracks.length * PULSES_PER_TRACK;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const m: { track: PulseTrack; offset: number; speed: number }[] = [];
    const white = new THREE.Color(REFERENCE_PALETTE.white);
    data.tracks.forEach((track, ti) => {
      for (let s = 0; s < PULSES_PER_TRACK; s++) {
        const i = ti * PULSES_PER_TRACK + s;
        // heads run hot — tone lifted toward white so they read as light
        const hot = track.color.clone().lerp(white, 0.55);
        col.set([hot.r, hot.g, hot.b], i * 3);
        m.push({
          track,
          offset: hash01(1300 + ti, s),
          speed: (0.05 + hash01(1301 + ti, s) * 0.07) * (6 / track.total + 1),
        });
      }
    });
    return { positions: pos, colors: col, meta: m };
  }, [data]);

  useFrame(({ clock }) => {
    const cloud = points.current;
    if (!cloud) return;
    const t = clock.elapsedTime;
    const attr = cloud.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      const phase = calm ? m.offset : (m.offset + t * m.speed) % 1;
      sampleTrack(m.track, phase, scratch);
      attr.setXYZ(i, scratch.x, scratch.y, scratch.z);
    }
    attr.needsUpdate = true;
    (cloud.material as THREE.PointsMaterial).opacity =
      ramp(t, 1.2, 1.2, calm) * (calm ? 0.5 : 1);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.12}
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
// 2. SPARK SPRAY — a continuous outward spray of bright sparks, each with a
//    fading ribbon trail, curving gently as they fly. Respawn forever.
// ---------------------------------------------------------------------------

const SPARKS = 84;
const TRAIL = 10; // ribbon points per spark — long streamers, per the clips

interface SparkSim {
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly colorArr: Float32Array;
  readonly trail: Float32Array;
}

function makeSparkSim(): SparkSim {
  return {
    pos: new Float32Array(SPARKS * 3),
    vel: new Float32Array(SPARKS * 3),
    age: new Float32Array(SPARKS),
    life: new Float32Array(SPARKS),
    colorArr: new Float32Array(SPARKS * 3),
    trail: new Float32Array(SPARKS * TRAIL * 3),
  };
}

/** Module-level spark respawn — mutates only the ref-held sim state. */
function respawnSpark(
  sim: SparkSim,
  spawns: MeshData["spawns"],
  white: THREE.Color,
  i: number,
  seedShift: number,
) {
  const spawn = spawns[Math.floor(hash01(2000 + seedShift, i) * spawns.length)];
  const p = spawn.pos;
  sim.pos[i * 3] = p.x;
  sim.pos[i * 3 + 1] = p.y;
  sim.pos[i * 3 + 2] = p.z;
  // outward from the core, with lateral jitter — the reference's spray
  const dir = p.clone().sub(CORE);
  if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
  dir.normalize();
  dir.x += (hash01(2001 + seedShift, i) - 0.5) * 0.7;
  dir.y += (hash01(2002 + seedShift, i) - 0.5) * 0.7;
  dir.z += (hash01(2003 + seedShift, i) - 0.5) * 0.4;
  dir.normalize().multiplyScalar(1.8 + hash01(2004 + seedShift, i) * 2.4);
  sim.vel[i * 3] = dir.x;
  sim.vel[i * 3 + 1] = dir.y;
  sim.vel[i * 3 + 2] = dir.z;
  sim.age[i] = 0;
  sim.life[i] = 1.6 + hash01(2005 + seedShift, i) * 2.2;
  const hot = spawn.color.clone().lerp(white, 0.6);
  sim.colorArr[i * 3] = hot.r;
  sim.colorArr[i * 3 + 1] = hot.g;
  sim.colorArr[i * 3 + 2] = hot.b;
  // collapse the trail to the spawn point
  for (let k = 0; k < TRAIL; k++) {
    sim.trail[(i * TRAIL + k) * 3] = p.x;
    sim.trail[(i * TRAIL + k) * 3 + 1] = p.y;
    sim.trail[(i * TRAIL + k) * 3 + 2] = p.z;
  }
}

function SparkSpray({ data, calm }: { data: MeshData; calm: boolean }) {
  const heads = useRef<THREE.Points>(null);
  const trails = useRef<THREE.LineSegments>(null);
  const white = useMemo(() => new THREE.Color(REFERENCE_PALETTE.white), []);
  // Sim state lives in a ref (the sanctioned mutable escape hatch) and is
  // created + mutated ONLY inside the frame callback, never during render.
  const simRef = useRef<SparkSim | null>(null);

  useFrame(({ clock }, delta) => {
    if (!heads.current || !trails.current) return;
    const t = clock.elapsedTime;
    if (simRef.current === null) {
      const fresh = makeSparkSim();
      for (let i = 0; i < SPARKS; i++) {
        respawnSpark(fresh, data.spawns, white, i, 0);
        // pre-age so the field starts mid-spray, not synchronized
        fresh.age[i] = hash01(2010, i) * fresh.life[i];
      }
      simRef.current = fresh;
    }
    const sim = simRef.current;
    const respawn = (i: number, seedShift: number) =>
      respawnSpark(sim, data.spawns, white, i, seedShift);
    const dt = calm ? 0 : Math.min(delta, 0.05);
    for (let i = 0; i < SPARKS; i++) {
      if (!calm) {
        sim.age[i] += dt;
        if (sim.age[i] >= sim.life[i]) respawn(i, Math.floor(t));
        // gentle curvature: rotate velocity a touch around z
        const vx = sim.vel[i * 3];
        const vy = sim.vel[i * 3 + 1];
        const curve = 0.22 * dt * (hash01(2020, i) - 0.5) * 2;
        sim.vel[i * 3] = vx - vy * curve;
        sim.vel[i * 3 + 1] = vy + vx * curve;
        // integrate
        sim.pos[i * 3] += sim.vel[i * 3] * dt;
        sim.pos[i * 3 + 1] += sim.vel[i * 3 + 1] * dt;
        sim.pos[i * 3 + 2] += sim.vel[i * 3 + 2] * dt;
        // shift the trail ring (simple shift — TRAIL is tiny)
        for (let k = TRAIL - 1; k > 0; k--) {
          sim.trail[(i * TRAIL + k) * 3] = sim.trail[(i * TRAIL + k - 1) * 3];
          sim.trail[(i * TRAIL + k) * 3 + 1] =
            sim.trail[(i * TRAIL + k - 1) * 3 + 1];
          sim.trail[(i * TRAIL + k) * 3 + 2] =
            sim.trail[(i * TRAIL + k - 1) * 3 + 2];
        }
        sim.trail[i * TRAIL * 3] = sim.pos[i * 3];
        sim.trail[i * TRAIL * 3 + 1] = sim.pos[i * 3 + 1];
        sim.trail[i * TRAIL * 3 + 2] = sim.pos[i * 3 + 2];
      }
      // fade over life
      const fade = 1 - sim.age[i] / sim.life[i];
      // write head
      const headAttr = heads.current.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      headAttr.setXYZ(
        i,
        sim.pos[i * 3],
        sim.pos[i * 3 + 1],
        sim.pos[i * 3 + 2],
      );
      const headCol = heads.current.geometry.getAttribute(
        "color",
      ) as THREE.BufferAttribute;
      headCol.setXYZ(
        i,
        sim.colorArr[i * 3] * fade,
        sim.colorArr[i * 3 + 1] * fade,
        sim.colorArr[i * 3 + 2] * fade,
      );
      // write trail segments with fading luminance down the ribbon
      const tp = trails.current.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const tc = trails.current.geometry.getAttribute(
        "color",
      ) as THREE.BufferAttribute;
      for (let k = 0; k < TRAIL - 1; k++) {
        const v = (i * (TRAIL - 1) + k) * 2;
        const a = i * TRAIL + k;
        const b = a + 1;
        tp.setXYZ(
          v,
          sim.trail[a * 3],
          sim.trail[a * 3 + 1],
          sim.trail[a * 3 + 2],
        );
        tp.setXYZ(
          v + 1,
          sim.trail[b * 3],
          sim.trail[b * 3 + 1],
          sim.trail[b * 3 + 2],
        );
        const lumA = fade * (1 - k / TRAIL) * 0.9;
        const lumB = fade * (1 - (k + 1) / TRAIL) * 0.9;
        tc.setXYZ(
          v,
          sim.colorArr[i * 3] * lumA,
          sim.colorArr[i * 3 + 1] * lumA,
          sim.colorArr[i * 3 + 2] * lumA,
        );
        tc.setXYZ(
          v + 1,
          sim.colorArr[i * 3] * lumB,
          sim.colorArr[i * 3 + 1] * lumB,
          sim.colorArr[i * 3 + 2] * lumB,
        );
      }
    }
    (
      heads.current.geometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      heads.current.geometry.getAttribute("color") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      trails.current.geometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      trails.current.geometry.getAttribute("color") as THREE.BufferAttribute
    ).needsUpdate = true;
    const appear = ramp(t, 1.4, 1.2, calm) * (calm ? 0.4 : 1);
    (heads.current.material as THREE.PointsMaterial).opacity = appear;
    (trails.current.material as THREE.LineBasicMaterial).opacity =
      appear * 0.85;
  });

  const headPositions = useMemo(() => new Float32Array(SPARKS * 3), []);
  const headColors = useMemo(() => new Float32Array(SPARKS * 3), []);
  const trailPositions = useMemo(
    () => new Float32Array(SPARKS * (TRAIL - 1) * 2 * 3),
    [],
  );
  const trailColors = useMemo(
    () => new Float32Array(SPARKS * (TRAIL - 1) * 2 * 3),
    [],
  );

  return (
    <group>
      <points ref={heads}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[headPositions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[headColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.13}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <lineSegments ref={trails}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 3. CORE BREATHING — the heat behind the core swells and contracts; a REAL
//    pending proposal breathes harder and faster.
// ---------------------------------------------------------------------------

function CoreGlow({ calm, pending }: { calm: boolean; pending: boolean }) {
  const red = useRef<THREE.Sprite>(null);
  const hot = useRef<THREE.Sprite>(null);
  const textures = useMemo(
    () => ({
      red: makeGlowTexture("#ff4d4d"),
      white: makeGlowTexture("#fff2ec"),
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (calm) return;
    const t = clock.elapsedTime;
    const rate = pending ? 1.6 : 1.0;
    const amp = pending ? 0.2 : 0.11;
    const breathe = 1 + Math.sin(t * 1.1 * rate) * amp;
    if (red.current) {
      red.current.scale.setScalar(4.6 * breathe);
      (red.current.material as THREE.SpriteMaterial).opacity =
        (pending ? 0.2 : 0.16) * (0.85 + Math.sin(t * 1.1 * rate) * 0.15);
    }
    if (hot.current) {
      hot.current.scale.setScalar(
        2.2 * (1 + Math.sin(t * 1.1 * rate) * amp * 1.4),
      );
      (hot.current.material as THREE.SpriteMaterial).opacity =
        (pending ? 0.24 : 0.18) *
        (0.85 + Math.sin(t * 1.1 * rate + 0.6) * 0.15);
    }
  });

  return (
    <group position={[0, 1.1, -0.8]}>
      <sprite ref={red} scale={4.6}>
        <spriteMaterial
          map={textures.red}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={hot} scale={2.2}>
        <spriteMaterial
          map={textures.white}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

function makeGlowTexture(hex: string): THREE.Texture {
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
    gradient.addColorStop(0, `${hex}bb`);
    gradient.addColorStop(0.45, `${hex}33`);
    gradient.addColorStop(1, `${hex}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Long white rays escaping the burst, sparkle points riding them. */
function RadiantStreaks({ calm }: { calm: boolean }) {
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const sparkMat = useRef<THREE.PointsMaterial>(null);

  const { rays, sparks } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const sPos: number[] = [];
    const sCol: number[] = [];
    const white = new THREE.Color(REFERENCE_PALETTE.white);
    const COUNT = 26;
    for (let i = 0; i < COUNT; i++) {
      const angle = hash01(700, i) * Math.PI * 2;
      const tilt = (hash01(701, i) - 0.5) * 0.9;
      const dir = new THREE.Vector3(
        Math.cos(angle),
        Math.sin(angle) * 0.7,
        tilt,
      ).normalize();
      const src = CLUSTERS[Math.floor(hash01(702, i) * CLUSTERS.length)];
      const start = new THREE.Vector3(src.x, src.y, src.z).add(
        dir.clone().multiplyScalar(0.6),
      );
      const len = 4.5 + hash01(703, i) * 6.5;
      const elbow = start
        .clone()
        .add(dir.clone().multiplyScalar(len * 0.45))
        .add(
          new THREE.Vector3(
            (hash01(704, i) - 0.5) * 1.2,
            (hash01(705, i) - 0.5) * 1.0,
            0,
          ),
        );
      const end = start.clone().add(dir.clone().multiplyScalar(len));
      const lum = 0.28 + hash01(706, i) * 0.3;
      pushSegment(pos, col, start, elbow, white, lum, lum * 0.7);
      pushSegment(pos, col, elbow, end, white, lum * 0.7, 0.04);
      const beads = 2 + Math.floor(hash01(707, i) * 3);
      for (let b = 0; b < beads; b++) {
        const p = start.clone().lerp(end, 0.25 + hash01(708 + b, i) * 0.7);
        sPos.push(p.x, p.y, p.z);
        const gl = 0.7 + hash01(709 + b, i) * 0.3;
        sCol.push(white.r * gl, white.g * gl, white.b * gl);
      }
    }
    const rayGeometry = new THREE.BufferGeometry();
    rayGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pos, 3),
    );
    rayGeometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(sPos, 3),
    );
    sparkGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(sCol, 3),
    );
    return { rays: rayGeometry, sparks: sparkGeometry };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lineMat.current)
      lineMat.current.opacity =
        ramp(t, 0.9, 1.4, calm) * (calm ? 1 : 0.85 + Math.sin(t * 0.6) * 0.15);
    if (sparkMat.current)
      sparkMat.current.opacity =
        ramp(t, 1.2, 1.4, calm) * (calm ? 1 : 0.75 + Math.sin(t * 1.9) * 0.25);
  });

  return (
    <group>
      <lineSegments geometry={rays}>
        <lineBasicMaterial
          ref={lineMat}
          vertexColors
          transparent
          opacity={calm ? 1 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points geometry={sparks}>
        <pointsMaterial
          ref={sparkMat}
          vertexColors
          size={0.09}
          transparent
          opacity={calm ? 1 : 0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/** Faint dust behind everything. */
function DustField({ calm }: { calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const COUNT = 500;
  const positions = useMemo(() => {
    const out = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      out[i * 3] = (hash01(1, i) - 0.5) * 26;
      out[i * 3 + 1] = (hash01(2, i) - 0.5) * 14;
      out[i * 3 + 2] = (hash01(3, i) - 0.5) * 12;
    }
    return out;
  }, []);

  useFrame(({ clock }) => {
    if (calm || !points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.006;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8ea4c4"
        size={0.02}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
