import { describe, expect, it } from "vitest";

import {
  createBootstrapContract,
  createValidBootstrapSnapshot,
  validateBootstrapContract,
  type BootstrapEnvVarName,
} from "../scripts/bootstrap-contract";

describe("Phase 10A.1 bootstrap contract", () => {
  it("passes a valid descriptive local contract snapshot", () => {
    const contract = createBootstrapContract();
    const snapshot = createValidBootstrapSnapshot(contract);

    expect(validateBootstrapContract(snapshot, contract)).toMatchObject({
      passed: true,
      reasons: [],
      mutationPerformed: false,
      networkCalled: false,
      descriptiveOnly: true,
    });
  });

  it("reports missing required env vars", () => {
    const contract = createBootstrapContract();
    const snapshot = createValidBootstrapSnapshot(contract);
    const missingName = "JARVIS_LOCAL_ONLY" satisfies BootstrapEnvVarName;

    const validation = validateBootstrapContract(
      {
        ...snapshot,
        env: {
          ...snapshot.env,
          [missingName]: undefined,
        },
      },
      contract,
    );

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["missing_env_vars"]),
      missingEnvVars: [missingName],
    });
  });

  it("rejects unsupported OS families", () => {
    const contract = createBootstrapContract();

    expect(
      validateBootstrapContract(
        {
          ...createValidBootstrapSnapshot(contract),
          osFamily: "windows",
        },
        contract,
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["unsupported_os"]),
    });
  });

  it("rejects insufficient memory", () => {
    const contract = createBootstrapContract();

    expect(
      validateBootstrapContract(
        {
          ...createValidBootstrapSnapshot(contract),
          availableMemoryBytes: contract.resources.minAvailableMemoryBytes - 1,
        },
        contract,
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["insufficient_memory"]),
    });
  });

  it("rejects insufficient disk space", () => {
    const contract = createBootstrapContract();

    expect(
      validateBootstrapContract(
        {
          ...createValidBootstrapSnapshot(contract),
          availableDiskBytes: contract.resources.minAvailableDiskBytes - 1,
        },
        contract,
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["insufficient_disk"]),
    });
  });

  it("represents required local ports without probing them", () => {
    const contract = createBootstrapContract();
    const validation = validateBootstrapContract(
      createValidBootstrapSnapshot(contract),
      contract,
    );

    expect(validation.requiredPorts).toEqual([
      expect.objectContaining({
        id: "next_dev_server",
        port: 3000,
        bind: "localhost",
        required: true,
      }),
      expect.objectContaining({
        id: "local_service_loopback",
        port: 4317,
        bind: "127.0.0.1",
        required: true,
      }),
    ]);
  });

  it("keeps all real providers disabled by default", () => {
    const contract = createBootstrapContract();

    expect(contract.defaults.realProvidersEnabled).toEqual({
      openai: false,
      anthropic: false,
      ollama: false,
      whisper: false,
      piper: false,
      hue: false,
      camera: false,
    });
    expect(
      validateBootstrapContract(
        {
          ...createValidBootstrapSnapshot(contract),
          defaults: {
            ...contract.defaults,
            realProvidersEnabled: {
              ...contract.defaults.realProvidersEnabled,
              hue: true,
            },
          },
        },
        contract,
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["real_provider_enabled"]),
      enabledRealProviders: ["hue"],
    });
  });

  it("is descriptive only and performs no mutation", () => {
    const contract = createBootstrapContract();

    expect(contract.posture).toEqual({
      descriptiveOnly: true,
      performsInstall: false,
      mutatesMachine: false,
      performsNetworkCalls: false,
      wiresRealProviders: false,
      wiresRoomAdapters: false,
      rendersUi: false,
      addsAuthoritySurface: false,
    });
    expect(
      validateBootstrapContract(
        {
          ...createValidBootstrapSnapshot(contract),
          posture: {
            mutatesMachine: true,
          },
        },
        contract,
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["contract_not_descriptive"]),
      mutationPerformed: false,
      networkCalled: false,
    });
  });
});
