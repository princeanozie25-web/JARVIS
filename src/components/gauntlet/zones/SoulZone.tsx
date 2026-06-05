"use client";

import { Float, Sphere } from "@react-three/drei";

import { StoneMaterial } from "./stone-material";

export function SoulZoneMesh() {
  return (
    <Float speed={0.3} rotationIntensity={0.16} floatIntensity={0.12}>
      <group data-gauntlet-canvas-zone="soul" position={[-8, -13, -2]}>
        <pointLight color="#fb923c" intensity={3.4} distance={24} />
        <mesh rotation={[0.3, 0.15, -0.18]}>
          <dodecahedronGeometry args={[2.25, 2]} />
          <StoneMaterial color="#fb923c" opacity={0.84} />
        </mesh>
        {Array.from({ length: 18 }).map((_, index) => {
          const angle = index * 0.72;
          const radius = 2.8 + index * 0.1;
          return (
            <Sphere
              key={index}
              args={[0.08, 8, 6]}
              position={[Math.cos(angle) * radius, Math.sin(angle) * 1.5, 0.4]}
            >
              <meshBasicMaterial
                transparent
                color="#fed7aa"
                opacity={0.5}
                depthWrite={false}
              />
            </Sphere>
          );
        })}
      </group>
    </Float>
  );
}
