"use client";

import { Sphere, Tube } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, type Mesh, Vector3 } from "three";

export interface ConnectionPulseProps {
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  color: string;
  index: number;
  reducedMotion: boolean;
}

export function ConnectionPulse({
  from,
  to,
  color,
  index,
  reducedMotion,
}: ConnectionPulseProps) {
  const pulseRef = useRef<Mesh>(null);
  const curve = useMemo(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.z += 2.2;
    mid.y += index % 2 === 0 ? 1.2 : -0.8;
    return new CatmullRomCurve3([start, mid, end]);
  }, [from, index, to]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    if (!pulseRef.current) return;
    const progress = (clock.elapsedTime * 0.08 + index * 0.13) % 1;
    pulseRef.current.position.copy(curve.getPointAt(progress));
  });

  return (
    <group data-gauntlet-connection-pulse="tube-geometry">
      <Tube args={[curve, 64, 0.025, 8, false]}>
        <meshBasicMaterial
          transparent
          color={color}
          opacity={0.34}
          depthWrite={false}
        />
      </Tube>
      <Sphere ref={pulseRef} args={[0.18, 18, 12]}>
        <meshBasicMaterial
          transparent
          color={color}
          opacity={0.88}
          depthWrite={false}
        />
      </Sphere>
    </group>
  );
}
