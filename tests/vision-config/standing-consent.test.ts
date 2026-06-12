import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISION_STANDING_CONSENT_CONFIG_PATH,
  isVisionConsentGranted,
  loadVisionStandingConsentConfig,
  parseVisionStandingConsentConfig,
  VISION_CONSENT_IDS,
} from "../../src/lib/vision-runtime/config/standing-consent-config";

function consentYaml(entryLines: string): string {
  return [
    "version: phase23.vision.standing-consent.v1",
    "owner_controlled: true",
    "auditable: true",
    "revocable: true",
    "vision_may_grant_consent: false",
    "no_self_expansion: true",
    "metadata_only: true",
    "consents:",
    entryLines,
  ].join("\n");
}

function entry(id: string, granted: boolean, revoked: boolean): string {
  return [
    `  - id: ${id}`,
    `    label: Test entry for ${id}`,
    "    tier: T2",
    "    action: video_ingest",
    `    scope: vision.test.${id}`,
    `    granted: ${granted}`,
    `    revoked: ${revoked}`,
    "    granted_by: user_config",
    `    audit_event: standing-consent:${id}`,
  ].join("\n");
}

describe("Phase 23A vision standing consent (I-23A-1, I-23A-2)", () => {
  it("loads the committed config with every consent denied by default", () => {
    const result = loadVisionStandingConsentConfig(
      DEFAULT_VISION_STANDING_CONSENT_CONFIG_PATH,
    );

    expect(result.load_status).toBe("loaded");
    expect(result.consents).toHaveLength(VISION_CONSENT_IDS.length);
    for (const id of VISION_CONSENT_IDS) {
      expect(isVisionConsentGranted(result, id)).toBe(false);
    }
  });

  it("covers all six required consent ids in the committed config", () => {
    const result = loadVisionStandingConsentConfig(
      DEFAULT_VISION_STANDING_CONSENT_CONFIG_PATH,
    );

    expect(result.consents.map((candidate) => candidate.id).sort()).toEqual(
      [...VISION_CONSENT_IDS].sort(),
    );
  });

  it("round-trips a grant: granted true and revoked false is allowed", () => {
    const result = parseVisionStandingConsentConfig(
      consentYaml(entry("video_ingest_url", true, false)),
    );

    expect(result.load_status).toBe("loaded");
    expect(isVisionConsentGranted(result, "video_ingest_url")).toBe(true);
  });

  it("round-trips a revoke: revoked true denies even when granted", () => {
    const result = parseVisionStandingConsentConfig(
      consentYaml(entry("video_ingest_url", true, true)),
    );

    expect(result.load_status).toBe("loaded");
    expect(isVisionConsentGranted(result, "video_ingest_url")).toBe(false);
  });

  it("rejects unknown top-level keys and fails closed", () => {
    const result = parseVisionStandingConsentConfig(
      `${consentYaml(entry("video_ingest_url", true, false))}\nunexpected_key: true`,
    );

    expect(result.load_status).toBe("fail_closed");
    expect(result.fail_reason).toBe("schema_violation");
    expect(result.consents).toHaveLength(0);
    expect(isVisionConsentGranted(result, "video_ingest_url")).toBe(false);
  });

  it("rejects unknown entry-level keys and fails closed", () => {
    const result = parseVisionStandingConsentConfig(
      consentYaml(`${entry("video_ingest_url", true, false)}\n    extra: true`),
    );

    expect(result.load_status).toBe("fail_closed");
    expect(result.fail_reason).toBe("schema_violation");
  });

  it("fails closed when the file is missing: every consent denied", () => {
    const result = loadVisionStandingConsentConfig(
      resolve(process.cwd(), "config/vision/does-not-exist.yaml"),
    );

    expect(result.load_status).toBe("fail_closed");
    expect(result.fail_reason).toBe("missing_or_unreadable_file");
    for (const id of VISION_CONSENT_IDS) {
      expect(isVisionConsentGranted(result, id)).toBe(false);
    }
  });

  it("fails closed on unparseable yaml", () => {
    const result = parseVisionStandingConsentConfig("{{{ not yaml :::");

    expect(result.load_status).toBe("fail_closed");
    expect(result.consents).toHaveLength(0);
  });
});
