import { describe, expect, it } from "vitest";

import {
  createBootstrapContract,
  createValidBootstrapSnapshot,
  type BootstrapEnvironmentSnapshot,
} from "../scripts/bootstrap-contract";
import {
  DOCTOR_READ_ONLY_EFFECTS,
  createDoctorReport,
  inspectDoctorEnvironment,
  renderDoctorSummary,
  type DoctorHostProbe,
} from "../scripts/doctor";

const GIB = 1024 * 1024 * 1024;

function healthySnapshot(): BootstrapEnvironmentSnapshot {
  return createValidBootstrapSnapshot(createBootstrapContract());
}

function probeFor(
  snapshot: BootstrapEnvironmentSnapshot,
  diskBytes: number | null = snapshot.availableDiskBytes,
): DoctorHostProbe {
  return {
    osFamily: () => snapshot.osFamily,
    nodeVersion: () => snapshot.nodeVersion,
    pnpmVersion: () => snapshot.pnpmVersion,
    availableMemoryBytes: () => snapshot.availableMemoryBytes,
    availableDiskBytes: () => diskBytes,
    env: () => snapshot.env,
  };
}

describe("Phase 10A.2 local doctor command", () => {
  it("returns pass for a healthy local environment snapshot", () => {
    const report = createDoctorReport(healthySnapshot());

    expect(report).toMatchObject({
      status: "pass",
      validationReasons: [],
      warnings: [],
      effects: DOCTOR_READ_ONLY_EFFECTS,
    });
  });

  it("reports missing env vars without exposing values", () => {
    const snapshot = healthySnapshot();
    const secretValue = "sk-secret-value-that-must-not-render";
    const report = createDoctorReport({
      ...snapshot,
      env: {
        ...snapshot.env,
        JARVIS_LOCAL_ONLY: secretValue,
        JARVIS_REAL_PROVIDERS_ENABLED: undefined,
      },
    });
    const summary = renderDoctorSummary(report);

    expect(report).toMatchObject({
      status: "fail",
      env: {
        missing: ["JARVIS_REAL_PROVIDERS_ENABLED"],
      },
      validationReasons: expect.arrayContaining(["missing_env_vars"]),
    });
    expect(summary).toContain("JARVIS_LOCAL_ONLY: present");
    expect(summary).toContain("JARVIS_REAL_PROVIDERS_ENABLED: missing");
    expect(summary).not.toContain(secretValue);
  });

  it("returns fail for unsupported OS", () => {
    const report = createDoctorReport({
      ...healthySnapshot(),
      osFamily: "windows",
    });

    expect(report).toMatchObject({
      status: "fail",
      validationReasons: expect.arrayContaining(["unsupported_os"]),
    });
  });

  it("returns fail for insufficient memory", () => {
    const report = createDoctorReport({
      ...healthySnapshot(),
      availableMemoryBytes: 4 * GIB,
    });

    expect(report).toMatchObject({
      status: "fail",
      validationReasons: expect.arrayContaining(["insufficient_memory"]),
    });
  });

  it("returns fail for insufficient disk and warn when disk cannot be inspected", () => {
    const contract = createBootstrapContract();
    const insufficientDisk = createDoctorReport({
      ...healthySnapshot(),
      availableDiskBytes: contract.resources.minAvailableDiskBytes - 1,
    });
    const unavailableDisk = inspectDoctorEnvironment(
      probeFor(healthySnapshot(), null),
      contract,
    );

    expect(insufficientDisk).toMatchObject({
      status: "fail",
      validationReasons: expect.arrayContaining(["insufficient_disk"]),
    });
    expect(unavailableDisk).toMatchObject({
      status: "warn",
      warnings: ["disk_unavailable"],
    });
  });

  it("keeps provider defaults disabled", () => {
    const report = createDoctorReport(healthySnapshot());

    expect(report.providers).toEqual({
      openai: "disabled",
      anthropic: "disabled",
      ollama: "disabled",
      whisper: "disabled",
      piper: "disabled",
      hue: "disabled",
      camera: "disabled",
    });
  });

  it("has read-only effects and no mutation helper surface", async () => {
    const doctorModule = await import("../scripts/doctor");
    const exportedNames = Object.keys(doctorModule);

    expect(createDoctorReport(healthySnapshot()).effects).toEqual({
      installed: false,
      mutatedMachine: false,
      networkCalled: false,
      providerContacted: false,
      portProbed: false,
      roomAdapterAdded: false,
      uiRendered: false,
    });
    expect(
      exportedNames.some((name) => /install|fix|repair|mutate/i.test(name)),
    ).toBe(false);
  });

  it("renders a readable CLI summary without secrets or port probing claims", () => {
    const snapshot = healthySnapshot();
    const report = createDoctorReport({
      ...snapshot,
      env: {
        ...snapshot.env,
        JARVIS_LOCAL_ONLY: "true-but-hidden",
      },
    });
    const summary = renderDoctorSummary(report);

    expect(summary).toContain("JARVIS Local Doctor");
    expect(summary).toContain("Status: PASS");
    expect(summary).toContain(
      "Required local ports (declared only; not probed)",
    );
    expect(summary).toContain("next_dev_server");
    expect(summary).toContain("port probing: false");
    expect(summary).not.toContain("true-but-hidden");
  });
});
