"use client";

import { Float, Sphere, Torus } from "@react-three/drei";

import { StoneMaterial } from "./stone-material";

export function TimeZoneMesh() {
  return (
    <Float speed={0.38} rotationIntensity={0.18} floatIntensity={0.16}>
      <group data-gauntlet-canvas-zone="time" position={[-6, 14, -2]}>
        <pointLight color="#4ade80" intensity={3.2} distance={24} />
        <mesh>
          <icosahedronGeometry args={[1.7, 3]} />
          <StoneMaterial color="#4ade80" opacity={0.78} />
        </mesh>
        {[3.2, 4.5, 5.7].map((radius, index) => (
          <Torus
            key={radius}
            args={[radius, 0.035, 12, 96]}
            rotation={[Math.PI / 2.2, 0.1 * index, index * 0.35]}
          >
            <meshBasicMaterial
              transparent
              color="#86efac"
              opacity={0.22}
              depthWrite={false}
            />
          </Torus>
        ))}
        {Array.from({ length: 8 }).map((_, index) => {
          const angle = (index / 8) * Math.PI * 2;
          return (
            <Sphere
              key={index}
              args={[0.28, 16, 10]}
              position={[Math.cos(angle) * 4.7, Math.sin(angle) * 2.4, 0.35]}
            >
              <meshBasicMaterial color="#bbf7d0" />
            </Sphere>
          );
        })}
      </group>
    </Float>
  );
}
