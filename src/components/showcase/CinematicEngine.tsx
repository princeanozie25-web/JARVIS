"use client";

// THE CINEMATIC ENGINE — scene-agnostic showreel renderer (I-SHOW-4).
//
// Takes ANY SceneDescription and renders it as a living, depth-lit organism:
// the center node as a pulsing heart, ring nodes as glowing orbs, edges as
// curved threads with particles flowing along them, all over a drifting dust
// field with bloom. It knows NOTHING about scenes' meaning — Scene 1 (the
// operating map) and Scene 2 (the WorkflowBox mind-map) are just inputs.
//
// DISPLAY-ONLY (I-SHOW-1): renders props; no store, no fetch, no mutation,
// no runtime access, zero interactive affordances (no buttons, no handlers
// that change anything — pointer movement only steers the parallax camera).
//
// UNCHAINED by design: this surface is non-mutating, so the cockpit's audit
// constraints (SVG-only, motion vocabulary, flat amber) do not bind it. The
// DNA is inherited expressively: amber is still ONLY the Gate — here it may
// bloom and pulse. Colors mirror src/lib/design-tokens/tokens.css (WebGL
// materials cannot consume CSS custom properties, so the hex is restated
// with its token name — the lockstep is asserted in the showcase suite).

import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  layoutScene,
  positionIndex,
  type SceneDescription,
  type SceneEdge,
  type SceneNode,
  type ScenePosition,
  type SceneTone,
} from "@/lib/showcase/scene";

// Token mirror (names from tokens.css / the shell registers):
export const TONE_HEX: Record<SceneTone, string> = {
  gate: "#ffb24d", // --jarvis-shell-gate (amber — Gate ONLY)
  life: "#6ee7b7", // --jarvis-color-emerald-local
  signal: "#5fe6e0", // --jarvis-shell-signal (cyan, read-only evidence)
  accent: "#86bcff", // --jarvis-shell-accent (sky register)
  stone: "#8ea4c4", // --jarvis-shell-ink-dim
};
const GATE_DEEP = "#ff8a1f"; // --jarvis-shell-gate-deep
const SKY = "#38bdf8"; // --jarvis-color-sky-focus (the life range's far end)
const FIELD_BG = "#020617"; // --jarvis-color-panel (the void the field sits in)

export interface CinematicEngineProps {
  readonly scene: SceneDescription;
  /** Reduced-motion calm variant: the field still renders depth-lit, but
   * nothing travels — no pulse, no particle flow, no camera breathing. */
  readonly calm: boolean;
}

/** Deterministic [0,1) per (seed,i) — stable dust/particles, no Math.random. */
function hash01(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function CinematicEngine({ scene, calm }: CinematicEngineProps) {
  const positions = useMemo(() => layoutScene(scene), [scene]);
  const index = useMemo(() => positionIndex(positions), [positions]);

  return (
    <Canvas
      aria-hidden="true"
      data-showcase-canvas="cinematic-engine"
      camera={{ position: [0, 4.6, 11.5], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[FIELD_BG]} />
      <fog attach="fog" args={[FIELD_BG, 14, 30]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 6, 6]} intensity={0.6} color={SKY} />

      <ParallaxRig calm={calm}>
        <DustField calm={calm} />
        {scene.edges.map((edge) => {
          const from = index.get(edge.from);
          const to = index.get(edge.to);
          if (!from || !to) return null;
          return (
            <FlowEdge
              key={`${edge.from}->${edge.to}`}
              edge={edge}
              from={from}
              to={to}
              calm={calm}
            />
          );
        })}
        {scene.nodes.map((node) => {
          const at = index.get(node.id);
          if (!at) return null;
          return node.id === scene.centerNodeId ? (
            <GateHeart key={node.id} node={node} calm={calm} />
          ) : (
            <OrbNode key={node.id} node={node} at={at} calm={calm} />
          );
        })}
      </ParallaxRig>

      <EffectComposer>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.32}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.24} darkness={0.82} />
        <Noise opacity={0.028} />
      </EffectComposer>
    </Canvas>
  );
}

