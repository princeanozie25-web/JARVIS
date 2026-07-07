"use client";

// THE PLEXUS ENGINE — the reference frame's background, ALIVE, rendered as a
// VOLUMETRIC FIBER FIELD.
//
// PRIMITIVE (the fiber pass): connections are NOT line segments. Every
// connective stroke is a fine CURVED RIBBON-FIBER — a bezier curve extruded
// into a thin camera-facing strip, textured with a gaussian cross-section
// (soft, feathered edges) and tapered ends, additive-blended at low
// per-fiber brightness. ~1,200 fibers overlap into a continuous luminous
// substance: dendrite wisps inside each region, axon BUNDLES that pinch
// mid-flight and fan at both ends between regions, and feeder fibers that
// splay from every region and converge on the core. No straight
// point-to-point geometry anywhere in the connective field.
//
// MOTION (kept from the motion pass): traveling pulses ride the SAME fiber
// curves (arc-length parameterized), the spark spray keeps streaming with
// ribbon trails, the core heat breathes (harder while a REAL proposal is
// pending), and the whole web sways in a living idle.
//
// DISPLAY-ONLY (I-SHOW-1): renders props; no store, no fetch, no mutation,
// no runtime access, zero interactive affordances (pointer movement only
// steers the parallax camera). Reduced-motion renders the fully assembled
// field, still (calm).

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

/** Bundles between visually adjacent regions. */
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

// Fiber population (the density IS the look).
const CLUSTER_FIBERS = 110; // dendrite wisps per region
const BUNDLE_FIBERS = 16; // axons per inter-region bundle
const FEEDER_FIBERS = 12; // fibers each region sends to the core
const STREAK_FIBERS = 30; // long white escaping streamers
const FIBER_STEPS = 22; // samples along each fiber

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

// ---------------------------------------------------------------------------
// THE FIBER PRIMITIVE — a curved ribbon strip with soft gaussian edges.
// Each fiber: a bezier curve sampled into FIBER_STEPS points, extruded into a
// thin two-vertex strip facing the (near-fixed) camera, width tapering at the
// ends and wavering slightly along the run. All fibers merge into ONE
// geometry + ONE soft-brush texture = one draw call.
// ---------------------------------------------------------------------------

interface FiberAccumulator {
  positions: number[];
  colors: number[];
  uvs: number[];
  indices: number[];
  vertCount: number;
}

const VIEW = new THREE.Vector3(0, 0, 1); // camera direction approximation

