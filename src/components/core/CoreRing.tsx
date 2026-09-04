"use client";

import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  type Group,
  type Mesh,
} from "three";

import {
  CAPSTONE_TOKEN_NAMES,
  capstonePalette,
  type CapstonePalette,
} from "@/lib/design-tokens/capstone";
import type { CoreState } from "@/lib/core";

// Program U.3 / v3.2 amendment (E-032, fidelity pass E-033) — THE REACTOR.
// Built from the operator's reference image, layer by layer, outside → in:
//   1 housing     gunmetal torus, rectangular cutouts glowing cyan, twin neon rails
//   2 sectors     translucent plasma ring split by dark spokes, copper coil packs
//   3 gyro        copper ring + thin white ring, slightly tilted
//   4 turbine     24 slats, white at the hub → cyan at the tips, slow spin
//   5 heart       white-cyan disc with a soft halo
// All emissive layers feed a bloom pass; the group is tilted for depth.
// Purely presentational: it receives a resolved CoreState and paints it. The
// truth layer is the DOM around it. No pointer events, no controls, no
// camera helpers. Reduced motion or no WebGL → a static SVG reactor.

export interface CoreRingProps {
  readonly state: CoreState;
  readonly enabled?: boolean;
}

interface RingProfile {
  /** the electric colour of rails, plasma, turbine tips */
  readonly glow: keyof CapstonePalette;
  /** the heart / hub colour */
  readonly heart: keyof CapstonePalette;
  readonly intensity: number;
  readonly cycleMs: number;
  readonly amplitude: number;
  readonly spin: number;
  readonly bloom: number;
}

const RING_PROFILES: Readonly<Record<CoreState, RingProfile>> = {
  idle: {
    glow: "accent",
    heart: "core",
    intensity: 1.5,
    cycleMs: 4000,
    amplitude: 0.03,
    spin: 0.08,
    bloom: 1.5,
  },
  listening: {
    glow: "cyan",
    heart: "core",
    intensity: 2.0,
    cycleMs: 1600,
    amplitude: 0.02,
    spin: 0.16,
    bloom: 1.8,
  },
  working: {
    glow: "accent",
    heart: "core",
    intensity: 1.8,
    cycleMs: 0,
    amplitude: 0,
    spin: 0.7,
    bloom: 1.5,
  },
  waiting: {
    glow: "gate",
    heart: "gate",
    intensity: 2.4,
    cycleMs: 1200,
    amplitude: 0.07,
    spin: 0.2,
    bloom: 2.1,
  },
  blocked: {
    glow: "gate",
    heart: "gate",
    intensity: 1.9,
    cycleMs: 0,
    amplitude: 0,
    spin: 0,
    bloom: 1.6,
  },
  error: {
    glow: "fail",
    heart: "fail",
    intensity: 2.0,
    cycleMs: 0,
    amplitude: 0,
    spin: 0,
    bloom: 1.7,
  },
};

const CUTOUTS = 28;
const SPOKES = 10;
const COILS = 6;
const SLATS = 24;
/** base scale so the outer rail sits inside the Core box (the canvas is 1.9x the box) */
const BASE_SCALE = 0.74;

export function CoreRing({ state, enabled = true }: CoreRingProps) {
  const canvasEnabled = useCanvasEnabled(enabled);
  const palette = useLivePalette();
  const profile = RING_PROFILES[state];

  return (
    <div
      aria-hidden="true"
      data-core-ring="threejs"
      data-core-ring-state={state}
      className="pointer-events-none absolute inset-[-45%]"
    >
      {canvasEnabled ? (
        <Canvas
          data-core-ring-canvas="threejs"
          className="pointer-events-none h-full w-full"
          camera={{ position: [0, 0.6, 9.9], fov: 40 }}
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          {/* the composer renders opaque, so paint the live field colour behind
              the reactor; the canvas is oversized so the halo fades inside it */}
          <color attach="background" args={[palette.field]} />
          <ReactorScene profile={profile} palette={palette} />
          <EffectComposer>
            <Bloom
              intensity={profile.bloom}
              luminanceThreshold={0.38}
              luminanceSmoothing={0.35}
              radius={0.55}
              mipmapBlur
            />
          </EffectComposer>
        </Canvas>
      ) : (
        <StaticReactor
          glow={palette[profile.glow]}
          heart={palette[profile.heart]}
          copper={palette.copper}
        />
      )}
    </div>
  );
}

