// SHOWCASE ENGINE CONTRACT — scene-agnostic by design (I-SHOW-4).
//
// The cinematic engine renders ANY SceneDescription: a graph of nodes on
// concentric rings around one center, edges with particle flow, plus honest
// provenance. Scene 1 (the operating map) and Scene 2 (the WorkflowBox
// mind-map, next) are both just objects of this shape — the engine never
// imports a scene builder, and a scene builder never imports the engine.
//
// DISPLAY-ONLY (I-SHOW-1): this module is pure types + pure geometry. It has
// no store access, no mutation path, no runtime access — a scene is a value.

/** Visual tone — resolves to the design-language DNA (amber = Gate ONLY). */
export type SceneTone =
  | "gate" // amber — Gate-touching only
  | "life" // emerald->sky — progress / alive
  | "signal" // cyan — read-only live evidence
  | "accent" // sky — interactive/selected registers
  | "stone"; // neutral ink — structure

export type SceneNodeState = "pending" | "active" | "calm" | "done" | "empty";

export interface SceneNode {
  readonly id: string;
  readonly label: string;
  /** Mono register chip under the label (ids, counts, states). */
  readonly sublabel?: string;
  readonly tone: SceneTone;
  readonly state: SceneNodeState;
  /** Visual mass 0..1 (node size). */
  readonly weight: number;
  /** Optional 0..1 progress fill (renders in the life range). */
  readonly fill?: number;
  /** Orbital ring index; 0 is the center (exactly one node lives there). */
  readonly ring: number;
  /** Optional fixed azimuth (radians). Unset nodes are spread evenly. */
  readonly angle?: number;
}

export interface SceneEdge {
  readonly from: string;
  readonly to: string;
  readonly tone: SceneTone;
  /** Particle-flow intensity 0..1 (0 renders a still structural line). */
  readonly flow: number;
}

export interface SceneProvenance {
  /** True only when every rendered value came from a live projection read. */
  readonly live: boolean;
  /** The honest badge text — "live governed state" or a labelled sample. */
  readonly label: string;
  /** Per-source detail lines for the badge (mono register). */
  readonly sources: readonly string[];
}

export interface SceneChip {
  readonly label: string;
  readonly value: string;
}

export interface SceneDescription {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly centerNodeId: string;
  readonly nodes: readonly SceneNode[];
  readonly edges: readonly SceneEdge[];
  readonly provenance: SceneProvenance;
  readonly chips: readonly SceneChip[];
}

// --- pure layout ------------------------------------------------------------
// Deterministic polar layout: ring index -> radius; nodes without a fixed
// angle are spread evenly around their ring, offset per ring so spokes don't
// align. Small deterministic z-depth per node gives the parallax field its
// depth without randomness (stable across renders — no Math.random).

export interface ScenePosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const RING_RADIUS_STEP = 2.6;

/** Vertical squish of the orbital ellipse — shared with the renderer so ring
 * inference from a position never drifts from the layout that produced it. */
export const ELLIPSE_Y = 0.56;

/** Deterministic hash -> [0,1) for stable per-node depth jitter. */
function unitHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function layoutScene(scene: SceneDescription): readonly ScenePosition[] {
  const byRing = new Map<number, SceneNode[]>();
  for (const node of scene.nodes) {
    if (node.id === scene.centerNodeId) continue;
    const ring = Math.max(1, node.ring);
    const bucket = byRing.get(ring) ?? [];
    bucket.push(node);
    byRing.set(ring, bucket);
  }

  const positions: ScenePosition[] = [
    { id: scene.centerNodeId, x: 0, y: 0, z: 0 },
  ];
  for (const [ring, nodes] of byRing) {
    const radius = ring * RING_RADIUS_STEP;
    const ringOffset = (ring * Math.PI) / 5;
    const free = nodes.filter((n) => n.angle === undefined);
    let freeIndex = 0;
    for (const node of nodes) {
      const angle =
        node.angle !== undefined
          ? node.angle
          : ringOffset + (2 * Math.PI * freeIndex++) / Math.max(1, free.length);
      positions.push({
        id: node.id,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * ELLIPSE_Y, // gentle ellipse — cinematic tilt; flat enough that bottom-ring labels clear the chip strip
        z: (unitHash(node.id) - 0.5) * 1.8,
      });
    }
  }
  return positions;
}

/** Lookup helper the renderer and the DOM fallback share. */
export function positionIndex(
  positions: readonly ScenePosition[],
): ReadonlyMap<string, ScenePosition> {
  return new Map(positions.map((p) => [p.id, p]));
}
