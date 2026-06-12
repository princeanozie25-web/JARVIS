import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { z } from "zod";

export const DEFAULT_VISION_STANDING_CONSENT_CONFIG_PATH = resolve(
  process.cwd(),
  "config/vision/standing-consent.yaml",
);

export const VISION_CONSENT_IDS = [
  "video_ingest_url",
  "video_ingest_local_file",
  "frame_sampling",
  "transcript_extraction",
  "multimodal_analysis",
  "camera_capture",
] as const;

export type VisionConsentId = (typeof VISION_CONSENT_IDS)[number];

const VisionConsentEntrySchema = z.strictObject({
  id: z.enum(VISION_CONSENT_IDS),
  label: z.string().min(1),
  tier: z.enum(["T0", "T1", "T2", "T3"]),
  action: z.string().min(1),
  scope: z.string().min(1),
  granted: z.boolean(),
  revoked: z.boolean(),
  granted_by: z.literal("user_config"),
  audit_event: z.string().min(1),
});

const VisionStandingConsentFileSchema = z.strictObject({
  version: z.literal("phase23.vision.standing-consent.v1"),
  owner_controlled: z.literal(true),
  auditable: z.literal(true),
  revocable: z.literal(true),
  vision_may_grant_consent: z.literal(false),
  no_self_expansion: z.literal(true),
  metadata_only: z.literal(true),
  consents: z.array(VisionConsentEntrySchema),
});

export type VisionConsentEntry = z.infer<typeof VisionConsentEntrySchema>;

export type VisionConsentLoadFailReason =
  | "missing_or_unreadable_file"
  | "parse_error"
  | "schema_violation";

export interface VisionStandingConsentLoadResult {
  readonly load_status: "loaded" | "fail_closed";
  readonly fail_reason: VisionConsentLoadFailReason | null;
  readonly consents: readonly VisionConsentEntry[];
  readonly metadata_only: true;
}

// Fail closed: any load problem yields an empty consent set, so every
// consent query answers "denied". Never a permissive default.
function failClosed(
  reason: VisionConsentLoadFailReason,
): VisionStandingConsentLoadResult {
  return {
    load_status: "fail_closed",
    fail_reason: reason,
    consents: [],
    metadata_only: true,
  };
}

export function parseVisionStandingConsentConfig(
  raw: string,
): VisionStandingConsentLoadResult {
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch {
    return failClosed("parse_error");
  }
  const checked = VisionStandingConsentFileSchema.safeParse(parsed);
  if (!checked.success) {
    return failClosed("schema_violation");
  }
  return {
    load_status: "loaded",
    fail_reason: null,
    consents: checked.data.consents,
    metadata_only: true,
  };
}

export function loadVisionStandingConsentConfig(
  configPath: string = DEFAULT_VISION_STANDING_CONSENT_CONFIG_PATH,
): VisionStandingConsentLoadResult {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return failClosed("missing_or_unreadable_file");
  }
  return parseVisionStandingConsentConfig(raw);
}

export function isVisionConsentGranted(
  result: VisionStandingConsentLoadResult,
  id: VisionConsentId,
): boolean {
  if (result.load_status !== "loaded") {
    return false;
  }
  const entry = result.consents.find((candidate) => candidate.id === id);
  if (!entry) {
    return false;
  }
  return entry.granted && !entry.revoked;
}
