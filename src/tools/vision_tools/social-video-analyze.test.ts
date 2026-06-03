import { describe, expect, it } from "vitest";

import {
  buildSocialExtractionPlan,
  classifySocialExtractionSource,
  selectAdaptiveFrameRate,
} from "./social-video-analyze";

describe("social video analyze tool boundary", () => {
  it("re-exports the Phase 21E social extraction planning boundary", () => {
    const classification = classifySocialExtractionSource(
      "https://www.tiktok.com/@example/video/123",
    );
    const plan = buildSocialExtractionPlan({
      source_url: "https://www.tiktok.com/@example/video/123",
      explicit_user_triggered: true,
      estimated_duration_seconds: 30,
    });

    expect(classification.platform).toBe("tiktok");
    expect(plan.source.platform).toBe("tiktok");
    expect(selectAdaptiveFrameRate(30)).toBe(2);
    expect(plan.raw_url_included).toBe(false);
  });
});
