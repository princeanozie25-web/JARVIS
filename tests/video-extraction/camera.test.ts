import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateObservabilityPayloadSafety } from "../../src/lib/command-center/observability-redaction";
import { captureCameraFrame } from "../../src/lib/video-extraction";
import {
  runVisionCapabilityRouter,
  sanitizeVisionMetadataPayload,
} from "../../src/lib/vision-runtime";
import { evaluateVisionRuntimePolicy } from "../../src/lib/vision-runtime/policy";
import { VISION_ROUTER_MODES } from "../../src/lib/vision-runtime/router";
import { createVisionProviderRegistry } from "../../src/lib/vision-runtime/registry";

function consentYaml(cameraGranted: boolean): string {
  return [
    "version: phase23.vision.standing-consent.v1",
    "owner_controlled: true",
    "auditable: true",
    "revocable: true",
    "vision_may_grant_consent: false",
    "no_self_expansion: true",
    "metadata_only: true",
    "consents:",
    "  - id: camera_capture",
    "    label: Test camera capture",
    "    tier: T3",
    "    action: camera_capture",
    "    scope: vision.camera.capture",
    `    granted: ${cameraGranted}`,
    "    revoked: false",
    "    granted_by: user_config",
    "    audit_event: standing-consent:camera_capture",
  ].join("\n");
}

function forbiddenRealCameraProvider() {
  return {
    id: "real-camera-test",
    kind: "real_camera" as const,
    supported_capability: "real_camera" as const,
    metadata_only: true as const,
    async health() {
      return {} as never;
    },
    async run() {
      return {} as never;
    },
  };
}

let root: string;
let grantedConsentPath: string;
let artifactRoot: string;

function makeRunner() {
  return {
    captureFrame: vi.fn(
      async (input: { destination_path: string }) =>
        void (await writeFile(
          input.destination_path,
          Buffer.from("fixture-camera-frame-bytes"),
        )),
    ),
  };
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "jarvis-camera-"));
  artifactRoot = join(root, "artifacts");
  grantedConsentPath = join(root, "consent-camera.yaml");
  await writeFile(grantedConsentPath, consentYaml(true), "utf8");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Phase 23F consent gate (I-23F-1)", () => {
  it("default consent config refuses capture; runner never invoked", async () => {
    const runner = makeRunner();
    const result = await captureCameraFrame(
      {
        device_name: "Test Camera",
        explicit_user_triggered: true,
        indicator_ack: () => true,
        artifact_root: artifactRoot,
      },
      { cameraRunner: runner, clockNow: () => 1_786_100_000_000 },
    );

    expect(result.status).toBe("refused_consent");
    expect(runner.captureFrame).not.toHaveBeenCalled();
    expect(existsSync(artifactRoot)).toBe(false);
  });

  it("registration without consent rejects with today's reason code", () => {
    const registryResult = createVisionProviderRegistry([]);
    if (!registryResult.ok || !registryResult.registry) {
      throw new Error("registry creation failed");
    }
    const rejected = registryResult.registry.register(
      forbiddenRealCameraProvider(),
    );
    expect(rejected).toMatchObject({
      ok: false,
      reason: "forbidden_provider_capability",
      capability: "real_camera",
    });
  });

  it("registration with the consent verdict is accepted", () => {
    const registryResult = createVisionProviderRegistry([]);
    if (!registryResult.ok || !registryResult.registry) {
      throw new Error("registry creation failed");
    }
    const accepted = registryResult.registry.register(
      forbiddenRealCameraProvider(),
      { camera_capture_consent_granted: true },
    );
    expect(accepted.ok).toBe(true);
  });

  it("cloud_vision rejection stays unconditional even with the flag", () => {
    const registryResult = createVisionProviderRegistry([]);
    if (!registryResult.ok || !registryResult.registry) {
      throw new Error("registry creation failed");
    }
    const rejected = registryResult.registry.register(
      {
        ...forbiddenRealCameraProvider(),
        id: "cloud-test",
        kind: "cloud_vision" as const,
        supported_capability: "cloud_vision" as const,
      },
      { camera_capture_consent_granted: true },
    );
    expect(rejected).toMatchObject({
      ok: false,
      reason: "forbidden_provider_capability",
      capability: "cloud_vision",
    });
  });
});

describe("Phase 23F indicator gate (I-23F-2)", () => {
  it("refuses structurally when indicator_ack is missing", async () => {
    const runner = makeRunner();
    const result = await captureCameraFrame(
      {
        device_name: "Test Camera",
        explicit_user_triggered: true,
        indicator_ack: undefined as never,
        consent_config_path: grantedConsentPath,
        artifact_root: artifactRoot,
      },
      { cameraRunner: runner, clockNow: () => 1_786_100_000_000 },
    );
    expect(result.status).toBe("refused_indicator");
    expect(result.reasons).toEqual(["indicator_ack_missing"]);
    expect(runner.captureFrame).not.toHaveBeenCalled();
  });

  it("refuses before runner invocation when the ack returns false", async () => {
    const order: string[] = [];
    const result = await captureCameraFrame(
      {
        device_name: "Test Camera",
        explicit_user_triggered: true,
        indicator_ack: () => {
          order.push("ack");
          return false;
        },
        consent_config_path: grantedConsentPath,
        artifact_root: artifactRoot,
      },
      {
        cameraRunner: {
          captureFrame: () => {
            order.push("runner");
          },
        },
        clockNow: () => 1_786_100_000_000,
      },
    );
    expect(result.status).toBe("refused_indicator");
    expect(order).toEqual(["ack"]);
  });
});