function pushFiber(
  acc: FiberAccumulator,
  curve: THREE.Curve<THREE.Vector3>,
  color: THREE.Color,
  brightness: number,
  width: number,
  seed: number,
) {
  const pts = curve.getPoints(FIBER_STEPS);
  const base = acc.vertCount;
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const t01 = i / (pts.length - 1);
    // tangent from neighbors
    if (i === 0) tangent.subVectors(pts[1], pts[0]);
    else if (i === pts.length - 1) tangent.subVectors(pts[i], pts[i - 1]);
    else tangent.subVectors(pts[i + 1], pts[i - 1]);
    side.crossVectors(tangent, VIEW).normalize();
    if (side.lengthSq() < 0.5) side.set(0, 1, 0);
    // taper both ends + gentle width waver along the run
    const taper = Math.sin(Math.PI * t01) ** 0.65;
    const waver = 0.75 + 0.5 * hash01(seed, i);
    const w = (width * taper * waver) / 2;
    acc.positions.push(
      pts[i].x - side.x * w,
      pts[i].y - side.y * w,
      pts[i].z - side.z * w,
      pts[i].x + side.x * w,
      pts[i].y + side.y * w,
      pts[i].z + side.z * w,
    );
    const r = color.r * brightness;
    const g = color.g * brightness;
    const b = color.b * brightness;
    acc.colors.push(r, g, b, r, g, b);
    acc.uvs.push(t01, 0, t01, 1);
    if (i > 0) {
      const a = base + (i - 1) * 2;
      acc.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  acc.vertCount += pts.length * 2;
}

/** Round soft-bloom point sprite — every particle in the field is a round
 * glow, never a hard square vertex (the wireframe tell). */
function makePointTexture(): THREE.Texture {
  const size = 64;
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
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.35, "#ffffff88");
    gradient.addColorStop(1, "#ffffff00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** The soft brush: gaussian across the ribbon, faded tips along it. */
function makeFiberTexture(): THREE.Texture {
  const w = 128;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const across = (y + 0.5) / h - 0.5;
      const gauss = Math.exp(-((across / 0.21) ** 2));
      for (let x = 0; x < w; x++) {
        const along = (x + 0.5) / w;
        const tip = Math.min(1, Math.min(along, 1 - along) / 0.12);
        const v = Math.round(255 * gauss * tip);
        const idx = (y * w + x) * 4;
        img.data[idx] = v;
        img.data[idx + 1] = v;
        img.data[idx + 2] = v;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Random unit-ish offset vector, flattened toward the view plane. */
function jitterVec(seed: number, i: number, scale: number): THREE.Vector3 {
  return new THREE.Vector3(
    (hash01(seed, i) - 0.5) * scale,
    (hash01(seed + 1, i) - 0.5) * scale * 0.85,
    (hash01(seed + 2, i) - 0.5) * scale * 0.6,
  );
}

/** All fiber geometry + pulse tracks + spark spawn points, built once. */
function useMeshData() {
  return useMemo(() => {
    const acc: FiberAccumulator = {
      positions: [],
      colors: [],
      uvs: [],
      indices: [],
      vertCount: 0,
    };
    const gPos: number[] = [];
    const gCol: number[] = [];
    const tracks: PulseTrack[] = [];
    const spawns: { pos: THREE.Vector3; color: THREE.Color }[] = [];
    const clusterClouds: THREE.Vector3[][] = [];
    const white = new THREE.Color(REFERENCE_PALETTE.white);

    // junction glints + spawn points (the sparkle nodes ON the fibers)
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
        const gl = 0.5 + hash01(seed + 3, i) * 0.5;
        gCol.push(color.r * gl, color.g * gl, color.b * gl);
        if (hash01(seed + 9, i) < 0.3) spawns.push({ pos: j, color });
      });
    });

    // 1. DENDRITE WISPS — fine curved fibers filling each region: arcs from
    // junction to junction THROUGH an organic control point, never straight.
    CLUSTERS.forEach((cluster, c) => {
      const color = new THREE.Color(REFERENCE_PALETTE[cluster.id]);
      const js = clusterClouds[c];
      const center = new THREE.Vector3(cluster.x, cluster.y, cluster.z);
      const seed = 3000 + c * 101;
      for (let f = 0; f < CLUSTER_FIBERS; f++) {
        const a = js[Math.floor(hash01(seed, f) * js.length)];
        const b = js[Math.floor(hash01(seed + 1, f) * js.length)];
        if (a === b) continue;
        // 40% of wisps are DIRECTIONAL strokes (inner -> outer, dendrite
        // flow); the rest arc junction-to-junction around the center.
        const directional = hash01(seed + 10, f) < 0.4;
        const from = directional
          ? a.clone().lerp(center, 0.75 + hash01(seed + 11, f) * 0.2)
          : a;
        const mid = from
          .clone()
          .add(b)
          .multiplyScalar(0.5)
          .lerp(center, (hash01(seed + 2, f) - 0.5) * (directional ? 0.3 : 0.8))
          .add(
            jitterVec(seed + 3, f, cluster.reach * (directional ? 0.55 : 0.9)),
          );
        const curve = new THREE.QuadraticBezierCurve3(from, mid, b);
        pushFiber(
          acc,
          curve,
          color,
          0.1 + hash01(seed + 6, f) * 0.12,
          0.02 + hash01(seed + 7, f) * 0.03,
          seed + 8 + f,
        );
        if (hash01(seed + 9, f) < 0.12)
          tracks.push(makeTrack(curve.getPoints(FIBER_STEPS), color));
      }
    });

    // 2. AXON BUNDLES — fibers between regions that FAN at both ends and
    // PINCH mid-flight (a shared cubic spine, per-fiber lateral spread that
    // shrinks toward the middle).
    BRIDGES.forEach(([ai, bi], e) => {
      const A = CLUSTERS[ai];
      const B = CLUSTERS[bi];
      const ja = clusterClouds[ai];
      const jb = clusterClouds[bi];
      const colorA = new THREE.Color(REFERENCE_PALETTE[A.id]);
      const colorB = new THREE.Color(REFERENCE_PALETTE[B.id]);
      const seed = 5000 + e * 211;
      const spineBend = jitterVec(seed, 0, 2.6);
      for (let f = 0; f < BUNDLE_FIBERS; f++) {
        const start = ja[Math.floor(hash01(seed + 1, f) * ja.length)];
        const end = jb[Math.floor(hash01(seed + 2, f) * jb.length)];
        // lateral spread: full at the ends (fan), pinched at the middle
        const lat = jitterVec(seed + 3, f, 1.0);
        const c1 = start
          .clone()
          .lerp(end, 0.33)
          .add(spineBend)
          .add(lat.clone().multiplyScalar(0.35));
        const c2 = start
          .clone()
          .lerp(end, 0.66)
          .add(spineBend)
          .add(lat.clone().multiplyScalar(0.35));
        const color = colorA.clone().lerp(colorB, 0.5).lerp(white, 0.28);
        const curve = new THREE.CubicBezierCurve3(start, c1, c2, end);
        pushFiber(
          acc,
          curve,
          color,
          0.09 + hash01(seed + 4, f) * 0.1,
          0.022 + hash01(seed + 5, f) * 0.03,
          seed + 6 + f,
        );
        if (hash01(seed + 7, f) < 0.45)
          tracks.push(makeTrack(curve.getPoints(FIBER_STEPS), color));
      }
    });

    // 3. FEEDER FIBERS — every region splays fibers that arc home and
    // converge on the core (brightening arrival is the pulses' job).
    CLUSTERS.forEach((cluster, c) => {
      if (cluster.id === "core") return;
      const color = new THREE.Color(REFERENCE_PALETTE[cluster.id]);
      const js = clusterClouds[c];
      const seed = 7000 + c * 131;
      for (let f = 0; f < FEEDER_FIBERS; f++) {
        const start = js[Math.floor(hash01(seed, f) * js.length)];
        const c1 = start
          .clone()
          .lerp(CORE, 0.35)
          .add(jitterVec(seed + 1, f, 2.2));
        const c2 = start
          .clone()
          .lerp(CORE, 0.72)
          .add(jitterVec(seed + 2, f, 1.1));
        const curve = new THREE.CubicBezierCurve3(start, c1, c2, CORE);
        pushFiber(
          acc,
          curve,
          color,
          0.08 + hash01(seed + 3, f) * 0.09,
          0.02 + hash01(seed + 4, f) * 0.024,
          seed + 5 + f,
        );
        if (hash01(seed + 6, f) < 0.5)
          tracks.push(makeTrack(curve.getPoints(FIBER_STEPS), color));
      }
    });

    // 4. ESCAPING STREAMERS — long white fibers CURLING away from the mass.
    // The curl is mandatory: control points swing hard PERPENDICULAR to the
    // launch direction (alternating sides), so no streamer ever reads as a
    // straight ray; the tip also hooks like the reference's streamers.
    for (let f = 0; f < STREAK_FIBERS; f++) {
      const seed = 9000;
      const src = CLUSTERS[Math.floor(hash01(seed, f) * CLUSTERS.length)];
      const angle = hash01(seed + 1, f) * Math.PI * 2;
      const dir = new THREE.Vector3(
        Math.cos(angle),
        Math.sin(angle) * 0.7,
        (hash01(seed + 2, f) - 0.5) * 0.5,
      ).normalize();
      const perp = new THREE.Vector3(-dir.y, dir.x, 0)
        .normalize()
        .multiplyScalar(hash01(seed + 9, f) < 0.5 ? 1 : -1);
      const start = new THREE.Vector3(src.x, src.y, src.z).add(
        dir.clone().multiplyScalar(0.5),
      );
      const len = 4.5 + hash01(seed + 3, f) * 6.0;
      const sweep = 1.4 + hash01(seed + 10, f) * 2.2;
      const c1 = start
        .clone()
        .add(dir.clone().multiplyScalar(len * 0.35))
        .add(perp.clone().multiplyScalar(sweep * 0.7))
        .add(jitterVec(seed + 4, f, 0.8));
      const c2 = start
        .clone()
        .add(dir.clone().multiplyScalar(len * 0.75))
        .add(perp.clone().multiplyScalar(sweep * 1.6))
        .add(jitterVec(seed + 5, f, 1.0));
      const end = start
        .clone()
        .add(dir.clone().multiplyScalar(len))
        .add(perp.clone().multiplyScalar(sweep * 0.9));
      const curve = new THREE.CubicBezierCurve3(start, c1, c2, end);
      pushFiber(
        acc,
        curve,
        white,
        0.11 + hash01(seed + 6, f) * 0.13,
        0.03 + hash01(seed + 7, f) * 0.034,
        seed + 8 + f,
      );
    }

    const fiberGeometry = new THREE.BufferGeometry();
    fiberGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(acc.positions, 3),
    );
    fiberGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(acc.colors, 3),
    );
    fiberGeometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(acc.uvs, 2),
    );
    fiberGeometry.setIndex(acc.indices);

    const glintGeometry = new THREE.BufferGeometry();
    glintGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gPos, 3),
    );
    glintGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(gCol, 3),
    );

    return { fiberGeometry, glintGeometry, tracks, spawns };
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
            intensity={1.05}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.35}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.18} darkness={0.9} />
        </EffectComposer>
      ) : (
        <EffectComposer>
          <Bloom
            intensity={1.05}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.35}
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
      <FiberField data={data} calm={calm} />
      <PulseFlow data={data} calm={calm} />
      <SparkSpray data={data} calm={calm} />
      <DustField calm={calm} />
    </ParallaxRig>
  );
}

