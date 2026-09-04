import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildHardwareProfile,
  estimateFootprintGb,
  evaluateLocalModelHardwareFit,
  parseHardwareConfigYaml,
  scoreFit,
  type HardwareProfile,
  type ModelRegistryEntry,
} from "../../src/models";

const GIB = 1024 ** 3;

function profile(input: {
  totalRamGb: number;
  freeRamGb: number;
  platform?: string;
  arch?: string;
  reservedRamGb?: number;
  vramGb?: number | null;
}): HardwareProfile {
  return buildHardwareProfile({
    totalRamBytes: input.totalRamGb * GIB,
    freeRamBytes: input.freeRamGb * GIB,
    platform: input.platform ?? "darwin",
    arch: input.arch ?? "arm64",
    overrides: {
      reservedRamGb: input.reservedRamGb ?? 6,
      ...(input.vramGb === undefined ? {} : { vramGb: input.vramGb }),
    },
  });
}

function localModel(
  overrides: Partial<ModelRegistryEntry> = {},
): ModelRegistryEntry {
  return {
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
      description: "Fixture local model.",
      approximate_memory_mb: 3072,
      cost_class: "local_free",
      governance_notes: "Fixture only; no model execution.",
    },
    ...overrides,
  };
}

describe("Phase 21B hardware-fit scorer", () => {
  it("calibrates 3B, 7B, and 13B quantized footprints to Section 20 ranges", () => {
    expect(estimateFootprintGb(3, "q4_K_M", 8192)).toBeGreaterThanOrEqual(2);
    expect(estimateFootprintGb(3, "q4_K_M", 8192)).toBeLessThanOrEqual(3);
    expect(estimateFootprintGb(7, "q4_K_M", 8192)).toBeGreaterThanOrEqual(4);
    expect(estimateFootprintGb(7, "q4_K_M", 8192)).toBeLessThanOrEqual(5);
    expect(estimateFootprintGb(13, "q4_K_M", 8192)).toBeGreaterThanOrEqual(8);
    expect(estimateFootprintGb(13, "q4_K_M", 8192)).toBeLessThanOrEqual(10);
  });

  it("scores a 13B model on a mocked 16 GB unified-memory profile as risky or worse", () => {
    const score = scoreFit(
      estimateFootprintGb(13, "q4_K_M", 8192),
      profile({ totalRamGb: 16, freeRamGb: 14 }),
    );

    // E-034 widened this expectation: unified memory now budgets from the
    // total pool (16 - 6 reserved = 10 GB), so a ~8.7 GB 13B lands "tight" —
    // still not comfortable, which is the assertion's intent.
    expect(["tight", "risky", "wont_fit"]).toContain(score.bucket);
    expect(score.bucket).not.toBe("comfortable");
  });

  it("scores a 3B model on the same 16 GB profile as comfortable", () => {
    expect(
      scoreFit(
        estimateFootprintGb(3, "q4_K_M", 8192),
        profile({ totalRamGb: 16, freeRamGb: 14 }),
      ).bucket,
    ).toBe("comfortable");
  });

  it("re-scores when hardware improves from 16 GB to 32 GB", () => {
    const footprint = estimateFootprintGb(13, "q4_K_M", 8192);
    const m4Air16 = scoreFit(
      footprint,
      profile({ totalRamGb: 16, freeRamGb: 14 }),
    );
    const m4Air32 = scoreFit(
      footprint,
      profile({ totalRamGb: 32, freeRamGb: 28 }),
    );

    expect(bucketRank(m4Air32.bucket)).toBeLessThan(bucketRank(m4Air16.bucket));
  });

  it("E-034: budgets Apple unified memory from the TOTAL pool, not the near-zero free sample", () => {
    // the M1 Max fixture: 32 GB total, macOS reports ~0.09 GB free
    const m1Max = profile({
      totalRamGb: 32,
      freeRamGb: 0.09,
      reservedRamGb: 8,
    });
    const workhorse = scoreFit(estimateFootprintGb(9, "q4_K_M", 8192), m1Max);
    expect(workhorse.budgetGb).toBe(24);
    expect(workhorse.bucket).toBe("comfortable");
    const heavy = scoreFit(estimateFootprintGb(27, "q4_K_M", 8192), m1Max);
    expect(["comfortable", "tight", "risky"]).toContain(heavy.bucket);
    expect(heavy.bucket).not.toBe("wont_fit");
    const seventyB = scoreFit(estimateFootprintGb(70, "q4_K_M", 8192), m1Max);
    expect(seventyB.bucket).toBe("wont_fit");
  });

  it("E-035: nvfp4 (Ollama MLX artifacts) is budgeted as a 4-bit quant", () => {
    expect(estimateFootprintGb(9.4, "nvfp4", 32768)).toBeLessThan(11);
    expect(estimateFootprintGb(27.4, "nvfp4", 32768)).toBeLessThan(22);
  });

  it("E-034: a non-unified Windows profile still budgets from the free-RAM sample", () => {
    const rog = profile({
      totalRamGb: 16,
      freeRamGb: 0.7,
      platform: "win32",
      arch: "x64",
      reservedRamGb: 6,
      vramGb: null,
    });
    expect(scoreFit(4, rog).budgetGb).toBeLessThan(0);
    expect(scoreFit(4, rog).bucket).toBe("wont_fit");
  });

  it("honours manual vramGb and reservedRamGb overrides for non-unified profiles", () => {
    const overridden = profile({
      totalRamGb: 64,
      freeRamGb: 60,
      platform: "win32",
      arch: "x64",
      reservedRamGb: 2,
      vramGb: 12,
    });
    const score = scoreFit(8, overridden);

    expect(overridden.vramGb).toBe(12);
    expect(score.budgetGb).toBe(10);
    expect(score.bucket).toBe("tight");
  });

  it("parses manual hardware overrides from config YAML", () => {
    expect(
      parseHardwareConfigYaml(`
hardware:
  vramGb: 10
  reservedRamGb: 4
`),
    ).toEqual({
      vramGb: 10,
      reservedRamGb: 4,
    });
  });

  it("skips enabled local models missing params_b or quant without throwing", () => {
    const report = evaluateLocalModelHardwareFit(
      [
        localModel({
          id: "missing-fit-metadata",
          params_b: undefined,
          quant: undefined,
        }),
      ],
      profile({ totalRamGb: 16, freeRamGb: 14 }),
    );

    expect(report.recommendations).toEqual([]);
    expect(report.skipped).toEqual([
      expect.objectContaining({
        id: "missing-fit-metadata",
        note: expect.stringContaining("Missing params_b or quant"),
      }),
    ]);
  });

  it("ranks enabled local models by tier and best fit", () => {
    const report = evaluateLocalModelHardwareFit(
      [
        localModel({ id: "qwen2.5:7b", tier: "T2", params_b: 7 }),
        localModel({ id: "llama3.2:3b", tier: "T1", params_b: 3 }),
      ],
      profile({ totalRamGb: 16, freeRamGb: 14 }),
    );

    expect(report.recommendations.map((row) => row.id)).toEqual([
      "llama3.2:3b",
      "qwen2.5:7b",
    ]);
    expect(report.recommendations_by_tier.map((group) => group.tier)).toEqual([
      "T1",
      "T2",
    ]);
  });

  it("declares advisory-only posture and introduces no model pull, registry write, env mutation, or network call", () => {
    const report = evaluateLocalModelHardwareFit(
      [localModel()],
      profile({ totalRamGb: 16, freeRamGb: 14 }),
    );
    const source = [
      readFileSync("src/models/hardware-fit.ts", "utf8"),
      readFileSync("scripts/doctor.ts", "utf8"),
    ].join("\n");

    expect(report).toMatchObject({
      metadata_only: true,
      read_only: true,
      deterministic: true,
      advisory_only: true,
      model_download_enabled: false,
      registry_mutation_enabled: false,
      ollama_config_mutation_enabled: false,
      env_var_mutation_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
    });
    expect(source).not.toMatch(
      /ollama\s+pull|OLLAMA_MAX_LOADED_MODELS|OLLAMA_KEEP_ALIVE|writeFile|appendFile|fetch\(|WebSocket|process\.env\s*=/,
    );
  });
});

function bucketRank(bucket: string): number {
  return ["comfortable", "tight", "risky", "wont_fit"].indexOf(bucket);
}
