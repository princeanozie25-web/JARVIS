"use client";

import { Float, Torus } from "@react-three/drei";

import { StoneMaterial } from "./stone-material";

export function PowerZoneMesh() {
  return (
    <Float speed={0.28} rotationIntensity={0.18} floatIntensity={0.1}>
      <group data-gauntlet-canvas-zone="power" position={[8, -14, -4]}>
        <pointLight color="#f43f5e" intensity={3.5} distance={24} />
        <mesh rotation={[0.18, 0.74, 0.32]}>
          <octahedronGeometry args={[2.35, 3]} />
          <StoneMaterial color="#f43f5e" opacity={0.86} />
        </mesh>
        {[3.4, 4.35].map((radius, index) => (
          <Torus
            key={radius}
            args={[radius, 0.04, 10, 96]}
            rotation={[Math.PI / 2, index * 0.42, index * 0.25]}
          >
            <meshBasicMaterial
              transparent
              color={index === 0 ? "#f43f5e" : "#a855f7"}
              opacity={0.26}
              depthWrite={false}
            />
          </Torus>
        ))}
      </group>
    </Float>
  );
}