/** Pointer parallax + the living idle: the whole web SWIMS. */
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

/** The fiber substance + junction glints, breathing gently. */
function FiberField({ data, calm }: { data: MeshData; calm: boolean }) {
  const fiberMat = useRef<THREE.MeshBasicMaterial>(null);
  const glintMat = useRef<THREE.PointsMaterial>(null);
  const brush = useMemo(() => makeFiberTexture(), []);
  const dot = useMemo(() => makePointTexture(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (fiberMat.current)
      fiberMat.current.opacity =
        ramp(t, 0.1, 1.4, calm) *
        (calm ? 0.9 : 0.88 + Math.sin(t * 0.8) * 0.12);
    if (glintMat.current)
      glintMat.current.opacity =
        ramp(t, 0.5, 1.4, calm) *
        (calm ? 0.8 : 0.78 + Math.sin(t * 1.5) * 0.22);
  });

  return (
    <group>
      <mesh geometry={data.fiberGeometry}>
        <meshBasicMaterial
          ref={fiberMat}
          map={brush}
          vertexColors
          transparent
          opacity={calm ? 0.9 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <points geometry={data.glintGeometry}>
        <pointsMaterial
          ref={glintMat}
          map={dot}
          vertexColors
          size={0.07}
          transparent
          opacity={calm ? 0.8 : 0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// TRAVELING PULSES — light beads riding the CURVED fibers, staggered, endless.
// ---------------------------------------------------------------------------

const PULSES_PER_TRACK = 2;

function PulseFlow({ data, calm }: { data: MeshData; calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const dot = useMemo(() => makePointTexture(), []);
  const { positions, colors, meta } = useMemo(() => {
    const n = data.tracks.length * PULSES_PER_TRACK;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const m: { track: PulseTrack; offset: number; speed: number }[] = [];
    const white = new THREE.Color(REFERENCE_PALETTE.white);
    data.tracks.forEach((track, ti) => {
      for (let s = 0; s < PULSES_PER_TRACK; s++) {
        const i = ti * PULSES_PER_TRACK + s;
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
        map={dot}
        vertexColors
        size={0.14}
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
// SPARK SPRAY — continuous outward sparks; each trails a chain of soft round
// motes that shrink down the tail (a comet, never a hard line).
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
  for (let k = 0; k < TRAIL; k++) {
    sim.trail[(i * TRAIL + k) * 3] = p.x;
    sim.trail[(i * TRAIL + k) * 3 + 1] = p.y;
    sim.trail[(i * TRAIL + k) * 3 + 2] = p.z;
  }
}

function SparkSpray({ data, calm }: { data: MeshData; calm: boolean }) {
  const heads = useRef<THREE.Points>(null);
  const trails = useRef<THREE.Points>(null);
  const white = useMemo(() => new THREE.Color(REFERENCE_PALETTE.white), []);
  const dot = useMemo(() => makePointTexture(), []);
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
        const vx = sim.vel[i * 3];
        const vy = sim.vel[i * 3 + 1];
        const curve = 0.22 * dt * (hash01(2020, i) - 0.5) * 2;
        sim.vel[i * 3] = vx - vy * curve;
        sim.vel[i * 3 + 1] = vy + vx * curve;
        sim.pos[i * 3] += sim.vel[i * 3] * dt;
        sim.pos[i * 3 + 1] += sim.vel[i * 3 + 1] * dt;
        sim.pos[i * 3 + 2] += sim.vel[i * 3 + 2] * dt;
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
      const fade = 1 - sim.age[i] / sim.life[i];
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
      const tp = trails.current.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const tc = trails.current.geometry.getAttribute(
        "color",
      ) as THREE.BufferAttribute;
      for (let k = 0; k < TRAIL; k++) {
        const a = i * TRAIL + k;
        tp.setXYZ(
          a,
          sim.trail[a * 3],
          sim.trail[a * 3 + 1],
          sim.trail[a * 3 + 2],
        );
        const lum = fade * (1 - k / TRAIL) * 0.85;
        tc.setXYZ(
          a,
          sim.colorArr[i * 3] * lum,
          sim.colorArr[i * 3 + 1] * lum,
          sim.colorArr[i * 3 + 2] * lum,
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
    (trails.current.material as THREE.PointsMaterial).opacity = appear * 0.85;
  });

  const headPositions = useMemo(() => new Float32Array(SPARKS * 3), []);
  const headColors = useMemo(() => new Float32Array(SPARKS * 3), []);
  const trailPositions = useMemo(
    () => new Float32Array(SPARKS * TRAIL * 3),
    [],
  );
  const trailColors = useMemo(() => new Float32Array(SPARKS * TRAIL * 3), []);

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
          map={dot}
          vertexColors
          size={0.15}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <points ref={trails}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={dot}
          vertexColors
          size={0.1}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// CORE BREATHING — the heat behind the core swells and contracts; a REAL
// pending proposal breathes harder and faster.
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

/** Faint dust behind everything. */
function DustField({ calm }: { calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const dot = useMemo(() => makePointTexture(), []);
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
        map={dot}
        color="#8ea4c4"
        size={0.03}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
