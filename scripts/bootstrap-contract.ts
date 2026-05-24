export type BootstrapOsFamily = "macos" | "linux" | "windows" | "unknown";

export type BootstrapProviderId =
  | "openai"
  | "anthropic"
  | "ollama"
  | "whisper"
  | "piper"
  | "hue"
  | "camera";

export type BootstrapEnvVarName =
  | "JARVIS_LOCAL_ONLY"
  | "JARVIS_REAL_PROVIDERS_ENABLED"
  | "JARVIS_CLOUD_PROVIDERS_ENABLED"
  | "JARVIS_ROOM_REAL_ADAPTERS_ENABLED"
  | "JARVIS_VOICE_REAL_PROVIDERS_ENABLED"
  | "JARVIS_VISION_REAL_PROVIDERS_ENABLED"
  | "JARVIS_REMOTE_DASHBOARD_ENABLED";

export type BootstrapValidationReason =
  | "unsupported_os"
  | "node_version_too_low"
  | "pnpm_missing"
  | "pnpm_version_too_low"
  | "insufficient_memory"
  | "insufficient_disk"
  | "missing_env_vars"
  | "real_provider_enabled"
  | "local_only_disabled"
  | "remote_dashboard_enabled"
  | "contract_not_descriptive";

export interface BootstrapPortRequirement {
  readonly id: string;
  readonly port: number;
  readonly protocol: "http" | "ws";
  readonly bind: "127.0.0.1" | "localhost";
  readonly required: boolean;
  readonly purpose: string;
}

export interface BootstrapContract {
  readonly id: "jarvis.phase_10a_1.bootstrap_contract";
  readonly phase: "10A.1";
  readonly description: string;
  readonly supportedOsFamilies: readonly BootstrapOsFamily[];
  readonly node: {
    readonly minMajor: number;
    readonly minVersion: string;
  };
  readonly pnpm: {
    readonly required: true;
    readonly minMajor: number;
    readonly minVersion: string;
  };
  readonly resources: {
    readonly minAvailableMemoryBytes: number;
    readonly minAvailableDiskBytes: number;
  };
  readonly ports: readonly BootstrapPortRequirement[];
  readonly env: {
    readonly requiredNames: readonly BootstrapEnvVarName[];
  };
  readonly defaults: {
    readonly localOnly: true;
    readonly remoteDashboardEnabled: false;
    readonly realProvidersEnabled: Readonly<Record<BootstrapProviderId, false>>;
  };
  readonly posture: {
    readonly descriptiveOnly: true;
    readonly performsInstall: false;
    readonly mutatesMachine: false;
    readonly performsNetworkCalls: false;
    readonly wiresRealProviders: false;
    readonly wiresRoomAdapters: false;
    readonly rendersUi: false;
    readonly addsAuthoritySurface: false;
  };
}

export interface BootstrapEnvironmentSnapshot {
  readonly osFamily: BootstrapOsFamily;
  readonly nodeVersion: string;
  readonly pnpmVersion: string | null;
  readonly availableMemoryBytes: number;
  readonly availableDiskBytes: number;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly defaults: {
    readonly localOnly: boolean;
    readonly remoteDashboardEnabled: boolean;
    readonly realProvidersEnabled: Readonly<
      Record<BootstrapProviderId, boolean>
    >;
  };
  readonly posture?: Partial<
    Record<keyof BootstrapContract["posture"], boolean>
  >;
}

export interface BootstrapContractValidation {
  readonly passed: boolean;
  readonly reasons: BootstrapValidationReason[];
  readonly missingEnvVars: BootstrapEnvVarName[];
  readonly enabledRealProviders: BootstrapProviderId[];
  readonly requiredPorts: readonly BootstrapPortRequirement[];
  readonly checkedEnvVars: readonly BootstrapEnvVarName[];
  readonly descriptiveOnly: boolean;
  readonly mutationPerformed: false;
  readonly networkCalled: false;
}

const GIB = 1024 * 1024 * 1024;

export const DEFAULT_BOOTSTRAP_REQUIRED_ENV_VARS = [
  "JARVIS_LOCAL_ONLY",
  "JARVIS_REAL_PROVIDERS_ENABLED",
  "JARVIS_CLOUD_PROVIDERS_ENABLED",
  "JARVIS_ROOM_REAL_ADAPTERS_ENABLED",
  "JARVIS_VOICE_REAL_PROVIDERS_ENABLED",
  "JARVIS_VISION_REAL_PROVIDERS_ENABLED",
  "JARVIS_REMOTE_DASHBOARD_ENABLED",
] as const satisfies readonly BootstrapEnvVarName[];

export const DEFAULT_BOOTSTRAP_PORTS = [
  {
    id: "next_dev_server",
    port: 3000,
    protocol: "http",
    bind: "localhost",
    required: true,
    purpose: "Next.js local application surface",
  },
  {
    id: "local_service_loopback",
    port: 4317,
    protocol: "http",
    bind: "127.0.0.1",
    required: true,
    purpose: "Future local telemetry/service loopback slot",
  },
] as const satisfies readonly BootstrapPortRequirement[];