/** Pointer parallax + camera breathing. Pointer input only STEERS the view —
 * it changes nothing but the camera, which is the one interaction a
 * display-only surface may honestly offer. */
function ParallaxRig({
  calm,
  children,
}: {
  calm: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera, pointer, clock }) => {
    const rig = group.current;
    if (!rig) return;
    const targetY = pointer.x * 0.22;
    const targetX = -0.34 + pointer.y * 0.12;
    rig.rotation.y += (targetY - rig.rotation.y) * 0.04;
    rig.rotation.x += (targetX - rig.rotation.x) * 0.04;
    if (!calm) {
      const t = clock.elapsedTime;
      rig.rotation.y += Math.sin(t * 0.05) * 0.0008; // slow ambient drift
      camera.position.z = 11.5 + Math.sin(t * 0.24) * 0.32; // breathing
      camera.lookAt(0, 0, 0);
    }
  });
  return (
    <group ref={group} rotation={[-0.34, 0, 0]}>
      {children}
    </group>
  );
}

/** The center of gravity: the Gate as a pulsing amber heart inside two slow
 * gyroscope rings. Pending state (REAL proposal) drives the pulse. */
function GateHeart({ node, calm }: { node: SceneNode; calm: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const pending = node.state === "pending";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!calm && core.current) {
      const beat = pending ? 1 + Math.sin(t * 2.6) * 0.07 : 1;
      core.current.scale.setScalar(beat);
      const material = core.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = pending
        ? 1.7 + Math.sin(t * 2.6) * 0.8
        : 1.1;
    }
    if (!calm && ringA.current && ringB.current) {
      ringA.current.rotation.z = t * 0.21;
      ringA.current.rotation.x = 0.6 + Math.sin(t * 0.11) * 0.2;
      ringB.current.rotation.z = -t * 0.16;
      ringB.current.rotation.y = 0.8 + Math.cos(t * 0.09) * 0.2;
    }
  });

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.78, 2]} />
        <meshStandardMaterial
          color={GATE_DEEP}
          emissive={TONE_HEX.gate}
          emissiveIntensity={pending ? 1.9 : 1.1}
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>
      <mesh ref={ringA} rotation={[0.6, 0, 0]}>
        <torusGeometry args={[1.32, 0.022, 12, 96]} />
        <meshStandardMaterial
          color={TONE_HEX.gate}
          emissive={TONE_HEX.gate}
          emissiveIntensity={0.85}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={ringB} rotation={[1.4, 0.5, 0]}>
        <torusGeometry args={[1.68, 0.014, 12, 96]} />
        <meshStandardMaterial
          color={GATE_DEEP}
          emissive={GATE_DEEP}
          emissiveIntensity={0.6}
          transparent
          opacity={0.6}
        />
      </mesh>
      <pointLight
        color={TONE_HEX.gate}
        intensity={pending ? 2.6 : 1.4}
        distance={9}
      />
      <NodeLabel node={node} hero />
    </group>
  );
}

/** A ring node: emissive orb + soft halo + optional progress arc (the life
 * range) + its label in the app's real type registers. */
function OrbNode({
  node,
  at,
  calm,
}: {
  node: SceneNode;
  at: ScenePosition;
  calm: boolean;
}) {
  const halo = useRef<THREE.Sprite>(null);
  const radius = 0.16 + node.weight * 0.3;
  const color = TONE_HEX[node.tone];
  const lit = node.state === "active" || node.state === "pending";

  const haloTexture = useMemo(() => makeHaloTexture(color), [color]);

  useFrame(({ clock }) => {
    if (calm || !halo.current) return;
    const t = clock.elapsedTime + at.x * 2.1; // desynchronize the shimmer
    const s = 1 + Math.sin(t * 1.4) * (lit ? 0.12 : 0.05);
    halo.current.scale.setScalar(radius * 7 * s);
  });

  return (
    <group position={[at.x, at.y, at.z]}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={lit ? 1.5 : node.state === "empty" ? 0.35 : 0.8}
          roughness={0.35}
        />
      </mesh>
      <sprite ref={halo} scale={radius * 7}>
        <spriteMaterial
          map={haloTexture}
          transparent
          opacity={lit ? 0.55 : 0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {node.fill !== undefined && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry
            args={[
              radius + 0.14,
              0.02,
              8,
              48,
              Math.max(0.02, node.fill) * Math.PI * 2,
            ]}
          />
          <meshStandardMaterial
            color={TONE_HEX.life}
            emissive={TONE_HEX.life}
            emissiveIntensity={1.3}
          />
        </mesh>
      )}
      <NodeLabel node={node} />
    </group>
  );
}

