import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { ModelTierSchema } from "./schema";
import type { ModelRegistryEntry } from "./types";

export const DEFAULT_RESERVED_RAM_GB = 6;

export const HARDWARE_FIT_BUCKETS = [
  "comfortable",
  "tight",
  "risky",
  "wont_fit",
] as const;

export const HARDWARE_PLATFORMS = ["darwin", "win32", "linux"] as const;
export const HARDWARE_ARCHITECTURES = ["arm64", "x64"] as const;

export type HardwareFitBucket = (typeof HARDWARE_FIT_BUCKETS)[number];
export type HardwarePlatform = (typeof HARDWARE_PLATFORMS)[number];
export type HardwareArchitecture = (typeof HARDWARE_ARCHITECTURES)[number];

export const HardwareFitBucketSchema = z.enum(HARDWARE_FIT_BUCKETS);
export const HardwarePlatformSchema = z.enum(HARDWARE_PLATFORMS);
export const HardwareArchitectureSchema = z.enum(HARDWARE_ARCHITECTURES);

export const HardwareOverrideSchema = z.strictObject({
  vramGb: z.number().nonnegative().nullable().optional(),
  reservedRamGb: z.number().nonnegative().optional(),
});

export const HardwareConfigSchema = z.strictObject({
  hardware: HardwareOverrideSchema.optional(),
});

export const HardwareProfileSchema = z.strictObject({
  totalRamGb: z.number().nonnegative(),
  freeRamGb: z.number().nonnegative(),
  platform: HardwarePlatformSchema,
  arch: HardwareArchitectureSchema,
  unifiedMemory: z.boolean(),
  metal: z.boolean(),
  vramGb: z.number().nonnegative().nullable(),
  reservedRamGb: z.number().nonnegative(),
});

export const HardwareFitScoreSchema = z.strictObject({
  footprintGb: z.number().nonnegative(),
  budgetGb: z.number(),
  ratio: z.number(),
  bucket: HardwareFitBucketSchema,
});

export const ModelHardwareFitRecommendationSchema = z.strictObject({
  id: z.string().trim().min(1).max(160),
  tier: ModelTierSchema,
  params_b: z.number().positive(),
  quant: z.string().trim().min(1).max(40),
  contextWindow: z.number().int().positive(),
  footprintGb: z.number().nonnegative(),
  budgetGb: z.number(),
  ratio: z.number(),
  bucket: HardwareFitBucketSchema,
});

export const ModelHardwareFitSkippedSchema = z.strictObject({
  id: z.string().trim().min(1).max(160),
  tier: ModelTierSchema,
  note: z.string().trim().min(1).max(220),
});

export const ModelHardwareFitTierGroupSchema = z.strictObject({
  tier: ModelTierSchema,
  recommendations: z.array(ModelHardwareFitRecommendationSchema),
});

export const ModelHardwareFitReportSchema = z.strictObject({
  hardware_profile: HardwareProfileSchema,
  recommendations: z.array(ModelHardwareFitRecommendationSchema),
  recommendations_by_tier: z.array(ModelHardwareFitTierGroupSchema),
  skipped: z.array(ModelHardwareFitSkippedSchema),
  summary: z.string().trim().min(1).max(420),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  advisory_only: z.literal(true),
  model_download_enabled: z.literal(false),
  registry_mutation_enabled: z.literal(false),
  ollama_config_mutation_enabled: z.literal(false),
  env_var_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
});

export type HardwareOverride = z.infer<typeof HardwareOverrideSchema>;
export type HardwareProfile = z.infer<typeof HardwareProfileSchema>;
export type HardwareFitScore = z.infer<typeof HardwareFitScoreSchema>;
export type ModelHardwareFitRecommendation = z.infer<
  typeof ModelHardwareFitRecommendationSchema
>;
export type ModelHardwareFitSkipped = z.infer<
  typeof ModelHardwareFitSkippedSchema
>;
export type ModelHardwareFitReport = z.infer<
  typeof ModelHardwareFitReportSchema
>;

export function parseHardwareConfigYaml(yamlText: string): HardwareOverride {
  const parsed = HardwareConfigSchema.parse(parseYaml(yamlText) ?? {});

  return HardwareOverrideSchema.parse(parsed.hardware ?? {});
}

export function buildHardwareProfile(input: {
  totalRamBytes: number;
  freeRamBytes: number;
  platform: string;
  arch: string;
  overrides?: HardwareOverride;
}): HardwareProfile {
  const platform = normalizePlatform(input.platform);
  const arch = normalizeArch(input.arch);
  const unifiedMemory = platform === "darwin" && arch === "arm64";
  const overrides = HardwareOverrideSchema.parse(input.overrides ?? {});

  return HardwareProfileSchema.parse({
    totalRamGb: bytesToGb(input.totalRamBytes),
    freeRamGb: bytesToGb(input.freeRamBytes),
    platform,
    arch,
    unifiedMemory,
    metal: unifiedMemory,
    vramGb: overrides.vramGb ?? null,
    reservedRamGb: overrides.reservedRamGb ?? DEFAULT_RESERVED_RAM_GB,
  });
}

export function estimateFootprintGb(
  paramsB: number,
  quant: string,
  contextWindow: number,
): number {
  const bytesPerParamGb = bytesPerParamForQuant(quant);
  const baseWeightsGb = paramsB * bytesPerParamGb;
  const runtimeOverheadGb = baseWeightsGb * 0.15;
  const kvCacheGb = (contextWindow / 8192) * 0.7;

  return roundGb(baseWeightsGb + runtimeOverheadGb + kvCacheGb);
}

