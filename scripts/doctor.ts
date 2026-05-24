import { execFileSync } from "node:child_process";
import { existsSync, statfsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { freemem, platform } from "node:os";
import process from "node:process";

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
      ...report.validationReasons.map((r) => `- ${r}`),
    );
  }
  if (report.warnings.length > 0) {
    lines.push("", "Warnings", ...report.warnings.map((r) => `- ${r}`));
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

export function runDoctorCli(): DoctorInspectionReport {
  const report = inspectDoctorEnvironment();
  console.log(renderDoctorSummary(report));
  process.exitCode = report.status === "fail" ? 1 : 0;
  return report;
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
  try {
    return execFileSync("pnpm", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
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
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("doctor.ts");
}

if (isDirectCliInvocation()) {
  runDoctorCli();
}
