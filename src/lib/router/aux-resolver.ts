import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";

import { models, type ModelEntry, type ModelTier } from "../models";
import { classifySafety } from "./safety";
import { selectModel } from "./selection";
import {
  AUX_TASK_KINDS,
  AuxRequirementSchema,
  AuxTaskKindSchema,
  type AuxModelPreference,
  type AuxModelResolution,
  type AuxQualityResult,
  type AuxRequirement,
  type AuxTaskKind,
} from "./aux-types";

export const DEFAULT_AUX_ROUTING_CONFIG_PATH = resolve(
  process.cwd(),
  "config/models/aux-routing.yaml",
);

export type AuxRoutingConfig = Readonly<
  Partial<Record<AuxTaskKind, AuxRequirement>>
>;

export interface ResolveAuxModelOptions {
  readonly config?: AuxRoutingConfig;
  readonly configPath?: string;
  readonly candidates?: readonly ModelEntry[];
  readonly fallbackModel?: ModelEntry;
  readonly logger?: (message: string) => void;
}

export interface EvaluateAuxOutputQualityOptions extends ResolveAuxModelOptions {
  readonly resolution: AuxModelResolution;
  readonly schemaValid: boolean;
}

const TIER_RANK: Record<ModelTier, number> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

const TASK_SAFETY_TEXT: Record<AuxTaskKind, string> = {
  session_title: "Create a metadata-only session title.",
  summary: "Summarize internal metadata without executing actions.",
  keyword_extract: "Extract metadata-only keywords.",
  paraphrase: "Paraphrase text without changing state.",
  vision_preprocess: "Preprocess vision metadata without retaining raw frames.",
  intent_assist: "Classify intent metadata without executing tools.",
};

export function resolveAuxModel(
  kind: AuxTaskKind,
  options: ResolveAuxModelOptions = {},
): AuxModelResolution {
  const parsedKind = AuxTaskKindSchema.parse(kind);
  const config = options.config ?? loadAuxRoutingConfig(options.configPath);
  const requirement = config[parsedKind];
  const logs: string[] = [];
  const fallback = options.fallbackModel ?? defaultMainModel();
  const safety = classifySafety([
    { role: "user", content: TASK_SAFETY_TEXT[parsedKind] },
  ]);

  if (!requirement) {
    const message = `[router/aux] missing aux routing config for ${parsedKind}; falling back to main model ${fallback.id}`;
    options.logger?.(message);
    logs.push(message);
    return {
      kind: parsedKind,
      requirement: requirementForFallback(fallback),
      safety,
      selection: {
        providerId: fallback.provider,
        model: fallback,
        reason: "Missing aux config; selected main model fallback.",
      },
      fallback_used: true,
      fallback_reason: "missing_config",
      logged: logs,
    };
  }

  const candidates = rankCandidates(
    clampCandidates(
      options.candidates ?? models.list((entry) => entry.enabled),
      requirement,
    ),
    requirement.prefer,
  );

  try {
    const selection = selectModel(
      {
        tier: requirement.minTier,
        requiredCapabilities: [...requirement.requires],
        reason: `Auxiliary ${parsedKind} requires ${requirement.requires.join(", ")}.`,
      },
      { candidates },
    );

    return {
      kind: parsedKind,
      requirement,
      safety,
      selection,
      fallback_used: false,
      fallback_reason: null,
      logged: logs,
    };
  } catch (error) {
    const message = `[router/aux] no capable aux model for ${parsedKind}; falling back to main model ${fallback.id}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    options.logger?.(message);
    logs.push(message);
    return {
      kind: parsedKind,
      requirement,
      safety,
      selection: {
        providerId: fallback.provider,
        model: fallback,
        reason: "No capable aux model; selected main model fallback.",
      },
      fallback_used: true,
      fallback_reason: "no_capable_model",
      logged: logs,
    };
  }
}

export function evaluateAuxOutputQuality(
  options: EvaluateAuxOutputQualityOptions,
): AuxQualityResult {
  if (options.schemaValid) {
    return {
      status: "accepted",
      kind: options.resolution.kind,
      model: options.resolution.selection.model,
    };
  }

  const currentTier = options.resolution.selection.model.tier;
  const maxTier = options.resolution.requirement.maxTier;
  const nextTier = nextTierWithinMax(currentTier, maxTier);
  if (!nextTier || nextTier === currentTier) {
    return {
      status: "blocked",
      kind: options.resolution.kind,
      reason: "schema_validation_failed_at_max_tier",
      model: options.resolution.selection.model,
      maxTier,
      silent: false,
    };
  }

  const escalated = resolveAuxModel(options.resolution.kind, {
    ...options,
    config: {
      ...(options.config ?? loadAuxRoutingConfig(options.configPath)),
      [options.resolution.kind]: {
        ...options.resolution.requirement,
        minTier: nextTier,
      },
    },
    fallbackModel: options.resolution.selection.model,
  });

  return {
    status: "escalated",
    kind: options.resolution.kind,
    reason: "schema_validation_failed",
    from_model: options.resolution.selection.model,
    to_model: escalated.selection.model,
    maxTier,
    silent: false,
  };
}

export function loadAuxRoutingConfig(
  configPath: string = DEFAULT_AUX_ROUTING_CONFIG_PATH,
): AuxRoutingConfig {
  if (!existsSync(configPath)) return {};
  return parseAuxRoutingConfig(readFileSync(configPath, "utf8"));
}

export function parseAuxRoutingConfig(yamlText: string): AuxRoutingConfig {
  const parsed = parse(yamlText) as unknown;
  if (!parsed || typeof parsed !== "object") return {};

  const config: Partial<Record<AuxTaskKind, AuxRequirement>> = {};
  for (const kind of AUX_TASK_KINDS) {
    const raw = (parsed as Record<string, unknown>)[kind];
    if (raw === undefined) continue;
    config[kind] = parseRequirement(kind, raw);
  }
  return config;
}

function parseRequirement(kind: AuxTaskKind, raw: unknown): AuxRequirement {
  const parsed = AuxRequirementSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid aux routing requirement for ${kind}.`);
  }
  if (TIER_RANK[parsed.data.minTier] > TIER_RANK[parsed.data.maxTier]) {
    throw new Error(`Invalid aux routing tier clamp for ${kind}.`);
  }
  return parsed.data;
}

