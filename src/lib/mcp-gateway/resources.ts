// MCP gateway — the exposed READ surface registry.
//
// As of 24B-2 the gateway exposes EXACTLY TWO reads:
//   1. pipeline-view-model — static governance topology (ID-4), the 24B-1 read.
//   2. queue-status        — counts-only approval-queue status (ID-1 redaction
//                            + ID-3 anti-poll cadence), the 24B-2 read.
// Everything else is NEVER-EXPOSED by default (ID-0).
//
// GATE-2: imports ONLY read projections + the local sanitizer + the leaf
// queue-status projection. The pipeline view-model comes from
// pipeline-visualization (an allowed read tree); the queue-status snapshot is
// produced by an INJECTED counts source wired OUTSIDE the gateway's import
// graph (see queue-status.ts — it imports nothing, and the raw count is read
// from the approvals DB by the host/test, never by the gateway). No mutator,
// no DB, no executor is ever imported here.

import { buildPipelineViewModel } from "@/lib/pipeline-visualization";
import { sanitizeReadPayload } from "./sanitizer";
import {
  QUEUE_STATUS_NAME,
  QUEUE_STATUS_URI,
  type QueueStatusReader,
} from "./queue-status";

export const PIPELINE_VIEW_MODEL_URI = "jarvis://pipeline/view-model" as const;
export const PIPELINE_VIEW_MODEL_NAME = "pipeline-view-model" as const;

export interface ExposedResourceDescriptor {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: "application/json";
}

/** The complete EXPOSED-READONLY set as of 24B-2: exactly two entries —
 * pipeline-view-model (24B-1) and queue-status (24B-2). Order is stable. */
export const EXPOSED_RESOURCES: readonly ExposedResourceDescriptor[] = [
  {
    uri: PIPELINE_VIEW_MODEL_URI,
    name: PIPELINE_VIEW_MODEL_NAME,
    title: "Governed Pipeline (read-only topology)",
    description:
      "Static governance topology of the JARVIS pipeline: stages, transitions, and boundaries. Read-only metadata; no payloads, no per-session or live state.",
    mimeType: "application/json",
  },
  {
    uri: QUEUE_STATUS_URI,
    name: QUEUE_STATUS_NAME,
    title: "Approval queue status (counts-only)",
    description:
      "Counts-only status of the approval queue: a pending count and a coarse bucket, refreshed on a server-side cadence. No per-item detail of any kind; no resolution activity; no real-time feed.",
    mimeType: "application/json",
  },
] as const;

/** I-24B2-1 / I-24B1-4: the exact set of exposed resource names. */
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
 * Read a resource by URI. Returns a miss for anything not in the exposed set,
 * AND for queue-status when no counts source has been wired — the caller turns
 * every miss into the SAME uniform denial (ID-5), so a probing client cannot
 * tell "unknown URI" from "forbidden" from "exposed-but-not-wired".
 *
 * The queue-status read is gated on an INJECTED reader so the gateway never
 * imports the approvals/db tree (GATE-2). Both reads pass through the sanitizer
 * before leaving the process — defense in depth: queue-status is counts-only by
 * construction AND independently proven clean by the sentinel.
 */
export function readResourceByUri(
  uri: string,
  queueStatus: QueueStatusReader | null = null,
): ResourceReadOutcome {
  if (uri === PIPELINE_VIEW_MODEL_URI) {
    return {
      ok: true,
      uri,
      mimeType: "application/json",
      text: JSON.stringify(readPipelineViewModel()),
    };
  }
  if (uri === QUEUE_STATUS_URI) {
    if (queueStatus === null) return { ok: false };
    return {
      ok: true,
      uri,
      mimeType: "application/json",
      text: JSON.stringify(sanitizeReadPayload(queueStatus.read())),
    };
  }
  return { ok: false };
}
