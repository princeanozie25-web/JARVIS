// MCP gateway — the exposed READ surface registry.
//
// This slice (24B-1) exposes EXACTLY ONE resource: the pipeline view-model
// (EXPOSED-READONLY, static topology — exposure matrix + ID-4). Everything else
// is NEVER-EXPOSED by default (ID-0). Queue-status is 24B-2 and is NOT here.
//
// Imports ONLY a read projection (pipeline-visualization) + the local
// sanitizer. No mutator, no DB, no executor — GATE-2 holds.

import { buildPipelineViewModel } from "@/lib/pipeline-visualization";
import { sanitizeReadPayload } from "./sanitizer";

export const PIPELINE_VIEW_MODEL_URI = "jarvis://pipeline/view-model" as const;
export const PIPELINE_VIEW_MODEL_NAME = "pipeline-view-model" as const;

export interface ExposedResourceDescriptor {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: "application/json";
}

/** The complete EXPOSED-READONLY set for 24B-1. Exactly one entry. */
export const EXPOSED_RESOURCES: readonly ExposedResourceDescriptor[] = [
  {
    uri: PIPELINE_VIEW_MODEL_URI,
    name: PIPELINE_VIEW_MODEL_NAME,
    title: "Governed Pipeline (read-only topology)",
    description:
      "Static governance topology of the JARVIS pipeline: stages, transitions, and boundaries. Read-only metadata; no payloads, no per-session or live state.",
    mimeType: "application/json",
  },
] as const;

/** I-24B1-4: the exact set of exposed resource names this slice. */
export function listExposedResourceNames(): readonly string[] {
  return EXPOSED_RESOURCES.map((resource) => resource.name);
}

export function listExposedResourceUris(): readonly string[] {
  return EXPOSED_RESOURCES.map((resource) => resource.uri);
}

/** The sanitized pipeline view-model (static topology, hygiene-gated). */
export function readPipelineViewModel(): unknown {
  return sanitizeReadPayload(buildPipelineViewModel());
}

export interface ResourceReadHit {
  ok: true;
  uri: string;
  mimeType: "application/json";
  text: string;
}
export interface ResourceReadMiss {
  ok: false;
}
export type ResourceReadOutcome = ResourceReadHit | ResourceReadMiss;

/**
 * Read a resource by URI. Returns a miss for anything not in the exposed set —
 * the caller turns BOTH "unknown" and "forbidden" into the SAME uniform denial
 * (ID-5), so this never distinguishes them.
 */
export function readResourceByUri(uri: string): ResourceReadOutcome {
  if (uri === PIPELINE_VIEW_MODEL_URI) {
    return {
      ok: true,
      uri,
      mimeType: "application/json",
      text: JSON.stringify(readPipelineViewModel()),
    };
  }
  return { ok: false };
}
