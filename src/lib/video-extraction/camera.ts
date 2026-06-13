import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
  completeVisionSession,
  createVisionSessionTelemetryEvent,
  failVisionSession,
  ingestVisionFrameDescriptor,
  requestVisionSession,
  startVisionSession,
  type VisionSessionRecord,
} from "@/lib/vision";
import { runVisionCapabilityRouter } from "@/lib/vision-runtime";
import {
  createVisionProviderRegistry,
  type VisionProviderRegistryResult,
} from "@/lib/vision-runtime/registry";
import { loadVisionSourceAllowlistConfig } from "@/lib/vision-runtime/config/source-allowlist-config";
import {
  isVisionConsentGranted,
  loadVisionStandingConsentConfig,
} from "@/lib/vision-runtime/config/standing-consent-config";

import { gateAndEmit } from "./events";
import { hashVideoSource, VIDEO_EXTRACTION_VERSION } from "./workflow";

// Phase 23F real camera path — the highest-trust surface in the phase.
// Consent-gated, indicator-MANDATORY, user-initiated, single vision session.
// NO streaming, NO preview surfaces, NO retention outside the artifact
// folder, NO cloud vision, and NO identity/face recognition of any kind.
// Frame bytes exist only under the artifact folder; events carry hashes and
// allowlisted metadata only.

const BoundedIdSchema = z.string().trim().min(1).max(220);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

// Indicator + capture transitions ride the existing vision_lane_event
// telemetry literal (no new literals). Per the 23B lane registry, generic
// lane events carry their lane stage in `reason` ("capture"). event_id stays
// opaque — nothing may parse meaning from it.
export const CameraLaneEventSchema = z.strictObject({
  event_type: z.literal("vision_lane_event"),
  event_id: BoundedIdSchema,
  session_id: BoundedIdSchema,
  source_id_hash: HashReferenceSchema,
  kind: z.literal("capture"),
  reason: z.literal("capture"),
  status: z.enum(["completed", "failed"]),
  result_status: z.enum([
    "indicator_on",
    "indicator_off",
    "capture_completed",
    "capture_refused",
  ]),
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});
export type CameraLaneEvent = z.infer<typeof CameraLaneEventSchema>;

export interface CameraCaptureRunner {
  captureFrame(input: {
    readonly device_name: string;
    readonly destination_path: string;
    readonly clip_seconds: number;
  }): Promise<void> | void;
}

export interface CameraCaptureRequest {
  readonly device_name: string;
  readonly explicit_user_triggered: true;
  // REQUIRED indicator acknowledgement: the UI layer must confirm a visible
  // capture indicator before any runner invocation. Structural — no callback
  // or a false return refuses before the runner is touched.
  readonly indicator_ack: () => boolean | Promise<boolean>;
  readonly clip_seconds?: number;
  readonly consent_config_path?: string;
  readonly allowlist_config_path?: string;
  readonly artifact_root?: string;
  readonly session_surface?: "chat" | "voice" | "developer_test";
  readonly existing_sessions?: VisionSessionRecord[];
  readonly now_ms?: number;
}

export interface CameraCaptureDependencies {
  readonly cameraRunner: CameraCaptureRunner;
  readonly emitTelemetry?: (
    event: Record<string, unknown>,
  ) => void | Promise<void>;
  readonly clockNow?: () => number;
}

export interface CameraCaptureResult {
  readonly status:
    | "completed"
    | "refused_consent"
    | "refused_indicator"
    | "refused_duration_cap"
    | "refused_session_occupancy"
    | "refused_admission"
    | "failed_runner";
  readonly reasons: readonly string[];
  readonly session: VisionSessionRecord | null;
  readonly artifact_dir: string | null;
  readonly frame_path: string | null;
  readonly frame_hash: string | null;
  readonly descriptor_accepted: boolean;
  readonly events: readonly Record<string, unknown>[];
}