export function createBootstrapContract(): BootstrapContract {
  return {
    id: "jarvis.phase_10a_1.bootstrap_contract",
    phase: "10A.1",
    description:
      "Descriptive local environment contract for JARVIS operationalization substrate work.",
    supportedOsFamilies: ["macos", "linux"],
    node: {
      minMajor: 20,
      minVersion: "20.0.0",
    },
    pnpm: {
      required: true,
      minMajor: 9,
      minVersion: "9.0.0",
    },
    resources: {
      minAvailableMemoryBytes: 8 * GIB,
      minAvailableDiskBytes: 10 * GIB,
    },
    ports: DEFAULT_BOOTSTRAP_PORTS,
    env: {
      requiredNames: DEFAULT_BOOTSTRAP_REQUIRED_ENV_VARS,
    },
    defaults: {
      localOnly: true,
      remoteDashboardEnabled: false,
      realProvidersEnabled: {
        openai: false,
        anthropic: false,
        ollama: false,
        whisper: false,
        piper: false,
        hue: false,
        camera: false,
      },
    },
    posture: {
      descriptiveOnly: true,
      performsInstall: false,
      mutatesMachine: false,
      performsNetworkCalls: false,
      wiresRealProviders: false,
      wiresRoomAdapters: false,
      rendersUi: false,
      addsAuthoritySurface: false,
    },
  };
}

export function validateBootstrapContract(
  snapshot: BootstrapEnvironmentSnapshot,
  contract: BootstrapContract = createBootstrapContract(),
): BootstrapContractValidation {
  const reasons = new Set<BootstrapValidationReason>();
  const missingEnvVars = contract.env.requiredNames.filter(
    (name) => snapshot.env[name] === undefined,
  );
  const enabledRealProviders = Object.entries(
    snapshot.defaults.realProvidersEnabled,
  )
    .filter(([, enabled]) => enabled)
    .map(([provider]) => provider as BootstrapProviderId);
  const posture = { ...contract.posture, ...snapshot.posture };

  if (!contract.supportedOsFamilies.includes(snapshot.osFamily)) {
    reasons.add("unsupported_os");
  }
  if (majorVersion(snapshot.nodeVersion) < contract.node.minMajor) {
    reasons.add("node_version_too_low");
  }
  if (snapshot.pnpmVersion === null) {
    reasons.add("pnpm_missing");
  } else if (majorVersion(snapshot.pnpmVersion) < contract.pnpm.minMajor) {
    reasons.add("pnpm_version_too_low");
  }
  if (
    snapshot.availableMemoryBytes < contract.resources.minAvailableMemoryBytes
  ) {
    reasons.add("insufficient_memory");
  }
  if (snapshot.availableDiskBytes < contract.resources.minAvailableDiskBytes) {
    reasons.add("insufficient_disk");
  }
  if (missingEnvVars.length > 0) {
    reasons.add("missing_env_vars");
  }
  if (enabledRealProviders.length > 0) {
    reasons.add("real_provider_enabled");
  }
  if (!snapshot.defaults.localOnly) {
    reasons.add("local_only_disabled");
  }
  if (snapshot.defaults.remoteDashboardEnabled) {
    reasons.add("remote_dashboard_enabled");
  }
  if (!isDescriptivePosture(posture)) {
    reasons.add("contract_not_descriptive");
  }

  return {
    passed: reasons.size === 0,
    reasons: [...reasons],
    missingEnvVars,
    enabledRealProviders,
    requiredPorts: contract.ports,
    checkedEnvVars: contract.env.requiredNames,
    descriptiveOnly: isDescriptivePosture(posture),
    mutationPerformed: false,
    networkCalled: false,
  };
}

export function createValidBootstrapSnapshot(
  contract: BootstrapContract = createBootstrapContract(),
): BootstrapEnvironmentSnapshot {
  return {
    osFamily: "macos",
    nodeVersion: contract.node.minVersion,
    pnpmVersion: contract.pnpm.minVersion,
    availableMemoryBytes: contract.resources.minAvailableMemoryBytes,
    availableDiskBytes: contract.resources.minAvailableDiskBytes,
    env: Object.fromEntries(
      contract.env.requiredNames.map((name) => [
        name,
        safeDefaultEnvValue(name),
      ]),
    ),
    defaults: {
      localOnly: contract.defaults.localOnly,
      remoteDashboardEnabled: contract.defaults.remoteDashboardEnabled,
      realProvidersEnabled: contract.defaults.realProvidersEnabled,
    },
  };
}

function majorVersion(version: string): number {
  const normalized = version.trim().replace(/^v/i, "");
  const major = Number.parseInt(normalized.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : 0;
}

function safeDefaultEnvValue(name: BootstrapEnvVarName): string {
  return name === "JARVIS_LOCAL_ONLY" ? "true" : "false";
}

function isDescriptivePosture(
  posture: Partial<Record<keyof BootstrapContract["posture"], boolean>>,
) {
  return (
    posture.descriptiveOnly === true &&
    posture.performsInstall === false &&
    posture.mutatesMachine === false &&
    posture.performsNetworkCalls === false &&
    posture.wiresRealProviders === false &&
    posture.wiresRoomAdapters === false &&
    posture.rendersUi === false &&
    posture.addsAuthoritySurface === false
  );
}
