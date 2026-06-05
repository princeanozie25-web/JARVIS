"use client";

import { Float, Sphere, Torus } from "@react-three/drei";

import { StoneMaterial } from "./stone-material";

export function MindZoneMesh() {
  return (
    <Float speed={0.36} rotationIntensity={0.24} floatIntensity={0.14}>
      <group data-gauntlet-canvas-zone="mind" position={[16, 12, -3]}>
        <pointLight color="#c084fc" intensity={3.4} distance={24} />
        <mesh rotation={[0.2, 0.4, 0.8]}>
          <octahedronGeometry args={[2.1, 3]} />
          <StoneMaterial color="#c084fc" opacity={0.82} />
        </mesh>
        <Torus args={[5.1, 0.035, 12, 112]} rotation={[Math.PI / 2, 0, 0.3]}>
          <meshBasicMaterial
            transparent
            color="#d8b4fe"
            opacity={0.26}
            depthWrite={false}
          />
        </Torus>
        {Array.from({ length: 6 }).map((_, index) => {
          const angle = (index / 6) * Math.PI * 2;
          return (
            <Sphere
              key={index}
              args={[0.3, 16, 10]}
              position={[Math.cos(angle) * 4.9, Math.sin(angle) * 2.6, 0.28]}
            >
              <meshBasicMaterial color="#f0abfc" />
            </Sphere>
          );
        })}
      </group>
    </Float>
  );
}
