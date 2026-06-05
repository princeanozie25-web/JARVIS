"use client";

import { Float, Sphere, Torus } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";

import type { OrbActivityState } from "./activity-states";

type OrbAtmosphereState =
  | OrbActivityState
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "approval_needed"
  | "alert";

export interface OrbReactorAtmosphereProps {
  enabled?: boolean;
  presentationalState?: OrbAtmosphereState | string;
}

export function OrbReactorAtmosphere({
  enabled = true,
  presentationalState = "idle",
}: OrbReactorAtmosphereProps) {
  const canvasEnabled = useAtmosphereCanvasEnabled(enabled);
  const state = normalizeAtmosphereState(presentationalState);

  return (
    <div
      aria-hidden="true"
      data-orb-atmosphere="threejs"
      data-orb-atmosphere-state={state}
      className="pointer-events-none absolute inset-[-10%] z-0 overflow-hidden rounded-full"
    >
      {canvasEnabled ? (
        <Canvas
          aria-hidden="true"
          data-orb-atmosphere-canvas="threejs"
          className="pointer-events-none h-full w-full"
          camera={{ position: [0, 0, 6], fov: 42 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        >
          <OrbAtmosphereScene state={state} />
        </Canvas>
      ) : (
        <div
          aria-hidden="true"
          data-orb-atmosphere-fallback="reduced-motion-or-webgl-unavailable"
          className="hidden"
        />
      )}
    </div>
  );
}

function OrbAtmosphereScene({ state }: { state: OrbAtmosphereState }) {
  const profile = ORB_ATMOSPHERE_PROFILE[state] ?? ORB_ATMOSPHERE_PROFILE.idle;

  return (
    <group scale={profile.scale}>
      <ambientLight intensity={0.24} />
      <pointLight
        color={profile.color}
        intensity={profile.light}
        position={[0, 0, 3]}
      />
      <Float
        speed={profile.floatSpeed}
        rotationIntensity={0.45}
        floatIntensity={0.25}
      >
        <Sphere args={[0.82, 48, 32]}>
          <meshBasicMaterial
            transparent
            color={profile.color}
            opacity={profile.coreOpacity}
            depthWrite={false}
          />
        </Sphere>
      </Float>
      <Float
        speed={profile.floatSpeed * 0.8}
        rotationIntensity={1.4}
        floatIntensity={0.12}
      >
        <Torus args={[1.24, 0.018, 16, 96]} rotation={[Math.PI / 2.8, 0.18, 0]}>
          <meshBasicMaterial
            transparent
            color={profile.ringColor}
            opacity={profile.ringOpacity}
            depthWrite={false}
          />
        </Torus>
      </Float>
      <Float
        speed={profile.floatSpeed * 1.3}
        rotationIntensity={1.8}
        floatIntensity={0.08}
      >
        <Torus
          args={[1.62, 0.01, 12, 96]}
          rotation={[Math.PI / 2.1, -0.22, 0.42]}
        >
          <meshBasicMaterial
            transparent
            color={profile.ringColor}
            opacity={profile.outerOpacity}
            depthWrite={false}
          />
        </Torus>
      </Float>
    </group>
  );
}

const ORB_STATES = new Set<OrbAtmosphereState>([
  "idle",
  "listening",
  "processing",
  "speaking",
  "systems_healthy",
  "approval_needed",
  "alert",
]);

function normalizeAtmosphereState(value: string): OrbAtmosphereState {
  return ORB_STATES.has(value as OrbAtmosphereState)
    ? (value as OrbAtmosphereState)
    : "idle";
}

const ORB_ATMOSPHERE_PROFILE = {
  idle: {
    color: "#38bdf8",
    ringColor: "#7dd3fc",
    scale: 1,
    light: 0.62,
    floatSpeed: 0.55,
    coreOpacity: 0.16,
    ringOpacity: 0.28,
    outerOpacity: 0.16,
  },
  listening: {
    color: "#67e8f9",
    ringColor: "#a5f3fc",
    scale: 1.04,
    light: 0.82,
    floatSpeed: 0.9,
    coreOpacity: 0.2,
    ringOpacity: 0.34,
    outerOpacity: 0.2,
  },
  processing: {
    color: "#0ea5e9",
    ringColor: "#67e8f9",
    scale: 1.08,
    light: 0.96,
    floatSpeed: 1.25,
    coreOpacity: 0.22,
    ringOpacity: 0.42,
    outerOpacity: 0.28,
  },
  speaking: {
    color: "#7dd3fc",
    ringColor: "#bae6fd",
    scale: 1.06,
    light: 0.9,
    floatSpeed: 1.05,
    coreOpacity: 0.24,
    ringOpacity: 0.38,
    outerOpacity: 0.24,
  },
  systems_healthy: {
    color: "#34d399",
    ringColor: "#99f6e4",
    scale: 1.02,
    light: 0.7,
    floatSpeed: 0.7,
    coreOpacity: 0.18,
    ringOpacity: 0.3,
    outerOpacity: 0.18,
  },
  approval_needed: {
    color: "#fbbf24",
    ringColor: "#fde68a",
    scale: 1.04,
    light: 0.84,
    floatSpeed: 0.92,
    coreOpacity: 0.2,
    ringOpacity: 0.4,
    outerOpacity: 0.24,
  },
  alert: {
    color: "#f87171",
    ringColor: "#fecaca",
    scale: 1.1,
    light: 1,
    floatSpeed: 1.4,
    coreOpacity: 0.25,
    ringOpacity: 0.46,
    outerOpacity: 0.3,
  },
} as const;

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