/** DOM label riding the 3D node — the app's REAL fonts and registers
 * (Fraunces display, JetBrains Mono for the id chip). Pointer-transparent. */
function NodeLabel({
  node,
  hero = false,
}: {
  node: SceneNode;
  hero?: boolean;
}) {
  return (
    <Html
      center
      distanceFactor={hero ? 7 : 9}
      position={[0, hero ? -1.6 : -0.55, 0]}
      wrapperClass="showcase-label-wrap"
    >
      <div
        className={`showcase-label${hero ? " showcase-label-hero" : ""}`}
        data-showcase-node={node.id}
        data-showcase-state={node.state}
      >
        <span className="showcase-label-title">{node.label}</span>
        {node.sublabel !== undefined && (
          <span className="showcase-label-sub">{node.sublabel}</span>
        )}
      </div>
    </Html>
  );
}

/** An edge: a raised bezier thread + particles flowing along it. Flow
 * intensity comes from the scene (REAL state — e.g. a pending proposal
 * pushes the chat->gate thread to full flow). */
function FlowEdge({
  edge,
  from,
  to,
  calm,
}: {
  edge: SceneEdge;
  from: ScenePosition;
  to: ScenePosition;
  calm: boolean;
}) {
  const color = TONE_HEX[edge.tone];
  const { lineGeometry, curve } = useMemo(() => {
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const mid = a
      .clone()
      .add(b)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 0.35 + a.distanceTo(b) * 0.08, 0.25));
    const bezier = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      bezier.getPoints(40),
    );
    return { lineGeometry: geometry, curve: bezier };
  }, [from, to]);

  const particleCount = Math.max(1, Math.round(2 + edge.flow * 6));
  const points = useRef<THREE.Points>(null);
  const particlePositions = useMemo(
    () => new Float32Array(particleCount * 3),
    [particleCount],
  );

  useFrame(({ clock }) => {
    const cloud = points.current;
    if (!cloud) return;
    const t = calm ? 0.35 : clock.elapsedTime;
    const attr = cloud.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      const phase = calm
        ? (i + 0.5) / particleCount
        : (t * (0.12 + edge.flow * 0.22) + i / particleCount) % 1;
      const p = curve.getPoint(phase);
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  });

  return (
    <group>
      <line>
        <primitive object={lineGeometry} attach="geometry" />
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.16 + edge.flow * 0.2}
        />
      </line>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.09}
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** The ambient dust the organism floats in — deterministic, slow, deep. */
function DustField({ calm }: { calm: boolean }) {
  const points = useRef<THREE.Points>(null);
  const COUNT = 380;
  const positions = useMemo(() => {
    const out = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      out[i * 3] = (hash01(1, i) - 0.5) * 26;
      out[i * 3 + 1] = (hash01(2, i) - 0.5) * 14;
      out[i * 3 + 2] = (hash01(3, i) - 0.5) * 16;
    }
    return out;
  }, []);

  useFrame(({ clock }) => {
    if (calm || !points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.008;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={TONE_HEX.stone}
        size={0.035}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Radial-gradient halo sprite texture, built once per tone. */
function makeHaloTexture(hex: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, `${hex}cc`);
    gradient.addColorStop(0.4, `${hex}44`);
    gradient.addColorStop(1, `${hex}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