describe("Phase 23F router mode additivity (I-23F-3, I-23F-4)", () => {
  it("keeps the original mode literals byte-identical and in order", () => {
    expect(VISION_ROUTER_MODES.slice(0, 2)).toEqual([
      "fake",
      "dry_run_disabled",
    ]);
    expect(VISION_ROUTER_MODES).toEqual([
      "fake",
      "dry_run_disabled",
      "real_local",
    ]);
  });

  it("denies real_local admission without consent", async () => {
    const result = await runVisionCapabilityRouter({
      request_id: "camera:test",
      capability: "real_camera",
      input_kind: "real_camera_frame",
      mode: "real_local",
      requested_at_ms: 1,
      metadata_only: true,
      user_triggered: true,
      capture_mode: "single",
      environment: "development",
      camera_capture_consent_granted: false,
    });
    expect(result.status).toBe("denied");
    expect(result.reason).toBe("source_denied");
  });

  it("admits real_local with consent, user trigger, and single mode", async () => {
    const result = await runVisionCapabilityRouter({
      request_id: "camera:test",
      capability: "real_camera",
      input_kind: "real_camera_frame",
      mode: "real_local",
      requested_at_ms: 1,
      metadata_only: true,
      user_triggered: true,
      capture_mode: "single",
      environment: "development",
      camera_capture_consent_granted: true,
    });
    expect(result.status).toBe("completed");
  });

  it("background/periodic/continuous stay denied even with consent (I-23F-4)", () => {
    for (const mode of ["background", "periodic", "continuous"] as const) {
      const decision = evaluateVisionRuntimePolicy({
        capability: "real_camera",
        input_kind: "real_camera_frame",
        provider_kind: "real_camera",
        environment: "development",
        user_triggered: true,
        capture_mode: mode,
        camera_capture_consent_granted: true,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe(
        `${mode === "continuous" ? "continuous_video" : `${mode}_capture`}_forbidden`,
      );
    }
  });

  it("keeps the default real-camera denial byte-identical without consent", () => {
    const decision = evaluateVisionRuntimePolicy({
      capability: "real_camera",
      input_kind: "real_camera_frame",
      provider_kind: "real_camera",
      environment: "development",
      user_triggered: true,
      capture_mode: "single",
    });
    expect(decision).toMatchObject({
      allowed: false,
      reason: "real_camera_disabled",
    });
  });
});

describe("Phase 23F duration cap (I-23F-5)", () => {
  it("refuses a clip longer than max_camera_clip_s before invocation", async () => {
    const runner = makeRunner();
    const result = await captureCameraFrame(
      {
        device_name: "Test Camera",
        explicit_user_triggered: true,
        indicator_ack: () => true,
        clip_seconds: 31,
        consent_config_path: grantedConsentPath,
        artifact_root: artifactRoot,
      },
      { cameraRunner: runner, clockNow: () => 1_786_100_000_000 },
    );
    expect(result.status).toBe("refused_duration_cap");
    expect(runner.captureFrame).not.toHaveBeenCalled();
  });
});

describe("Phase 23F fixture capture round-trip (I-23F-7)", () => {
  it("captures, hashes, ingests a descriptor, and keeps bytes artifact-only", async () => {
    const runner = makeRunner();
    const captured: Record<string, unknown>[] = [];
    const result = await captureCameraFrame(
      {
        device_name: "Fixture Camera",
        explicit_user_triggered: true,
        indicator_ack: () => true,
        consent_config_path: grantedConsentPath,
        artifact_root: artifactRoot,
      },
      {
        cameraRunner: runner,
        clockNow: () => 1_786_100_000_000,
        emitTelemetry: (event) => {
          captured.push(event);
        },
      },
    );

    expect(result.status).toBe("completed");
    expect(result.frame_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.descriptor_accepted).toBe(true);
    expect(result.session?.state).toBe("completed");
    expect(result.frame_path?.startsWith(artifactRoot)).toBe(true);

    const laneStatuses = result.events
      .filter((event) => event.event_type === "vision_lane_event")
      .map((event) => event.result_status);
    expect(laneStatuses).toEqual([
      "indicator_on",
      "indicator_off",
      "capture_completed",
    ]);

    const serialized = JSON.stringify(result.events);
    expect(serialized).not.toContain("artifacts");
    expect(serialized).not.toContain("frame-0001");
    expect(serialized).not.toContain("Fixture Camera");

    for (const event of result.events.filter(
      (candidate) => candidate.event_type === "vision_lane_event",
    )) {
      expect(sanitizeVisionMetadataPayload({ ...event })).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      expect(validateObservabilityPayloadSafety({ ...event }).passed).toBe(
        true,
      );
    }
  });
});