function angles(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2);
}

/** A soft radial-gradient alpha texture, generated in-browser (no assets). */
function useRadialTexture(stops: readonly [number, string][]): CanvasTexture {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new CanvasTexture(canvas);
  }, [stops]);
}

/** Blotchy plasma alpha, generated in-browser: many soft discs of random size. */
function usePlasmaTexture(seed: number): CanvasTexture {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, size, size);
    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    for (let i = 0; i < 90; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 14 + rand() * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.35 + rand() * 0.45})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = 1000; // RepeatWrapping
    return texture;
  }, [seed]);
}

const HALO_STOPS: readonly [number, string][] = [
  [0, "rgba(255,255,255,1)"],
  [0.35, "rgba(255,255,255,0.55)"],
  [1, "rgba(255,255,255,0)"],
];

function ReactorScene({
  profile,
  palette,
}: {
  profile: RingProfile;
  palette: CapstonePalette;
}) {
  const glow = palette[profile.glow];
  const heart = palette[profile.heart];
  const group = useRef<Group>(null);
  const turbine = useRef<Group>(null);
  const plasmaA = useRef<Mesh>(null);
  const plasmaB = useRef<Mesh>(null);
  const gyro = useRef<Group>(null);
  const heartMesh = useRef<Mesh>(null);
  const halo = useRadialTexture(HALO_STOPS);
  const plasma1 = usePlasmaTexture(7);
  const plasma2 = usePlasmaTexture(23);
  const cutouts = useMemo(() => angles(CUTOUTS), []);
  const spokes = useMemo(() => angles(SPOKES), []);
  const coils = useMemo(
    () => angles(COILS).map((a) => a + Math.PI / COILS),
    [],
  );
  const slats = useMemo(() => angles(SLATS), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breath =
      profile.cycleMs > 0
        ? 1 +
          Math.sin((t * 1000 * Math.PI * 2) / profile.cycleMs) *
            profile.amplitude
        : 1;
    if (group.current) group.current.scale.setScalar(BASE_SCALE * breath);
    if (turbine.current) turbine.current.rotation.z = t * profile.spin;
    if (plasmaA.current) plasmaA.current.rotation.z = t * 0.05;
    if (plasmaB.current) plasmaB.current.rotation.z = -t * 0.035;
    if (gyro.current) gyro.current.rotation.z = -t * profile.spin * 0.25;
    if (heartMesh.current)
      heartMesh.current.scale.setScalar(1 + (breath - 1) * 2.5);
  });

  return (
    // a slight top-down tilt gives the rings depth, like the reference
    <group ref={group} rotation={[-0.22, 0, 0]} scale={BASE_SCALE}>
      <ambientLight intensity={0.18} />
      <hemisphereLight
        color={palette.cyan}
        groundColor={palette.accent}
        intensity={0.8}
      />
      <pointLight
        color={heart}
        intensity={profile.intensity * 6}
        position={[0, 0, 1.2]}
        distance={7}
        decay={2}
      />
      <pointLight
        color={glow}
        intensity={profile.intensity * 3}
        position={[0, 0, 3]}
        distance={10}
        decay={2}
      />
      <directionalLight color="#ffffff" intensity={0.55} position={[3, 5, 4]} />
      <directionalLight
        color={palette.cyan}
        intensity={0.4}
        position={[-4, -2, 3]}
      />
      <spotLight
        color="#ffffff"
        intensity={2.2}
        position={[0, 6, 6]}
        angle={0.5}
        penumbra={0.8}
      />

      {/* 1 — housing: gunmetal torus + cyan cutouts + twin neon rails */}
      <group position={[0, 0, -0.1]}>
        <mesh>
          <torusGeometry args={[2.05, 0.27, 32, 220]} />
          <meshStandardMaterial
            color={palette.gunmetal}
            metalness={0.9}
            roughness={0.35}
          />
        </mesh>
        {cutouts.map((a, i) => (
          <mesh
            key={i}
            position={[Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0.27]}
            rotation={[0, 0, a]}
          >
            <boxGeometry args={[i % 2 === 0 ? 0.26 : 0.12, 0.07, 0.02]} />
            <meshStandardMaterial
              color={glow}
              emissive={glow}
              emissiveIntensity={profile.intensity * 1.4}
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, -0.12]}>
          <torusGeometry args={[2.36, 0.09, 24, 220]} />
          <meshStandardMaterial
            color={palette.gunmetal}
            metalness={0.95}
            roughness={0.3}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[2.3, 0.014, 12, 220]} />
          <meshStandardMaterial
            color={palette.cyan}
            emissive={palette.cyan}
            emissiveIntensity={profile.intensity * 1.2}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[1.82, 0.012, 12, 220]} />
          <meshStandardMaterial
            color={palette.cyan}
            emissive={palette.cyan}
            emissiveIntensity={profile.intensity * 1.2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* 2 — sectors: plasma between dark spokes, copper coil packs */}
      <group position={[0, 0, -0.05]}>
        <mesh position={[0, 0, -0.04]}>
          <ringGeometry args={[1.16, 1.8, 128]} />
          <meshStandardMaterial
            color={palette.gunmetal}
            metalness={0.7}
            roughness={0.5}
            side={DoubleSide}
          />
        </mesh>
        <mesh ref={plasmaA}>
          <ringGeometry args={[1.18, 1.78, 128]} />
          <meshBasicMaterial
            color={glow}
            alphaMap={plasma1}
            transparent
            opacity={1}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
        <mesh ref={plasmaB} position={[0, 0, 0.02]}>
          <ringGeometry args={[1.18, 1.78, 128]} />
          <meshBasicMaterial
            color={palette.cyan}
            alphaMap={plasma2}
            transparent
            opacity={0.75}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
        {spokes.map((a, i) => (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.48, Math.sin(a) * 1.48, 0.06]}
            rotation={[0, 0, a]}
          >
            <boxGeometry args={[0.62, 0.11, 0.1]} />
            <meshStandardMaterial
              color={palette.gunmetal}
              metalness={0.85}
              roughness={0.4}
            />
          </mesh>
        ))}
        {coils.map((a, i) => (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.48, Math.sin(a) * 1.48, 0.1]}
            rotation={[0, 0, a]}
          >
            <cylinderGeometry args={[0.09, 0.09, 0.42, 16]} />
            <meshStandardMaterial
              color={palette.copper}
              metalness={0.95}
              roughness={0.3}
              emissive={palette.copper}
              emissiveIntensity={0.35}
            />
          </mesh>
        ))}
      </group>

      {/* 3 — gyro: copper ring + thin white ring, tilted */}
      <group ref={gyro} position={[0, 0, 0.12]}>
        <mesh rotation={[0.18, 0.1, 0]}>
          <torusGeometry args={[1.12, 0.03, 16, 180]} />
          <meshStandardMaterial
            color={palette.copper}
            metalness={0.95}
            roughness={0.25}
            emissive={palette.copper}
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh rotation={[-0.12, 0.05, 0]}>
          <torusGeometry args={[1.02, 0.014, 12, 180]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={profile.intensity * 0.9}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* 4 — turbine: 24 slats, white hub → cyan tips */}
      <group ref={turbine} position={[0, 0, 0.22]}>
        {slats.map((a, i) => (
          <group key={i} rotation={[0, 0, a]}>
            <mesh position={[0.5, 0, 0]}>
              <boxGeometry args={[0.2, 0.075, 0.03]} />
              <meshStandardMaterial
                color={heart}
                emissive={heart}
                emissiveIntensity={profile.intensity * 1.6}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0.76, 0, 0]}>
              <boxGeometry args={[0.28, 0.06, 0.03]} />
              <meshStandardMaterial
                color={glow}
                emissive={glow}
                emissiveIntensity={profile.intensity * 1.3}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
        <mesh>
          <torusGeometry args={[0.92, 0.02, 12, 160]} />
          <meshStandardMaterial
            color={glow}
            emissive={glow}
            emissiveIntensity={profile.intensity}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* 5 — heart: halo + disc + hot centre */}
      <group position={[0, 0, 0.3]}>
        <mesh>
          <circleGeometry args={[0.95, 64]} />
          <meshBasicMaterial
            color={glow}
            alphaMap={halo}
            transparent
            opacity={0.55}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={heartMesh}>
          <circleGeometry args={[0.27, 64]} />
          <meshBasicMaterial
            color={heart}
            alphaMap={halo}
            transparent
            opacity={0.85}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[0.25, 0.01, 12, 120]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={profile.intensity * 1.4}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <circleGeometry args={[0.09, 48]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={1}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function StaticReactor({
  glow,
  heart,
  copper,
}: {
  glow: string;
  heart: string;
  copper: string;
}) {
  const slats = Array.from({ length: SLATS }, (_, i) => (i / SLATS) * 360);
  const cut = Array.from({ length: CUTOUTS }, (_, i) => (i / CUTOUTS) * 360);
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full"
      data-core-ring-fallback="reduced-motion-or-webgl-unavailable"
      role="presentation"
    >
      <circle
        cx="100"
        cy="100"
        r="94"
        fill="none"
        stroke={glow}
        strokeWidth="1"
        opacity="0.9"
      />
      <circle
        cx="100"
        cy="100"
        r="86"
        fill="none"
        stroke="#1b2230"
        strokeWidth="9"
      />
      {cut.map((deg) => (
        <rect
          key={deg}
          x="94"
          y="12"
          width="12"
          height="4"
          rx="1"
          fill={glow}
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      <circle
        cx="100"
        cy="100"
        r="76"
        fill="none"
        stroke={glow}
        strokeWidth="1"
        opacity="0.9"
      />
      <circle
        cx="100"
        cy="100"
        r="62"
        fill="none"
        stroke={glow}
        strokeWidth="22"
        opacity="0.28"
      />
      <circle
        cx="100"
        cy="100"
        r="47"
        fill="none"
        stroke={copper}
        strokeWidth="2"
      />
      <circle
        cx="100"
        cy="100"
        r="43"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
      />
      {slats.map((deg) => (
        <rect
          key={deg}
          x="118"
          y="98"
          width="20"
          height="3.5"
          rx="1"
          fill={heart}
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="16" fill={heart} opacity="0.95" />
      <circle cx="100" cy="100" r="6" fill="#ffffff" />
    </svg>
  );
}

function useCanvasEnabled(enabled: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setOn(!motion?.matches && canUseWebGL());
    update();
    motion?.addEventListener?.("change", update);
    return () => motion?.removeEventListener?.("change", update);
  }, [enabled]);
  return on;
}

function canUseWebGL(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

/** Re-reads the live CSS variables so a Day/Night switch reaches WebGL.
 *  P3 `color()` values cannot be parsed by three.js; when a token resolves
 *  to one we keep the sRGB mirror. */
function useLivePalette(): CapstonePalette {
  const [palette, setPalette] = useState<CapstonePalette>(capstonePalette);
  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const style = getComputedStyle(document.documentElement);
      const next: Record<keyof CapstonePalette, string> = {
        ...capstonePalette,
      };
      for (const key of Object.keys(
        CAPSTONE_TOKEN_NAMES,
      ) as (keyof CapstonePalette)[]) {
        const value = style.getPropertyValue(CAPSTONE_TOKEN_NAMES[key]).trim();
        if (/^#[0-9a-f]{6}$/i.test(value)) next[key] = value;
        else if (/^#[0-9a-f]{3}$/i.test(value))
          next[key] = value.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
      }
      setPalette(next);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return useMemo(() => palette, [palette]);
}
