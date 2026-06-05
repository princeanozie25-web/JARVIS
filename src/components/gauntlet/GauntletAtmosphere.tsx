"use client";

import { Float, Sphere, Torus } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";

type GauntletStone =
  | "space"
  | "time"
  | "mind"
  | "soul"
  | "reality"
  | "power"
  | "human_gate";

type GauntletAtmosphereMode = "stable" | "focused" | "warning";

export interface GauntletAtmosphereProps {
  enabled?: boolean;
  presentationalMode?: GauntletAtmosphereMode;
  stones?: readonly GauntletStone[];
}

const DEFAULT_STONES: readonly GauntletStone[] = [
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
  "human_gate",
];

export function GauntletAtmosphere({
  enabled = true,
  presentationalMode = "stable",
  stones = DEFAULT_STONES,
}: GauntletAtmosphereProps) {
  const canvasEnabled = useAtmosphereCanvasEnabled(enabled);
  const mode = normalizeMode(presentationalMode);

  return (
    <div
      aria-hidden="true"
      data-gauntlet-atmosphere="threejs"
      data-gauntlet-atmosphere-mode={mode}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {canvasEnabled ? (
        <Canvas
          aria-hidden="true"
          data-gauntlet-atmosphere-canvas="threejs"
          className="pointer-events-none h-full w-full"
          camera={{ position: [0, 0, 8], fov: 46 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        >
          <GauntletAtmosphereScene mode={mode} stones={stones} />
        </Canvas>
      ) : (
        <div
          aria-hidden="true"
          data-gauntlet-atmosphere-fallback="reduced-motion-or-webgl-unavailable"
          className="hidden"
        />
      )}
    </div>
  );
}

function GauntletAtmosphereScene({
  mode,
  stones,
}: {
  mode: GauntletAtmosphereMode;
  stones: readonly GauntletStone[];
}) {
  const profile = GAUNTLET_ATMOSPHERE_PROFILE[mode];

  return (
    <group>
      <ambientLight intensity={0.18} />
      <pointLight
        color={profile.color}
        intensity={profile.light}
        position={[0, 0, 4]}
      />
      {stones.map((stone, index) => {
        const position = STONE_POSITIONS[stone];
        const color = STONE_COLORS[stone];

        return (
          <Float
            key={stone}
            speed={profile.floatSpeed + index * 0.04}
            rotationIntensity={0.35}
            floatIntensity={0.18}
          >
            <group position={[position[0], position[1], position[2]]}>
              <Sphere args={[stone === "human_gate" ? 0.28 : 0.2, 32, 20]}>
                <meshBasicMaterial
                  transparent
                  color={color}
                  opacity={stone === "human_gate" ? 0.3 : 0.18}
                  depthWrite={false}
                />
              </Sphere>
              <Torus
                args={[stone === "human_gate" ? 0.48 : 0.34, 0.008, 8, 48]}
                rotation={[Math.PI / 2, 0, index * 0.28]}
              >
                <meshBasicMaterial
                  transparent
                  color={color}
                  opacity={profile.ringOpacity}
                  depthWrite={false}
                />
              </Torus>
            </group>
          </Float>
        );
      })}
    </group>
  );
}

function normalizeMode(value: string): GauntletAtmosphereMode {
  return value === "focused" || value === "warning" ? value : "stable";
}

const GAUNTLET_ATMOSPHERE_PROFILE = {
  stable: {
    color: "#38bdf8",
    light: 0.56,
    floatSpeed: 0.45,
    ringOpacity: 0.22,
  },
  focused: {
    color: "#67e8f9",
    light: 0.75,
    floatSpeed: 0.7,
    ringOpacity: 0.32,
  },
  warning: {
    color: "#fbbf24",
    light: 0.72,
    floatSpeed: 0.62,
    ringOpacity: 0.36,
  },
} as const;

const STONE_COLORS: Readonly<Record<GauntletStone, string>> = {
  space: "#38bdf8",
  time: "#a78bfa",
  mind: "#818cf8",
  soul: "#34d399",
  reality: "#f472b6",
  power: "#fbbf24",
  human_gate: "#e0f2fe",
};

const STONE_POSITIONS: Readonly<
  Record<GauntletStone, readonly [number, number, number]>
> = {
  space: [-2.4, 1.35, -0.4],
  time: [-1.25, -1.25, -0.25],
  mind: [0, 1.5, -0.15],
  soul: [1.25, -1.25, -0.25],
  reality: [2.4, 1.35, -0.4],
  power: [0, -1.75, -0.2],
  human_gate: [0, 0, 0.2],
};

function useAtmosphereCanvasEnabled(enabled: boolean): boolean {
  const [canvasEnabled, setCanvasEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    const commit = (value: boolean) => {
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          setCanvasEnabled(value);
        }
      });
    };

    if (!enabled) {
      commit(false);
      return () => {
        cancelled = true;
      };
    }

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => {
      commit(!motionQuery?.matches && canUseWebGL());
    };

    update();
    motionQuery?.addEventListener?.("change", update);
    return () => {
      cancelled = true;
      motionQuery?.removeEventListener?.("change", update);
    };
  }, [enabled]);

  return canvasEnabled;
}

function canUseWebGL(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const canvas = document.createElement("canvas");
  return Boolean(
    canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"),
  );
}
