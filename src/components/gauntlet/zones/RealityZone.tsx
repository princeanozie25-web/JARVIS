"use client";

import { Float, Sphere, Torus } from "@react-three/drei";

import { StoneMaterial } from "./stone-material";

export function RealityZoneMesh() {
  return (
    <Float speed={0.34} rotationIntensity={0.22} floatIntensity={0.14}>
      <group data-gauntlet-canvas-zone="reality" position={[18, -8, -3]}>
        <pointLight color="#22d3ee" intensity={3.4} distance={24} />
        <mesh rotation={[0.5, 0.15, 0.75]}>
          <octahedronGeometry args={[2.25, 3]} />
          <StoneMaterial color="#22d3ee" opacity={0.82} />
        </mesh>
        <Torus args={[4.2, 0.03, 10, 96]} rotation={[Math.PI / 2.4, 0, -0.5]}>
          <meshBasicMaterial
            transparent
            color="#67e8f9"
            opacity={0.22}
            depthWrite={false}
          />
        </Torus>
        {Array.from({ length: 6 }).map((_, index) => {
          const angle = (index / 6) * Math.PI * 2;
          return (
            <Sphere
              key={index}
              args={[0.25, 14, 8]}
              position={[Math.cos(angle) * 4.4, Math.sin(angle) * 2.2, 0.28]}
            >
              <meshBasicMaterial color="#a5f3fc" />
            </Sphere>
          );
        })}
      </group>
    </Float>
  );
}