export function scoreFit(
  footprintGb: number,
  profile: HardwareProfile,
): HardwareFitScore {
  // E-034 (Phase 25D): on Apple unified memory the pool is the WHOLE
  // unified budget — macOS reports os.freemem() ≈ 0 because it keeps memory
  // in file cache/compressed pools, which made every model "wont_fit" on the
  // M1 Max. The OS + app share is carried by reservedRamGb (config/
  // hardware.yaml), not by a free-memory sample. Discrete-GPU profiles keep
  // vramGb, and non-unified profiles keep the free-RAM sample as before.
  const memoryPoolGb = profile.unifiedMemory
    ? profile.totalRamGb
    : (profile.vramGb ?? profile.freeRamGb);
  const budgetGb = roundGb(memoryPoolGb - profile.reservedRamGb);
  const ratio = budgetGb > 0 ? roundRatio(footprintGb / budgetGb) : 999.999;

  return HardwareFitScoreSchema.parse({
    footprintGb: roundGb(footprintGb),
    budgetGb,
    ratio,
    bucket: bucketForRatio(ratio),
  });
}

export function evaluateLocalModelHardwareFit(
  entries: readonly ModelRegistryEntry[],
  profile: HardwareProfile,
): ModelHardwareFitReport {
  const recommendations: ModelHardwareFitRecommendation[] = [];
  const skipped: ModelHardwareFitSkipped[] = [];

  for (const entry of entries) {
    if (entry.visibility !== "enabled" || entry.runtime_class !== "local") {
      continue;
    }

    if (entry.params_b === undefined || entry.quant === undefined) {
      skipped.push(
        ModelHardwareFitSkippedSchema.parse({
          id: entry.id,
          tier: entry.tier,
          note: "Missing params_b or quant metadata; model fit was not scored.",
        }),
      );
      continue;
    }

    const footprintGb = estimateFootprintGb(
      entry.params_b,
      entry.quant,
      entry.context_window,
    );
    const score = scoreFit(footprintGb, profile);

    recommendations.push(
      ModelHardwareFitRecommendationSchema.parse({
        id: entry.id,
        tier: entry.tier,
        params_b: entry.params_b,
        quant: entry.quant,
        contextWindow: entry.context_window,
        ...score,
      }),
    );
  }

  const ranked = recommendations.sort(compareRecommendation);

  return ModelHardwareFitReportSchema.parse({
    hardware_profile: profile,
    recommendations: ranked,
    recommendations_by_tier: recommendationsByTier(ranked),
    skipped,
    summary: summarizeHardwareFit(ranked, skipped),
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
}

function recommendationsByTier(
  recommendations: readonly ModelHardwareFitRecommendation[],
) {
  const tiers = Array.from(new Set(recommendations.map((row) => row.tier)));

  return tiers.map((tier) =>
    ModelHardwareFitTierGroupSchema.parse({
      tier,
      recommendations: recommendations.filter((row) => row.tier === tier),
    }),
  );
}

function summarizeHardwareFit(
  recommendations: readonly ModelHardwareFitRecommendation[],
  skipped: readonly ModelHardwareFitSkipped[],
): string {
  if (recommendations.length === 0) {
    return skipped.length === 0
      ? "No enabled local models are available for hardware-fit scoring."
      : `${skipped.length} enabled local model${skipped.length === 1 ? "" : "s"} skipped because params_b or quant metadata is missing.`;
  }

  const best = recommendations[0];

  return `Best local fit: ${best.id} is ${best.bucket} (${best.footprintGb.toFixed(1)} GB footprint, ${best.budgetGb.toFixed(1)} GB budget).`;
}

function compareRecommendation(
  left: ModelHardwareFitRecommendation,
  right: ModelHardwareFitRecommendation,
) {
  return (
    tierRank(left.tier) - tierRank(right.tier) ||
    bucketRank(left.bucket) - bucketRank(right.bucket) ||
    left.ratio - right.ratio ||
    left.id.localeCompare(right.id)
  );
}

function tierRank(tier: string): number {
  return ["T1", "T2", "T3", "T4"].indexOf(tier);
}

function bucketRank(bucket: HardwareFitBucket): number {
  return HARDWARE_FIT_BUCKETS.indexOf(bucket);
}

function bucketForRatio(ratio: number): HardwareFitBucket {
  if (ratio < 0.6) return "comfortable";
  if (ratio <= 0.9) return "tight";
  if (ratio <= 1.1) return "risky";
  return "wont_fit";
}

function bytesPerParamForQuant(quant: string): number {
  const normalized = quant.toLowerCase();

  if (normalized.includes("fp16") || normalized.includes("bf16")) {
    return 2;
  }

  if (
    normalized.includes("q8") ||
    normalized.includes("8_") ||
    normalized.includes("fp8")
  ) {
    return 1;
  }

  if (
    normalized.includes("q4") ||
    normalized.includes("4_") ||
    normalized.includes("fp4") || // E-035: Ollama MLX artifacts ship nvfp4
    normalized.includes("awq") ||
    normalized.includes("gptq")
  ) {
    return 0.5;
  }

  return 1;
}

function normalizePlatform(value: string): HardwarePlatform {
  if (value === "darwin" || value === "win32" || value === "linux") {
    return value;
  }

  return "linux";
}

function normalizeArch(value: string): HardwareArchitecture {
  return value === "arm64" ? "arm64" : "x64";
}

function bytesToGb(bytes: number): number {
  return roundGb(bytes / 1024 ** 3);
}

function roundGb(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
