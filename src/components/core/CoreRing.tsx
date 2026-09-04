"use client";

import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, type Group, type Mesh } from "three";

import {
  CAPSTONE_TOKEN_NAMES,
  capstonePalette,
  type CapstonePalette,
} from "@/lib/design-tokens/capstone";
import type { CoreState } from "@/lib/core";

// Program U.3 / v3.2 amendment (E-032) — THE REACTOR. The Core's WebGL
// layer is an arc reactor: an outer housing ring, a ring of segmented
// blades, an inner bright ring, and a cyan-white heart, all emissive with
// bloom. Purely presentational: it receives a resolved CoreState and paints
// it. The truth layer is the DOM around it (data attributes + status line).
// No pointer events, no controls, no camera helpers. Reduced motion or no
// WebGL → a static SVG reactor, never blank.

export interface CoreRingProps {
  readonly state: CoreState;
  readonly enabled?: boolean;
}

interface RingProfile {
  readonly color: keyof CapstonePalette;
  readonly heart: keyof CapstonePalette;
  readonly intensity: number;
  /** ms per breath/pulse cycle; 0 = still */
  readonly cycleMs: number;
  readonly amplitude: number;
  /** radians per second of blade rotation */
  readonly spin: number;
  readonly bloom: number;
}

// Brief §2 + v3.2: idle 4 s breath; listening tighter/brighter; working slow
// rotation; waiting amber 1.2 s pulse; blocked amber hold; error red hold.
const RING_PROFILES: Readonly<Record<CoreState, RingProfile>> = {
  idle: {
    color: "accent",
    heart: "core",
    intensity: 1.6,
    cycleMs: 4000,
    amplitude: 0.04,
    spin: 0.06,
    bloom: 1.4,
  },
  listening: {
    color: "accent",
    heart: "core",
    intensity: 2.2,
    cycleMs: 1600,
    amplitude: 0.025,
    spin: 0.14,
    bloom: 1.8,
  },
  working: {
    color: "accent",
    heart: "core",
    intensity: 1.9,
    cycleMs: 0,
    amplitude: 0,
    spin: 0.7,
    bloom: 1.5,
  },
  waiting: {
    color: "gate",
    heart: "gate",
    intensity: 2.6,
    cycleMs: 1200,
    amplitude: 0.08,
    spin: 0.18,
    bloom: 2.2,
  },
  blocked: {
    color: "gate",
    heart: "gate",
    intensity: 2.0,
    cycleMs: 0,
    amplitude: 0,
    spin: 0,
    bloom: 1.6,
  },
  error: {
    color: "fail",
    heart: "fail",
    intensity: 2.2,
    cycleMs: 0,
    amplitude: 0,
    spin: 0,
    bloom: 1.8,
  },
};

const BLADES = 18;

export function CoreRing({ state, enabled = true }: CoreRingProps) {
  const canvasEnabled = useCanvasEnabled(enabled);
  const palette = useLivePalette();
  const profile = RING_PROFILES[state];
  const color = palette[profile.color];
  const heart = palette[profile.heart];

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
          camera={{ position: [0, 0, 9.9], fov: 40 }}
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          {/* the composer renders opaque, so paint the field colour behind the
              reactor (true black at night, the canvas colour by day); the canvas
              is oversized so the bloom halo fades inside it */}
          <color attach="background" args={[palette.field]} />
          <ReactorScene profile={profile} color={color} heart={heart} />
          <EffectComposer>
            <Bloom
              intensity={profile.bloom}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.6}
              mipmapBlur
            />
          </EffectComposer>
        </Canvas>
      ) : (
        <StaticReactor color={color} heart={heart} />
      )}
    </div>
  );
}

function ReactorScene({
  profile,
  color,
  heart,
}: {
  profile: RingProfile;
  color: string;
  heart: string;
}) {
  const group = useRef<Group>(null);
  const blades = useRef<Group>(null);
  const counter = useRef<Group>(null);
  const heartMesh = useRef<Mesh>(null);
  const bladeAngles = useMemo(
    () => Array.from({ length: BLADES }, (_, i) => (i / BLADES) * Math.PI * 2),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breath =
      profile.cycleMs > 0
        ? 1 +
          Math.sin((t * 1000 * Math.PI * 2) / profile.cycleMs) *
            profile.amplitude
        : 1;
    if (group.current) group.current.scale.setScalar(breath);
    if (blades.current) blades.current.rotation.z = t * profile.spin;
    if (counter.current) counter.current.rotation.z = -t * profile.spin * 0.6;
    if (heartMesh.current)
      heartMesh.current.scale.setScalar(1 + (breath - 1) * 2);
  });

  return (
    <group ref={group}>
      {/* outer housing — two thin rings with a dark gap */}
      <mesh>
        <torusGeometry args={[1.86, 0.025, 16, 200]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[1.72, 0.05, 16, 200]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={profile.intensity * 0.5}
          depthWrite={false}
        />
      </mesh>

      {/* segmented blade ring (rotates) */}
      <group ref={blades}>
        {bladeAngles.map((angle, i) => (
          <mesh
            key={i}
            rotation={[0, 0, angle]}
            position={[Math.cos(angle) * 1.32, Math.sin(angle) * 1.32, 0]}
          >
            <boxGeometry args={[0.34, 0.085, 0.06]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={profile.intensity}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* counter-rotating inner tick ring */}
      <group ref={counter}>
        {bladeAngles.map((angle, i) => (
          <mesh
            key={i}
            rotation={[0, 0, angle]}
            position={[Math.cos(angle) * 0.98, Math.sin(angle) * 0.98, 0]}
          >
            <boxGeometry args={[0.12, 0.05, 0.04]} />
            <meshStandardMaterial
              color={heart}
              emissive={heart}
              emissiveIntensity={profile.intensity * 0.9}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* inner bright ring */}
      <mesh>
        <torusGeometry args={[0.8, 0.04, 16, 160]} />
        <meshStandardMaterial
          color={heart}
          emissive={heart}
          emissiveIntensity={profile.intensity * 1.2}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* the heart: additive glow disc + hot centre */}
      <mesh>
        <circleGeometry args={[0.62, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={heartMesh}>
        <circleGeometry args={[0.3, 64]} />
        <meshBasicMaterial
          color={heart}
          transparent
          opacity={0.95}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <circleGeometry args={[0.12, 48]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <ambientLight intensity={0.15} />
      <pointLight
        color={color}
        intensity={profile.intensity * 2}
        position={[0, 0, 2.5]}
        distance={8}
      />
    </group>
  );
}

function StaticReactor({ color, heart }: { color: string; heart: string }) {
  const blades = Array.from({ length: BLADES }, (_, i) => (i / BLADES) * 360);
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
        r="92"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.55"
      />
      <circle
        cx="100"
        cy="100"
        r="85"
        fill="none"
        stroke={color}
        strokeWidth="3"
        opacity="0.8"
      />
      {blades.map((deg) => (
        <rect
          key={deg}
          x="57"
          y="97"
          width="17"
          height="5"
          rx="1"
          fill={color}
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      <circle
        cx="100"
        cy="100"
        r="40"
        fill="none"
        stroke={heart}
        strokeWidth="2.5"
      />
      <circle cx="100" cy="100" r="30" fill={color} opacity="0.35" />
      <circle cx="100" cy="100" r="15" fill={heart} opacity="0.95" />
      <circle cx="100" cy="100" r="6" fill="#ffffff" opacity="0.9" />
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
 *  to one we keep the sRGB mirror (three renders in sRGB anyway — the P3
 *  lift applies to the DOM around the reactor). */
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
