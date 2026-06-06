import { execFileSync } from "node:child_process";
import { existsSync, statfsSync, statSync } from "node:fs";
import { freemem, platform } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createBootstrapContract,
  validateBootstrapContract,
  type BootstrapContract,
  type BootstrapEnvironmentSnapshot,
  type BootstrapEnvVarName,
  type BootstrapOsFamily,
  type BootstrapProviderId,
  type BootstrapValidationReason,
} from "./bootstrap-contract";
import {
  runDoctorCliAdapter,
  runSafeLocalDoctorRuntime,
  type DoctorCliAdapterResult,
  type DoctorRuntimeAdapters,
  type DoctorRuntimePathRequest,
  type DoctorRuntimeVersionProbeRequest,
  type DoctorRuntimeVersionProbeResult,
} from "../src/lib/bootstrap-readiness";
import { loadDefaultModelRegistry } from "../src/models";

export type DoctorStatus = "pass" | "warn" | "fail";

export type DoctorWarningReason = "disk_unavailable";

export interface DoctorInspectionReport {
  readonly status: DoctorStatus;
  readonly contractId: BootstrapContract["id"];
  readonly phase: "10A.2";
  readonly snapshot: BootstrapEnvironmentSnapshot;
  readonly validationReasons: BootstrapValidationReason[];
  readonly warnings: DoctorWarningReason[];
  readonly env: {
    readonly present: BootstrapEnvVarName[];
    readonly missing: BootstrapEnvVarName[];
  };
  readonly providers: Readonly<
    Record<BootstrapProviderId, "disabled" | "enabled">
  >;
  readonly ports: BootstrapContract["ports"];
  readonly effects: {
    readonly installed: false;
    readonly mutatedMachine: false;
    readonly networkCalled: false;
    readonly providerContacted: false;
    readonly portProbed: false;
    readonly roomAdapterAdded: false;
    readonly uiRendered: false;
  };
}

export interface DoctorHostProbe {
  readonly osFamily: () => BootstrapOsFamily;
  readonly nodeVersion: () => string;
  readonly pnpmVersion: () => string | null;
  readonly availableMemoryBytes: () => number;
  readonly availableDiskBytes: () => number | null;
  readonly env: () => Readonly<Record<string, string | undefined>>;
}

const UNKNOWN_DISK_BYTES = Number.MAX_SAFE_INTEGER;

export const DOCTOR_READ_ONLY_EFFECTS: DoctorInspectionReport["effects"] = {
  installed: false,
  mutatedMachine: false,
  networkCalled: false,
  providerContacted: false,
  portProbed: false,
  roomAdapterAdded: false,
  uiRendered: false,
};

export function createDoctorReport(
  snapshot: BootstrapEnvironmentSnapshot,
  input: {
    contract?: BootstrapContract;
    warnings?: DoctorWarningReason[];
  } = {},
): DoctorInspectionReport {
  const contract = input.contract ?? createBootstrapContract();
  const validation = validateBootstrapContract(snapshot, contract);
  const warnings = input.warnings ?? [];

  return {
    status: validation.passed
      ? warnings.length > 0
        ? "warn"
        : "pass"
      : "fail",
    contractId: contract.id,
    phase: "10A.2",
    snapshot,
    validationReasons: validation.reasons,
    warnings,
    env: {
      present: contract.env.requiredNames.filter(
        (name) => snapshot.env[name] !== undefined,
      ),
      missing: validation.missingEnvVars,
    },
    providers: providerStatuses(snapshot.defaults.realProvidersEnabled),
    ports: contract.ports,
    effects: DOCTOR_READ_ONLY_EFFECTS,
  };
}

export function inspectDoctorEnvironment(
  probe: DoctorHostProbe = createNodeDoctorHostProbe(),
  contract: BootstrapContract = createBootstrapContract(),
): DoctorInspectionReport {
  const diskBytes = probe.availableDiskBytes();
  const warnings: DoctorWarningReason[] = [];
  if (diskBytes === null) warnings.push("disk_unavailable");

  return createDoctorReport(
    {
      osFamily: probe.osFamily(),
      nodeVersion: probe.nodeVersion(),
      pnpmVersion: probe.pnpmVersion(),
      availableMemoryBytes: probe.availableMemoryBytes(),
      availableDiskBytes: diskBytes ?? UNKNOWN_DISK_BYTES,
      env: probe.env(),
      defaults: {
        localOnly: contract.defaults.localOnly,
        remoteDashboardEnabled: contract.defaults.remoteDashboardEnabled,
        realProvidersEnabled: contract.defaults.realProvidersEnabled,
      },
    },
    { contract, warnings },
  );
}

