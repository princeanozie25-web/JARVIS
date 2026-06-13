import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISION_SOURCE_ALLOWLIST_CONFIG_PATH,
  isVisionSourceEnabled,
  loadVisionSourceAllowlistConfig,
  parseVisionSourceAllowlistConfig,
  VISION_SOURCE_PLATFORMS,
} from "../../src/lib/vision-runtime/config/source-allowlist-config";

const VALID_YAML = `version: phase23.vision.source-allowlist.v1
owner_controlled: true
metadata_only: true
platforms:
  youtube:
    enabled: false
  instagram_reels:
    enabled: false
  tiktok:
    enabled: false
  x_twitter:
    enabled: false
  local_file:
    enabled: false
caps:
  max_filesize_mb: 512
  max_duration_s: 3600
  max_frames_per_video: 120
  frame_sample_fps: 1
`;

describe("Phase 23A vision source allowlist (I-23A-1, I-23A-2)", () => {
  it("loads the committed config with every platform disabled by default", () => {
    const result = loadVisionSourceAllowlistConfig(
      DEFAULT_VISION_SOURCE_ALLOWLIST_CONFIG_PATH,
    );

    expect(result.load_status).toBe("loaded");
    for (const platform of VISION_SOURCE_PLATFORMS) {
      expect(isVisionSourceEnabled(result, platform)).toBe(false);
    }
  });

  it("parses the global caps as the required numbers", () => {
    const result = loadVisionSourceAllowlistConfig(
      DEFAULT_VISION_SOURCE_ALLOWLIST_CONFIG_PATH,
    );

    expect(result.caps).toEqual({
      max_filesize_mb: 512,
      max_duration_s: 3600,
      max_frames_per_video: 120,
      frame_sample_fps: 1,
      // 23F additive field, defaulted when absent from the committed yaml.
      max_camera_clip_s: 30,
    });
  });

  it("enables a platform only when its flag is true", () => {
    const result = parseVisionSourceAllowlistConfig(
      VALID_YAML.replace(
        "  youtube:\n    enabled: false",
        "  youtube:\n    enabled: true",
      ),
    );

    expect(result.load_status).toBe("loaded");
    expect(isVisionSourceEnabled(result, "youtube")).toBe(true);
    expect(isVisionSourceEnabled(result, "tiktok")).toBe(false);
  });

  it("rejects an unknown platform key and fails closed", () => {
    const result = parseVisionSourceAllowlistConfig(
      VALID_YAML.replace("caps:", "  rumble:\n    enabled: true\ncaps:"),
    );

    expect(result.load_status).toBe("fail_closed");
    expect(result.fail_reason).toBe("schema_violation");
    for (const platform of VISION_SOURCE_PLATFORMS) {
      expect(isVisionSourceEnabled(result, platform)).toBe(false);
    }
  });

  it("rejects unknown top-level keys and fails closed", () => {
    const result = parseVisionSourceAllowlistConfig(
      `${VALID_YAML}allow_everything: true\n`,
    );

    expect(result.load_status).toBe("fail_closed");
    expect(result.fail_reason).toBe("schema_violation");
  });

  it("fails closed when the file is missing: platforms disabled, caps zeroed", () => {
    const result = loadVisionSourceAllowlistConfig(
      resolve(process.cwd(), "config/vision/no-such-allowlist.yaml"),
    );

    expect(result.load_status).toBe("fail_closed");
    expect(result.fail_reason).toBe("missing_or_unreadable_file");
    for (const platform of VISION_SOURCE_PLATFORMS) {
      expect(isVisionSourceEnabled(result, platform)).toBe(false);
    }
    expect(result.caps).toEqual({
      max_filesize_mb: 0,
      max_duration_s: 0,
      max_frames_per_video: 0,
      frame_sample_fps: 0,
      max_camera_clip_s: 0,
    });
  });

  it("fails closed on unparseable yaml", () => {
    const result = parseVisionSourceAllowlistConfig("platforms: [::: nope");

    expect(result.load_status).toBe("fail_closed");
  });
});
