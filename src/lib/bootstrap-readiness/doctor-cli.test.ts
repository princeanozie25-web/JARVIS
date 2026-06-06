import { describe, expect, it } from "vitest";

import packageJson from "../../../package.json";
import * as bootstrapReadiness from "./index";
import {
  buildDoctorReportFromResults,
  runDoctorCliAdapter,
  runSafeLocalDoctorRuntime,
  type DoctorCheckId,
  type DoctorCheckStatus,
  type DoctorRuntimeEvaluation,
  type DoctorRuntimeAdapters,
  type DoctorRuntimePathKind,
  type DoctorRuntimePathRequest,
  type DoctorRuntimeVersionProbeResult,
} from "./index";
import {
  buildHardwareProfile,
  type HardwareProfile,
  type ModelRegistryEntry,
} from "../../models";

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
  packageManagerAvailable?: boolean;
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
      return (
        paths.has(key(request.relative_path, request.path_kind)) &&
        !missing.has(request.relative_path)
      );
    },
    nodeVersion: () => "v20.11.0",
    platform: () => "linux",
    packageManagerVersionProbe(): DoctorRuntimeVersionProbeResult {
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

function runtime(input?: {
  missing?: readonly string[];
  packageManagerAvailable?: boolean;
  hardwareProfile?: HardwareProfile;
  modelRegistryEntries?: readonly ModelRegistryEntry[];
  modelRegistryNow?: Date | string;
}) {
  return runSafeLocalDoctorRuntime({
    adapters: fakeAdapters(input),
    hardwareProfile: input?.hardwareProfile,
    modelRegistryEntries: input?.modelRegistryEntries,
    modelRegistryNow: input?.modelRegistryNow,
    observed_at: "cli-fixture",
  });
}

function fixtureHardwareProfile(): HardwareProfile {
  return buildHardwareProfile({
    totalRamBytes: 16 * 1024 ** 3,
    freeRamBytes: 14 * 1024 ** 3,
    platform: "darwin",
    arch: "arm64",
  });
}

function runtimeWithStatus(
  checkId: DoctorCheckId,
  status: DoctorCheckStatus,
): DoctorRuntimeEvaluation {
  const evaluation = runtime();
  const results = evaluation.results.map((result) => ({ ...result }));
  const target = results.find((result) => result.check_id === checkId);

  if (!target) {
    throw new Error(`Missing doctor result: ${checkId}`);
  }

  target.status = status;

  return {
    ...evaluation,
    results,
    report: buildDoctorReportFromResults(results),
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

describe("Phase 20B.7 doctor CLI adapter", () => {
  it("invokes the safe local doctor runtime through an injectable runner", () => {
    let calls = 0;
    const result = runDoctorCliAdapter({
      argv: [],
      runRuntime: () => {
        calls += 1;
        return runtime();
      },
    });

    expect(calls).toBe(1);
    expect(result.format).toBe("text");
    expect(result.evaluation.runtime_version).toBe("20B.6");
  });

  it("renders deterministic human-readable output", () => {
    const result = runDoctorCliAdapter({
      argv: [],
      runRuntime: () => runtime(),
    });

    expect(result.output).toContain("JARVIS Doctor");
    expect(result.output).toContain("Verdict:");
    expect(result.output).toContain("Summary");
    expect(result.output).toContain("Blocking failures");
    expect(result.output).toContain("Warnings");
    expect(result.output).toContain("Pending checks");
    expect(result.output).toContain("Skipped checks");
    expect(result.output).toContain("Category breakdown");
    expect(result.output).toContain("Read-only posture");
    expect(result.output).toContain("Model registry EOL");
    expect(JSON.stringify(result)).toBe(
      JSON.stringify(
        runDoctorCliAdapter({
          argv: [],
          runRuntime: () => runtime(),
        }),
      ),
    );
  });

  it("renders deterministic JSON output", () => {
    const result = runDoctorCliAdapter({
      argv: ["--json"],
      runRuntime: () => runtime(),
    });
    const parsed = JSON.parse(result.output);

    expect(result.format).toBe("json");
    expect(parsed).toMatchObject({
      adapter_version: "20B.7",
      exit_code: 0,
      evaluation: {
        runtime_version: "20B.6",
        hardware_profile: {
          reservedRamGb: 6,
        },
        local_model_fit: {
          advisory_only: true,
          model_download_enabled: false,
          registry_mutation_enabled: false,
          network_call_enabled: false,
        },
        model_registry_staleness: {
          metadata_only: true,
          read_only: true,
          network_call_enabled: false,
          rows: [],
        },
        report: {
          report_version: "20B.5",
        },
      },
    });
    expect(result.output).toBe(
      runDoctorCliAdapter({
        argv: ["--json"],
        runRuntime: () => runtime(),
      }).output,
    );
  });

  it("returns zero for ready, ready-with-warnings, and pending-only report outcomes", () => {
    expect(
      runDoctorCliAdapter({
        argv: [],
        runRuntime: () => runtime(),
      }).exit_code,
    ).toBe(0);
    expect(
      runDoctorCliAdapter({
        argv: [],
        runRuntime: () =>
          runtimeWithStatus(
            "doctor-check:ollama-local-model-runtime",
            "failed",
          ),
      }).exit_code,
    ).toBe(0);
    expect(
      runDoctorCliAdapter({
        argv: [],
        runRuntime: () =>
          runtimeWithStatus(
            "doctor-check:ollama-local-model-runtime",
            "pending",
          ),
      }).exit_code,
    ).toBe(0);
  });

  it("returns non-zero only when blocking failures exist", () => {
    const result = runDoctorCliAdapter({
      argv: [],
      runRuntime: () => runtime({ missing: ["workspace"] }),
    });

    expect(result.exit_code).toBe(1);
    expect(result.evaluation.report.blocking_failures).toHaveLength(1);
    expect(result.output).toContain(
      "doctor-check:required-project-directories",
    );
  });

  it("renders the model registry EOL one-line summary and row table", () => {
    const result = runDoctorCliAdapter({
      argv: [],
      runRuntime: () =>
        runtime({
          modelRegistryNow: "2026-06-24",
          modelRegistryEntries: [
            {
              id: "deepseek-v3",
              provider: "deepseek",
              tier: "T2",
              runtime_class: "cloud",
              capabilities: ["chat", "summarize", "classify", "tool_reasoning"],
              context_window: 128000,
              visibility: "enabled",
              priority: 10,
              supports_streaming: true,
              supports_tools: true,
              supports_vision: false,
              eol_date: "2026-07-24",
              replacement_id: "deepseek-v4-flash",
              metadata: {
                display_name: "DeepSeek V3",
                description: "Fixture model metadata.",
                approximate_memory_mb: null,
                cost_class: "cloud_metered",
                governance_notes: "Fixture only; no provider calls.",
              },
            },
          ],
        }),
    });

    expect(result.output).toContain(
      "1 model retires in 30 days: deepseek-v3 -> deepseek-v4-flash",
    );
    expect(result.output).toContain(
      "id | model_name | tier | eol_date | daysRemaining | status | replacement_id",
    );
    expect(result.output).toContain(
      "deepseek-v3 | deepseek-v3 | T2 | 2026-07-24 | 30 | EOL_SOON | deepseek-v4-flash",
    );
  });

  it("renders local model hardware-fit recommendations without authority", () => {
    const result = runDoctorCliAdapter({
      argv: [],
      runRuntime: () =>
        runtime({
          hardwareProfile: fixtureHardwareProfile(),
          modelRegistryEntries: [
            {
              id: "llama3.2:3b",
              provider: "ollama",
              tier: "T1",
              runtime_class: "local",
              capabilities: ["chat", "summarize", "classify"],
              context_window: 8192,
              visibility: "enabled",
              priority: 10,
              supports_streaming: true,
              supports_tools: false,
              supports_vision: false,
              params_b: 3,
              quant: "q4_K_M",
              metadata: {
                display_name: "Llama 3.2 3B",
                description: "Fixture local model metadata.",
                approximate_memory_mb: 3072,
                cost_class: "local_free",
                governance_notes: "Fixture only; no model execution.",
              },
            },
          ],
        }),
    });

    expect(result.output).toContain("Local model hardware fit");
    expect(result.output).toContain(
      "profile: darwin/arm64, total=16 GB, free=14 GB, unified=true, metal=true",
    );
    expect(result.output).toContain(
      "tier | id | params_b | quant | footprintGb | budgetGb | ratio | bucket",
    );
    expect(result.output).toContain("T1 | llama3.2:3b | 3 | q4_K_M");
    expect(JSON.stringify(result)).toContain('"model_download_enabled":false');
    expect(JSON.stringify(result)).toContain(
      '"registry_mutation_enabled":false',
    );
  });

  it("declares no install, auto-fix, mutation, network, provider, runtime, UI, authority, or raw payload affordances", () => {
    const result = runDoctorCliAdapter({
      argv: [],
      runRuntime: () => runtime(),
    });

    expect(result).toMatchObject({
      metadata_only: true,
      read_only: true,
      deterministic: true,
      cli_adapter_only: true,
      installation_enabled: false,
      auto_fix_enabled: false,
      filesystem_mutation_enabled: false,
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

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(result)).not.toContain(forbiddenFieldName);
    }
  });

  it("keeps the package doctor script wired and adds no UI route export", () => {
    expect(packageJson.scripts.doctor).toBe("tsx scripts/doctor.ts");

    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toContain("runDoctorCliAdapter");
  });
});
