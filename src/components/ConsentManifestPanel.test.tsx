import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PHASE_3D_FEATURE_IDS,
  PHASE_3D_FEATURE_LABELS,
} from "../lib/consent/types";
import { createDefaultConsentManifest } from "../lib/consent/manifest";
import { ConsentManifestPanel } from "./ConsentManifestPanel";

describe("ConsentManifestPanel", () => {
  it("renders all Phase 3D feature toggles disabled by default", () => {
    const manifest = createDefaultConsentManifest({
      now: () => Date.parse("2026-05-19T00:00:00.000Z"),
    });
    const html = renderToStaticMarkup(
      <ConsentManifestPanel manifest={manifest} onToggle={() => undefined} />,
    );

    expect(html).toContain("Consent Manifest");
    expect(html).toContain(`${PHASE_3D_FEATURE_IDS.length} features`);
    for (const featureId of PHASE_3D_FEATURE_IDS) {
      expect(html).toContain(PHASE_3D_FEATURE_LABELS[featureId]);
    }
    expect(html).not.toContain('checked=""');
  });

  it("shows an unloaded state", () => {
    const html = renderToStaticMarkup(
      <ConsentManifestPanel manifest={null} onToggle={() => undefined} />,
    );

    expect(html).toContain("Consent manifest is not loaded.");
  });
});
