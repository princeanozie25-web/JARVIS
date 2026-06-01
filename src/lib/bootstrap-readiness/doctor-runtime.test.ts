import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS,
  runSafeLocalDoctorRuntime,
  type DoctorRuntimeAdapters,
  type DoctorRuntimePathKind,
  type DoctorRuntimePathRequest,
  type DoctorRuntimeVersionProbeRequest,
  type DoctorRuntimeVersionProbeResult,
} from "./index";

const REQUIRED_DIRECTORIES = [
  "app",
  "src",
  "config",
  "db",
  "docs",
  "scripts",
  "tests",
  "src-tauri",
  "models",
  "workspace",
] as const;

const REQUIRED_CONFIG_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "vitest.config.ts",
  "config/room/default-room.yaml",
  "config/models/registry.yaml",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "bootstrap",
  "run",
  "exec",
  "spawn",
  "mutate",
  "probe",
  "callProvider",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
] as const;

function key(relativePath: string, pathKind: DoctorRuntimePathKind) {
  return `${pathKind}:${relativePath}`;
}

function fakeAdapters(input?: {
  missing?: readonly string[];
  nodeVersion?: string | null;
  platform?: string | null;
  packageManagerAvailable?: boolean;
  captureVersionProbe?: (request: DoctorRuntimeVersionProbeRequest) => void;
}): DoctorRuntimeAdapters {
  const missing = new Set(input?.missing ?? []);
  const paths = new Set<string>();

  for (const directory of REQUIRED_DIRECTORIES) {
    paths.add(key(directory, "directory"));
  }

  for (const file of REQUIRED_CONFIG_FILES) {
    paths.add(key(file, "file"));
  }

  paths.add(key(".env.example", "file"));

  return {
    pathExists(request: DoctorRuntimePathRequest) {
      expect(request).toMatchObject({
        metadata_only: true,
        read_only: true,
        mutation_enabled: false,
      });

      return (
        paths.has(key(request.relative_path, request.path_kind)) &&
        !missing.has(request.relative_path)
      );
    },
    nodeVersion: () => input?.nodeVersion ?? "v20.11.0",
    platform: () => input?.platform ?? "linux",
    packageManagerVersionProbe(request): DoctorRuntimeVersionProbeResult {
      input?.captureVersionProbe?.(request);

      return {
        available: input?.packageManagerAvailable ?? true,
        detected_package_manager:
          input?.packageManagerAvailable === false ? null : "pnpm",
        version_label:
          input?.packageManagerAvailable === false ? null : "9.12.0",
        metadata_only: true,
        read_only: true,
        bounded: true,
        shell_execution_enabled: false,
        network_call_enabled: false,
        provider_call_enabled: false,
        install_action_enabled: false,
        mutation_enabled: false,
      };
    },
  };
}

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([name, value]) => [
    name,
    ...collectKeys(value),
  ]);
}

