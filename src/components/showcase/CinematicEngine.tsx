"use client";

// THE PLEXUS ENGINE — the exact background of the reference frame: a
// multi-color neural burst on black. Eight fixed regional clusters (each a
// triangulated tissue cloud in ITS reference hue), inter-cluster bridges,
// long white radiating streaks with sparkle points, fine glints, deep dust.
// The DOM overlay (ShowcaseShell) carries every label — this canvas renders
// no text.
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

/** Bridges between visually adjacent regions (as in the reference, the
 * tissue is continuous — clusters melt into one another). */
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

export interface CinematicEngineProps {
  /** Reduced-motion calm variant: fully assembled, still. */
  readonly calm: boolean;
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

export function CinematicEngine({ calm }: CinematicEngineProps) {
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

      <ParallaxRig calm={calm}>
        <CoreGlow />
        <PlexusField calm={calm} />
        <RadiantStreaks calm={calm} />
        <DustField calm={calm} />
      </ParallaxRig>

      <EffectComposer>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.24}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.18} darkness={0.9} />
        <Noise opacity={0.03} />
      </EffectComposer>
    </Canvas>
  );
}

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
    rig.rotation.y += (pointer.x * 0.16 - rig.rotation.y) * 0.04;
    rig.rotation.x += (-pointer.y * 0.08 - rig.rotation.x) * 0.04;
    if (!calm) {
      rig.rotation.y += Math.sin(clock.elapsedTime * 0.04) * 0.0006;
    }
  });
  return <group ref={group}>{children}</group>;
}

/** The burst: per-cluster triangulated tissue + junction glints + white
 * connective filaments between adjacent clusters. One geometry per system. */
function PlexusField({ calm }: { calm: boolean }) {
  const tissueMat = useRef<THREE.LineBasicMaterial>(null);
  const glintMat = useRef<THREE.PointsMaterial>(null);

  const { tissue, glints } = useMemo(() => {
    const tPos: number[] = [];
    const tCol: number[] = [];
    const gPos: number[] = [];
    const gCol: number[] = [];
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
        // triangulate: nearest-3 neighbor links
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
      });
    });

    // inter-cluster tissue: white-blended threads junction-to-junction
    BRIDGES.forEach(([a, b], e) => {
      const ja = clusterClouds[a];
      const jb = clusterClouds[b];
      const colorA = new THREE.Color(REFERENCE_PALETTE[CLUSTERS[a].id]);
      const colorB = new THREE.Color(REFERENCE_PALETTE[CLUSTERS[b].id]);
      for (let s = 0; s < 7; s++) {
        const p = ja[Math.floor(hash01(500 + e, s) * ja.length)];
        const q = jb[Math.floor(hash01(501 + e, s) * jb.length)];
        const mixed = colorA.clone().lerp(colorB, 0.5).lerp(white, 0.3);
        const lum = 0.2 + hash01(502 + e, s) * 0.22;
        pushSegment(tPos, tCol, p, q, mixed, lum, lum);
      }
    });

    const tissueGeometry = new THREE.BufferGeometry();
    tissueGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(tPos, 3),
    );
    tissueGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(tCol, 3),
    );
    const glintGeometry = new THREE.BufferGeometry();
    glintGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gPos, 3),
    );
    glintGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(gCol, 3),
    );
    return { tissue: tissueGeometry, glints: glintGeometry };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tissueMat.current)
      tissueMat.current.opacity =
        ramp(t, 0.1, 1.3, calm) * (calm ? 1 : 0.9 + Math.sin(t * 0.8) * 0.1);
    if (glintMat.current)
      glintMat.current.opacity =
        ramp(t, 0.5, 1.3, calm) * (calm ? 1 : 0.85 + Math.sin(t * 1.5) * 0.15);
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
      <points geometry={glints}>
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

/** Long white rays escaping the burst toward the frame corners, sparkle
 * points riding them — the reference's signature streaks. */
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
      // a slight elbow makes the rays organic, like the reference
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
      // sparkle points along the ray
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
        ramp(t, 1.2, 1.4, calm) * (calm ? 1 : 0.8 + Math.sin(t * 1.9) * 0.2);
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

/** The hot red-white wash behind the core — the reference's center heat. */
function CoreGlow() {
  const textures = useMemo(
    () => ({
      red: makeGlowTexture("#ff4d4d"),
      white: makeGlowTexture("#fff2ec"),
    }),
    [],
  );
  return (
    <group position={[0, 1.1, -0.8]}>
      <sprite scale={4.6}>
        <spriteMaterial
          map={textures.red}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite scale={2.2}>
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