export async function captureCameraFrame(
  request: CameraCaptureRequest,
  deps: CameraCaptureDependencies,
): Promise<CameraCaptureResult> {
  if (request.explicit_user_triggered !== true) {
    throw new Error("Camera capture requires an explicit user trigger.");
  }
  const clock = deps.clockNow ?? (() => Date.now());
  const sourceHash = hashVideoSource(`camera:${request.device_name}`);
  const hashSegment = sourceHash.slice(7, 23);
  const sessionId = `video:camera:${hashSegment}`;
  const events: Record<string, unknown>[] = [];

  async function emitLane(
    status: "completed" | "failed",
    resultStatus: CameraLaneEvent["result_status"],
  ): Promise<void> {
    const event = CameraLaneEventSchema.parse({
      event_type: "vision_lane_event",
      event_id: `video-camera:${VIDEO_EXTRACTION_VERSION}:${resultStatus}:${hashSegment}`,
      session_id: sessionId,
      source_id_hash: sourceHash,
      kind: "capture",
      reason: "capture",
      status,
      result_status: resultStatus,
      created_at_ms: clock(),
      metadata_only: true,
      raw_payload_included: false,
      cloud_called: false,
      action_executed: false,
    });
    await gateAndEmit(
      event as unknown as Record<string, unknown>,
      deps.emitTelemetry,
      events,
    );
  }

  function refusal(
    status: CameraCaptureResult["status"],
    reason: string,
    session: VisionSessionRecord | null = null,
  ): CameraCaptureResult {
    return {
      status,
      reasons: [reason],
      session,
      artifact_dir: null,
      frame_path: null,
      frame_hash: null,
      descriptor_accepted: false,
      events,
    };
  }

  // 1. Consent gate FIRST (camera_capture). Deny => nothing else runs.
  const consent = loadVisionStandingConsentConfig(request.consent_config_path);
  const consentGranted = isVisionConsentGranted(consent, "camera_capture");
  if (!consentGranted) {
    await emitLane("failed", "capture_refused");
    return refusal("refused_consent", "consent_denied:camera_capture");
  }

  // 2. Duration cap from the allowlist (pre-invocation, I-23F-5).
  const allowlist = loadVisionSourceAllowlistConfig(
    request.allowlist_config_path,
  );
  const clipSeconds = request.clip_seconds ?? 0; // 0 = single-shot frame
  if (
    allowlist.caps.max_camera_clip_s <= 0 ||
    clipSeconds > allowlist.caps.max_camera_clip_s
  ) {
    await emitLane("failed", "capture_refused");
    return refusal("refused_duration_cap", "camera_clip_cap_exceeded");
  }

  // 3. Indicator gate — structural, BEFORE any runner invocation (I-23F-2).
  if (typeof request.indicator_ack !== "function") {
    await emitLane("failed", "capture_refused");
    return refusal("refused_indicator", "indicator_ack_missing");
  }
  const acknowledged = await request.indicator_ack();
  if (acknowledged !== true) {
    await emitLane("failed", "capture_refused");
    return refusal("refused_indicator", "indicator_ack_false");
  }

  // 4. Registry admission: real_camera registration accepted only with the
  // registration-time consent verdict (deny branch identical to today).
  const registryResult: VisionProviderRegistryResult =
    createVisionProviderRegistry([]);
  if (!registryResult.ok || !registryResult.registry) {
    await emitLane("failed", "capture_refused");
    return refusal("refused_admission", "registry_unavailable");
  }
  const registration = registryResult.registry.register(
    {
      id: "real-camera-local",
      kind: "real_camera",
      supported_capability: "real_camera",
      metadata_only: true,
      async health() {
        return {
          provider_id: "real-camera-local",
          provider_kind: "real_camera",
          supported_capability: "real_camera",
          ok: true,
          degraded: false,
          checked_at_ms: clock(),
          metadata_only: true,
        } as never;
      },
      async run() {
        throw new Error(
          "real-camera-local does not run through the provider path; capture is runner-injected.",
        );
      },
    },
    { camera_capture_consent_granted: consentGranted },
  );
  if (!registration.ok) {
    await emitLane("failed", "capture_refused");
    return refusal("refused_admission", "registration_rejected");
  }

  // 5. Router admission (real_local mode: consent + user trigger + policy).
  const admission = await runVisionCapabilityRouter({
    request_id: `camera:${hashSegment}`,
    capability: "real_camera",
    input_kind: "real_camera_frame",
    mode: "real_local",
    requested_at_ms: clock(),
    metadata_only: true,
    user_triggered: true,
    capture_mode: "single",
    environment: "development",
    camera_capture_consent_granted: consentGranted,
  });
  if (admission.status !== "completed") {
    await emitLane("failed", "capture_refused");
    return refusal("refused_admission", "router_admission_denied");
  }

  // 6. Session envelope.
  let session = requestVisionSession({
    session_id: sessionId,
    requested_input_type: "camera_frame",
    surface: request.session_surface ?? "developer_test",
    requested_at: clock(),
    existing_sessions: request.existing_sessions,
  });
  events.push(
    createVisionSessionTelemetryEvent({
      session,
      event_type: "vision_session_requested",
      session_id_hash: hashVideoSource(sessionId),
    }) as unknown as Record<string, unknown>,
  );
  if (session.state === "denied") {
    return refusal(
      "refused_session_occupancy",
      "single_active_session_denied",
      session,
    );
  }
  session = startVisionSession({ session, now_ms: clock() });

  // 7. Indicator ON -> capture -> indicator OFF (always emitted).
  await emitLane("completed", "indicator_on");
  const artifactRoot =
    request.artifact_root ?? join(process.cwd(), "data", "vision-artifacts");
  const dateSegment = new Date(clock()).toISOString().slice(0, 10);
  const artifactDir = join(
    artifactRoot,
    `${dateSegment}-camera-${hashSegment}`,
  );
  const framePath = join(artifactDir, "frame-0001.png");
  try {
    await mkdir(artifactDir, { recursive: true });
    await deps.cameraRunner.captureFrame({
      device_name: request.device_name,
      destination_path: framePath,
      clip_seconds: clipSeconds,
    });
  } catch {
    await emitLane("completed", "indicator_off");
    session = failVisionSession({ session, now_ms: clock() });
    return {
      ...refusal("failed_runner", "capture_runner_failed", session),
      artifact_dir: artifactDir,
    };
  }
  await emitLane("completed", "indicator_off");

  // 8. Frames flow into the EXISTING 23D descriptor path: hash-only.
  const frameBytes = await readFile(framePath);
  const frameHash = `sha256:${createHash("sha256")
    .update(frameBytes)
    .digest("hex")}`;
  const nowMs = clock();
  const ingestion = ingestVisionFrameDescriptor({
    frame_id: `frame:camera:${hashSegment}:0001`,
    vision_session_id: sessionId,
    source_type: "camera_frame",
    input_hash: frameHash,
    observed_at: nowMs,
    received_at: nowMs,
    freshness_ms: 0,
    stale_after_ms: 60_000,
    stale: false,
    current_truth: false,
    redaction_status: "metadata_only",
    failure_replay_ref: null,
    metadata_only: true,
    raw_payload_stored: false,
    advisory_only: true,
    capture_started: false,
    provider_executed: false,
    cloud_called: false,
    action_executed: false,
    background_job_started: false,
  });

  await emitLane("completed", "capture_completed");
  session = completeVisionSession({ session, now_ms: clock() });
  events.push(
    createVisionSessionTelemetryEvent({
      session,
      event_type: "vision_session_completed",
      session_id_hash: hashVideoSource(sessionId),
    }) as unknown as Record<string, unknown>,
  );

  return {
    status: "completed",
    reasons: ["camera_capture_completed"],
    session,
    artifact_dir: artifactDir,
    frame_path: framePath,
    frame_hash: frameHash,
    descriptor_accepted: ingestion.status === "accepted",
    events,
  };
}