function clampCandidates(
  candidates: readonly ModelEntry[],
  requirement: AuxRequirement,
): ModelEntry[] {
  return candidates.filter(
    (entry) =>
      entry.enabled &&
      TIER_RANK[entry.tier] >= TIER_RANK[requirement.minTier] &&
      TIER_RANK[entry.tier] <= TIER_RANK[requirement.maxTier],
  );
}

function rankCandidates(
  candidates: readonly ModelEntry[],
  prefer: AuxModelPreference,
): ModelEntry[] {
  return [...candidates].sort((left, right) => {
    const preferred =
      prefer === "cheapest"
        ? costRank(left) - costRank(right)
        : speedRank(left) - speedRank(right);
    return (
      preferred ||
      TIER_RANK[left.tier] - TIER_RANK[right.tier] ||
      left.id.localeCompare(right.id)
    );
  });
}

function costRank(entry: ModelEntry): number {
  const pricing = entry.pricing;
  if (!pricing) return 0;
  return pricing.inputPerMillionUsd + pricing.outputPerMillionUsd;
}

function speedRank(entry: ModelEntry): number {
  return TIER_RANK[entry.tier];
}

function defaultMainModel(): ModelEntry {
  return selectModel({
    tier: "T3",
    requiredCapabilities: ["text", "stream"],
    reason: "Main model fallback.",
  }).model;
}

function requirementForFallback(model: ModelEntry): AuxRequirement {
  return {
    minTier: model.tier,
    maxTier: model.tier,
    requires: ["text", "stream"],
    prefer: "cheapest",
  };
}

function nextTierWithinMax(
  current: ModelTier,
  max: ModelTier,
): ModelTier | null {
  const next = (Object.keys(TIER_RANK) as ModelTier[]).find(
    (tier) =>
      TIER_RANK[tier] > TIER_RANK[current] && TIER_RANK[tier] <= TIER_RANK[max],
  );
  return next ?? null;
}
