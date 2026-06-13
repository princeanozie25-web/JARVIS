import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { z } from "zod";

export const DEFAULT_VISION_SOURCE_ALLOWLIST_CONFIG_PATH = resolve(
  process.cwd(),
  "config/vision/source-allowlist.yaml",
);

export const VISION_SOURCE_PLATFORMS = [
  "youtube",
  "instagram_reels",
  "tiktok",
  "x_twitter",
  "local_file",
] as const;

export type VisionSourcePlatform = (typeof VISION_SOURCE_PLATFORMS)[number];

const PlatformEntrySchema = z.strictObject({
  enabled: z.boolean(),
});

const VisionSourceCapsSchema = z.strictObject({
  max_filesize_mb: z.number().int().positive(),
  max_duration_s: z.number().int().positive(),
  max_frames_per_video: z.number().int().positive(),
  frame_sample_fps: z.number().positive(),
  // 23F additive: bounded camera clip ceiling; committed yaml without the
  // field still parses (default applied).
  max_camera_clip_s: z.number().int().positive().default(30),
});

const VisionSourceAllowlistFileSchema = z.strictObject({
  version: z.literal("phase23.vision.source-allowlist.v1"),
  owner_controlled: z.literal(true),
  metadata_only: z.literal(true),
  platforms: z.strictObject({
    youtube: PlatformEntrySchema,
    instagram_reels: PlatformEntrySchema,
    tiktok: PlatformEntrySchema,
    x_twitter: PlatformEntrySchema,
    local_file: PlatformEntrySchema,
  }),
  caps: VisionSourceCapsSchema,
});

export type VisionSourceCaps = z.infer<typeof VisionSourceCapsSchema>;

export type VisionSourceLoadFailReason =
  | "missing_or_unreadable_file"
  | "parse_error"
  | "schema_violation";

export interface VisionSourceAllowlistLoadResult {
  readonly load_status: "loaded" | "fail_closed";
  readonly fail_reason: VisionSourceLoadFailReason | null;
  readonly platforms: Readonly<Record<VisionSourcePlatform, boolean>>;
  readonly caps: VisionSourceCaps;
  readonly metadata_only: true;
}

const ALL_PLATFORMS_DISABLED: Readonly<Record<VisionSourcePlatform, boolean>> =
  Object.freeze({
    youtube: false,
    instagram_reels: false,
    tiktok: false,
    x_twitter: false,
    local_file: false,
  });

// Fail closed: any load problem disables every platform and zeroes every cap
// (the most restrictive interpretation). Never a permissive default.
const FAIL_CLOSED_CAPS: VisionSourceCaps = Object.freeze({
  max_filesize_mb: 0,
  max_duration_s: 0,
  max_frames_per_video: 0,
  frame_sample_fps: 0,
  max_camera_clip_s: 0,
});

function failClosed(
  reason: VisionSourceLoadFailReason,
): VisionSourceAllowlistLoadResult {
  return {
    load_status: "fail_closed",
    fail_reason: reason,
    platforms: ALL_PLATFORMS_DISABLED,
    caps: FAIL_CLOSED_CAPS,
    metadata_only: true,
  };
}

export function parseVisionSourceAllowlistConfig(
  raw: string,
): VisionSourceAllowlistLoadResult {
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch {
    return failClosed("parse_error");
  }
  const checked = VisionSourceAllowlistFileSchema.safeParse(parsed);
  if (!checked.success) {
    return failClosed("schema_violation");
  }
  return {
    load_status: "loaded",
    fail_reason: null,
    platforms: Object.freeze({
      youtube: checked.data.platforms.youtube.enabled,
      instagram_reels: checked.data.platforms.instagram_reels.enabled,
      tiktok: checked.data.platforms.tiktok.enabled,
      x_twitter: checked.data.platforms.x_twitter.enabled,
      local_file: checked.data.platforms.local_file.enabled,
    }),
    caps: checked.data.caps,
    metadata_only: true,
  };
}

export function loadVisionSourceAllowlistConfig(
  configPath: string = DEFAULT_VISION_SOURCE_ALLOWLIST_CONFIG_PATH,
): VisionSourceAllowlistLoadResult {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return failClosed("missing_or_unreadable_file");
  }
  return parseVisionSourceAllowlistConfig(raw);
}

export function isVisionSourceEnabled(
  result: VisionSourceAllowlistLoadResult,
  platform: VisionSourcePlatform,
): boolean {
  if (result.load_status !== "loaded") {
    return false;
  }
  return result.platforms[platform] === true;
}
