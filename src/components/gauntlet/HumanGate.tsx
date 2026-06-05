"use client";

import { Float, Torus } from "@react-three/drei";

import { StoneMaterial } from "./zones/stone-material";

export function HumanGateMesh() {
  return (
    <Float speed={0.3} rotationIntensity={0.1} floatIntensity={0.08}>
      <group data-gauntlet-canvas-zone="human_gate" position={[0, 0, 0]}>
        <pointLight color="#fbbf24" intensity={7.5} distance={42} />
        <mesh rotation={[0.28, 0.36, 0.12]}>
          <icosahedronGeometry args={[2.65, 4]} />
          <StoneMaterial
            color="#fbbf24"
            opacity={0.9}
            emissiveIntensity={0.8}
          />
        </mesh>
        {[4.1, 5.7, 7.2].map((radius, index) => (
          <Torus
            key={radius}
            args={[radius, 0.035, 12, 128]}
            rotation={[Math.PI / 2, index * 0.18, index * 0.36]}
          >
            <meshBasicMaterial
              transparent
              color="#fde68a"
              opacity={0.26 - index * 0.04}
              depthWrite={false}
            />
          </Torus>
        ))}
      </group>
    </Float>
  );
}