export function renderDoctorSummary(report: DoctorInspectionReport): string {
  const lines = [
    "JARVIS Local Doctor",
    `Status: ${report.status.toUpperCase()}`,
    `Contract: ${report.contractId}`,
    "",
    "Environment",
    `- OS: ${report.snapshot.osFamily}`,
    `- Node: ${report.snapshot.nodeVersion}`,
    `- pnpm: ${report.snapshot.pnpmVersion ?? "missing"}`,
    `- Memory: ${formatGib(report.snapshot.availableMemoryBytes)} available`,
    `- Disk: ${
      report.warnings.includes("disk_unavailable")
        ? "unavailable"
        : `${formatGib(report.snapshot.availableDiskBytes)} available`
    }`,
    "",
    "Required environment variables",
    ...report.env.present.map((name) => `- ${name}: present`),
    ...report.env.missing.map((name) => `- ${name}: missing`),
    "",
    "Required local ports (declared only; not probed)",
    ...report.ports.map(
      (port) =>
        `- ${port.id}: ${port.protocol}://${port.bind}:${port.port} (${port.purpose})`,
    ),
    "",
    "Real providers",
    ...Object.entries(report.providers).map(
      ([provider, status]) => `- ${provider}: ${status}`,
    ),
    "",
    "Read-only posture",
    `- installs: ${report.effects.installed}`,
    `- machine mutation: ${report.effects.mutatedMachine}`,
    `- network calls: ${report.effects.networkCalled}`,
    `- provider contact: ${report.effects.providerContacted}`,
    `- port probing: ${report.effects.portProbed}`,
    `- room adapters: ${report.effects.roomAdapterAdded}`,
    `- UI rendering: ${report.effects.uiRendered}`,
  ];

  if (report.validationReasons.length > 0) {
    lines.push(
      "",
      "Failures",
      ...report.validationReasons.map((reason) => `- ${reason}`),
    );
  }
  if (report.warnings.length > 0) {
    lines.push(
      "",
      "Warnings",
      ...report.warnings.map((reason) => `- ${reason}`),
    );
  }

  return lines.join("\n");
}

export function createNodeDoctorHostProbe(): DoctorHostProbe {
  return {
    osFamily: () => mapNodePlatform(platform()),
    nodeVersion: () => process.version,
    pnpmVersion: readPnpmVersion,
    availableMemoryBytes: () => freemem(),
    availableDiskBytes: readAvailableDiskBytes,
    env: () => process.env,
  };
}

export function mapNodePlatform(value: NodeJS.Platform): BootstrapOsFamily {
  if (value === "darwin") return "macos";
  if (value === "linux") return "linux";
  if (value === "win32") return "windows";
  return "unknown";
}

export function createNodeDoctorRuntimeAdapters(
  projectRoot = process.cwd(),
): DoctorRuntimeAdapters {
  return {
    pathExists: (request) => nodePathExists(projectRoot, request),
    nodeVersion: () => process.version,
    platform: () => platform(),
    packageManagerVersionProbe: nodePackageManagerVersionProbe,
  };
}

export function runDoctorCli(
  argv: readonly string[] = process.argv.slice(2),
): DoctorCliAdapterResult {
  const result = runDoctorCliAdapter({
    argv,
    runRuntime: () =>
      runSafeLocalDoctorRuntime({
        adapters: createNodeDoctorRuntimeAdapters(),
        modelRegistryEntries: loadDefaultModelRegistry().listModels(),
        modelRegistryNow: new Date(),
        observed_at: null,
      }),
  });

  console.log(result.output);
  process.exitCode = result.exit_code;

  return result;
}

function nodePathExists(
  projectRoot: string,
  request: DoctorRuntimePathRequest,
): boolean {
  try {
    const target = resolve(projectRoot, request.relative_path);
    const stats = statSync(target);

    return request.path_kind === "directory"
      ? stats.isDirectory()
      : stats.isFile();
  } catch {
    return false;
  }
}

function nodePackageManagerVersionProbe(
  request: DoctorRuntimeVersionProbeRequest,
): DoctorRuntimeVersionProbeResult {
  for (const packageManager of request.package_manager_ids) {
    const version = readVersion(packageManager, request.timeout_ms);

    if (version) {
      return {
        available: true,
        detected_package_manager: packageManager,
        version_label: version,
        metadata_only: true,
        read_only: true,
        bounded: true,
        shell_execution_enabled: false,
        network_call_enabled: false,
        provider_call_enabled: false,
        install_action_enabled: false,
        mutation_enabled: false,
      };
    }
  }

  return {
    available: false,
    detected_package_manager: null,
    version_label: null,
    metadata_only: true,
    read_only: true,
    bounded: true,
    shell_execution_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
  };
}

function readVersion(binary: string, timeoutMs: number): string | null {
  try {
    return execFileSync(binary, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: timeoutMs,
    }).trim();
  } catch {
    return null;
  }
}

function providerStatuses(
  defaults: BootstrapEnvironmentSnapshot["defaults"]["realProvidersEnabled"],
): DoctorInspectionReport["providers"] {
  return Object.fromEntries(
    Object.entries(defaults).map(([provider, enabled]) => [
      provider,
      enabled ? "enabled" : "disabled",
    ]),
  ) as DoctorInspectionReport["providers"];
}

function readPnpmVersion(): string | null {
  return readVersion("pnpm", 1000);
}

function readAvailableDiskBytes(): number | null {
  try {
    const stats = statfsSync(process.cwd());
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

function formatGib(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  const currentFile = fileURLToPath(import.meta.url);

  if (process.argv[1] === currentFile) {
    return true;
  }

  if (!existsSync(process.argv[1])) {
    return false;
  }

  return process.argv[1].endsWith("doctor.ts");
}

if (isDirectCliInvocation()) {
  runDoctorCli();
}