describe("Phase 20B.6 safe local doctor runtime", () => {
  it("runs supported safe checks using fake adapters", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters(),
      observed_at: "runtime-fixture",
    });

    expect(evaluation.supported_check_ids).toEqual([
      ...SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS,
    ]);
    expect(evaluation.results.map((result) => result.check_id)).toHaveLength(
      15,
    );

    for (const checkId of SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS) {
      expect(
        evaluation.results.find((result) => result.check_id === checkId),
      ).toMatchObject({
        status: "passed",
        source: {
          source_kind: "safe-local-runtime",
          observed_at: "runtime-fixture",
        },
        observed_posture: {
          observation_status: "safe_local_runtime_observation",
        },
        check_executed: true,
      });
    }

    expect(evaluation.report.verdict).toBe("ready");
    expect(evaluation.report.summary.checks_executed).toBe(true);
  });

  it("reports missing directories and files as blocking failures", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters({
        missing: ["workspace", "package.json", "tsconfig.json", ".env.example"],
      }),
      observed_at: "runtime-fixture",
    });

    expect(
      evaluation.results.find(
        (result) =>
          result.check_id === "doctor-check:required-project-directories",
      ),
    ).toMatchObject({
      status: "failed",
      severity: "blocking",
      blocking: true,
      remediation_hint: {
        manual_action_required: true,
      },
    });
    expect(
      evaluation.results.find(
        (result) => result.check_id === "doctor-check:required-config-files",
      ),
    ).toMatchObject({
      status: "failed",
      blocking: true,
    });
    expect(
      evaluation.results.find(
        (result) =>
          result.check_id === "doctor-check:required-env-file-example",
      ),
    ).toMatchObject({
      status: "failed",
      blocking: true,
    });
    expect(evaluation.report.verdict).toBe("blocked");
    expect(evaluation.report.blocking_failures).toHaveLength(3);
  });

  it("classifies unsupported runtime and provider checks as skipped", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters(),
      observed_at: "runtime-fixture",
    });
    const skippedIds = evaluation.results
      .filter((result) => result.status === "skipped")
      .map((result) => result.check_id);

    expect(skippedIds).toEqual([
      "doctor-check:typescript-tooling",
      "doctor-check:required-registries",
      "doctor-check:sqlite-readiness",
      "doctor-check:tauri-readiness",
      "doctor-check:ollama-local-model-runtime",
      "doctor-check:voice-runtime-prerequisites",
      "doctor-check:vision-runtime-prerequisites",
      "doctor-check:local-first-cloud-gated-posture",
      "doctor-check:disabled-provider-posture",
    ]);
    expect(
      evaluation.results
        .filter((result) => result.status === "skipped")
        .every((result) => !result.check_executed),
    ).toBe(true);
  });

  it("uses a bounded read-only injected package-manager version probe", () => {
    let capturedRequest: DoctorRuntimeVersionProbeRequest | null = null;
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters({
        captureVersionProbe: (request) => {
          capturedRequest = request;
        },
      }),
      observed_at: "runtime-fixture",
    });

    expect(capturedRequest).toEqual({
      probe_id: "package-manager-availability",
      package_manager_ids: ["pnpm", "npm"],
      timeout_ms: 1000,
      metadata_only: true,
      read_only: true,
      bounded: true,
      shell_execution_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      install_action_enabled: false,
      mutation_enabled: false,
    });
    expect(
      evaluation.results.find(
        (result) =>
          result.check_id === "doctor-check:package-manager-availability",
      ),
    ).toMatchObject({ status: "passed" });
  });

  it("fails unsupported Node and platform observations without shell/process probing", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters({
        nodeVersion: "v18.19.0",
        platform: "win32",
      }),
      observed_at: "runtime-fixture",
    });

    expect(
      evaluation.results.find(
        (result) => result.check_id === "doctor-check:node-version",
      ),
    ).toMatchObject({
      status: "failed",
      blocking: true,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
    });
    expect(
      evaluation.results.find(
        (result) => result.check_id === "doctor-check:platform-support",
      ),
    ).toMatchObject({
      status: "failed",
      blocking: true,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
    });
  });

  it("skips safe checks when optional injected detectors are absent", () => {
    const adapters = fakeAdapters();
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: {
        pathExists: adapters.pathExists,
      },
      observed_at: "runtime-fixture",
    });

    expect(
      evaluation.results.find(
        (result) => result.check_id === "doctor-check:node-version",
      ),
    ).toMatchObject({ status: "skipped", check_executed: false });
    expect(
      evaluation.results.find(
        (result) =>
          result.check_id === "doctor-check:package-manager-availability",
      ),
    ).toMatchObject({ status: "skipped", check_executed: false });
    expect(
      evaluation.results.find(
        (result) => result.check_id === "doctor-check:platform-support",
      ),
    ).toMatchObject({ status: "skipped", check_executed: false });
  });

  it("keeps report summary aligned with runtime results", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters({ missing: ["workspace"] }),
      observed_at: "runtime-fixture",
    });
    const failedCount = evaluation.results.filter(
      (result) => result.status === "failed",
    ).length;
    const skippedCount = evaluation.results.filter(
      (result) => result.status === "skipped",
    ).length;

    expect(evaluation.report.summary.total_count).toBe(
      evaluation.results.length,
    );
    expect(evaluation.report.summary.status_counts.failed).toBe(failedCount);
    expect(evaluation.report.summary.status_counts.skipped).toBe(skippedCount);
    expect(evaluation.report.summary.checks_executed).toBe(true);
    expect(evaluation.report.source_metadata.checks_executed).toBe(true);
  });

  it("is deterministic with fixed injected observations", () => {
    const options = {
      adapters: fakeAdapters(),
      observed_at: "runtime-fixture",
    };

    expect(JSON.stringify(runSafeLocalDoctorRuntime(options))).toBe(
      JSON.stringify(runSafeLocalDoctorRuntime(options)),
    );
  });

  it("declares no installation, auto-fix, mutation, network, provider, runtime execution, UI, authority, or capability affordances", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters(),
      observed_at: "runtime-fixture",
    });

    expect(evaluation).toMatchObject({
      metadata_only: true,
      read_only: true,
      deterministic: true,
      safe_local_runtime_only: true,
      installation_enabled: false,
      auto_fix_enabled: false,
      filesystem_mutation_enabled: false,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      ollama_call_enabled: false,
      tauri_execution_enabled: false,
      voice_runtime_execution_enabled: false,
      vision_runtime_execution_enabled: false,
      approval_bypass_created: false,
      ui_route_created: false,
      authority_surface_created: false,
      capability_created: false,
      raw_payload_included: false,
    });

    for (const result of evaluation.results) {
      expect(result.install_action_enabled).toBe(false);
      expect(result.mutation_enabled).toBe(false);
      expect(result.network_call_enabled).toBe(false);
      expect(result.provider_call_enabled).toBe(false);
      expect(result.shell_execution_enabled).toBe(false);
      expect(result.process_spawn_enabled).toBe(false);
      expect(result.ui_route_created).toBe(false);
      expect(result.authority_surface_created).toBe(false);
      expect(result.capability_created).toBe(false);
    }
  });

  it("does not expose raw payload fields or UI route exports", () => {
    const evaluation = runSafeLocalDoctorRuntime({
      adapters: fakeAdapters(),
      observed_at: "runtime-fixture",
    });
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(evaluation)).not.toContain(forbiddenFieldName);
    }

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toContain("runSafeLocalDoctorRuntime");
  });
});
