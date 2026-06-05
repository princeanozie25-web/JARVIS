"use client";

export interface StoneMaterialProps {
  color: string;
  opacity?: number;
  emissiveIntensity?: number;
}

export function StoneMaterial({
  color,
  opacity = 0.72,
  emissiveIntensity = 0.42,
}: StoneMaterialProps) {
  return (
    <meshPhysicalMaterial
      color={color}
      emissive={color}
      emissiveIntensity={emissiveIntensity}
      transmission={0.9}
      roughness={0.08}
      metalness={0.1}
      ior={2.4}
      thickness={0.6}
      envMapIntensity={3}
      toneMapped={false}
      transparent
      opacity={opacity}
    />
  );
}
