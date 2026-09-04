"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

import {
  CAPSTONE_TOKEN_NAMES,
  capstonePalette,
  type CapstonePalette,
} from "@/lib/design-tokens/capstone";
import type { CoreState } from "@/lib/core";

// Program U.3 (E-030) — the Core's WebGL layer: an arc-reactor RING + inner
// ARC, drawn with react-three-fiber. Purely presentational: it receives a
// resolved CoreState and paints it. The truth layer is the DOM around it
// (data attributes + status line). No pointer events, no controls, no
// camera helpers. Reduced motion or no WebGL → a static SVG ring.

export interface CoreRingProps {
  readonly state: CoreState;
  readonly enabled?: boolean;
}

interface RingProfile {
  readonly color: keyof CapstonePalette;
  readonly ringOpacity: number;
  readonly arcOpacity: number;
  readonly glow: number;
  /** ms per breath/pulse cycle; 0 = still */
  readonly cycleMs: number;
  /** amplitude of the breath/pulse scale */
  readonly amplitude: number;
  /** radians per second of arc rotation */
  readonly spin: number;
}

// Brief §2: idle 4s breath; listening tighter ring; working slow rotation;
// waiting amber 1.2s pulse; blocked amber hold, no pulse; error red flare.
const RING_PROFILES: Readonly<Record<CoreState, RingProfile>> = {
  idle: {
    color: "accent",
    ringOpacity: 0.85,
    arcOpacity: 0.55,
    glow: 0.9,
    cycleMs: 4000,
    amplitude: 0.035,
    spin: 0.05,
  },
  listening: {
    color: "accent",
    ringOpacity: 1,
    arcOpacity: 0.8,
    glow: 1.2,
    cycleMs: 1600,
    amplitude: 0.02,
    spin: 0.12,
  },
  working: {
    color: "accent",
    ringOpacity: 0.9,
    arcOpacity: 0.7,
    glow: 1,
    cycleMs: 0,
    amplitude: 0,
    spin: 0.6,
  },
  waiting: {
    color: "gate",
    ringOpacity: 1,
    arcOpacity: 0.9,
    glow: 1.6,
    cycleMs: 1200,
    amplitude: 0.06,
    spin: 0.15,
  },
  blocked: {
    color: "gate",
    ringOpacity: 1,
    arcOpacity: 0.9,
    glow: 1.3,
    cycleMs: 0,
    amplitude: 0,
    spin: 0,
  },
  error: {
    color: "fail",
    ringOpacity: 0.95,
    arcOpacity: 0.6,
    glow: 1.4,
    cycleMs: 0,
    amplitude: 0,
    spin: 0,
  },
};

export function CoreRing({ state, enabled = true }: CoreRingProps) {
  const canvasEnabled = useCanvasEnabled(enabled);
  const palette = useLivePalette();
  const profile = RING_PROFILES[state];
  const color = palette[profile.color];

  return (
    <div
      aria-hidden="true"
      data-core-ring="threejs"
      data-core-ring-state={state}
      className="pointer-events-none absolute inset-0"
    >
      {canvasEnabled ? (
        <Canvas
          data-core-ring-canvas="threejs"
          className="pointer-events-none h-full w-full"
          camera={{ position: [0, 0, 5], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        >
          <RingScene profile={profile} color={color} />
        </Canvas>
      ) : (
        <StaticRing color={color} opacity={profile.ringOpacity} />
      )}
    </div>
  );
}

function RingScene({
  profile,
  color,
}: {
  profile: RingProfile;
  color: string;
}) {
  const group = useRef<Group>(null);
  const arc = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      const breath =
        profile.cycleMs > 0
          ? 1 +
            Math.sin((t * 1000 * Math.PI * 2) / profile.cycleMs) *
              profile.amplitude
          : 1;
      group.current.scale.setScalar(breath);
    }
    if (arc.current) {
      arc.current.rotation.z = t * profile.spin;
    }
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.2} />
      <pointLight color={color} intensity={profile.glow} position={[0, 0, 3]} />
      {/* the ring */}
      <mesh>
        <torusGeometry args={[1.5, 0.035, 24, 160]} />
        <meshBasicMaterial
          transparent
          color={color}
          opacity={profile.ringOpacity}
          depthWrite={false}
        />
      </mesh>
      {/* the inner arc — three quarters of a turn */}
      <group ref={arc}>
        <mesh>
          <torusGeometry args={[1.12, 0.06, 24, 160, Math.PI * 1.5]} />
          <meshBasicMaterial
            transparent
            color={color}
            opacity={profile.arcOpacity}
            depthWrite={false}
          />
        </mesh>
      </group>
      {/* the core glow disc */}
      <mesh>
        <circleGeometry args={[0.55, 64]} />
        <meshBasicMaterial
          transparent
          color={color}
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function StaticRing({ color, opacity }: { color: string; opacity: number }) {
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
        r="78"
        fill="none"
        stroke={color}
        strokeWidth="2"
        opacity={opacity}
      />
      <path
        d="M 100 40 A 60 60 0 1 1 40 100"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        opacity={opacity * 0.8}
      />
      <circle cx="100" cy="100" r="28" fill={color} opacity="0.12" />
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
  return Boolean(
    canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"),
  );
}

/** Re-reads the live CSS variables so a Day/Night switch reaches WebGL. */
function useLivePalette(): CapstonePalette {
  const [palette, setPalette] = useState<CapstonePalette>(capstonePalette);
  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    // Deferred to the next frame: read-after-paint, and never a synchronous
    // setState inside the effect body.
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
