import { describe, expect, it } from "vitest";

import { createPipelineDemoDirectorCloseout } from "@/lib/demo-director";

describe("Demo Director closeout", () => {
  it("creates the recruiter demo flow from script to narration to recording plan", async () => {
    const closeout = await createPipelineDemoDirectorCloseout({
      audience: "recruiter",
    });

    expect(closeout.status).toBe("complete");
    expect(closeout.script.audience).toBe("recruiter");
    expect(closeout.script.recording_enabled).toBe(true);
    expect(closeout.narration.lines.length).toBeGreaterThan(0);
    expect(closeout.recording_plan.frames.map((frame) => frame.target)).toEqual(
      ["reactor", "pipeline", "working", "audit"],
    );
  });

  it("keeps pipeline integration official and gauntlet removed from the product path", async () => {
    const closeout = await createPipelineDemoDirectorCloseout();

    expect(closeout.pipeline_integration).toEqual({
      rest: true,
      working: true,
      audit: true,
      pipeline: true,
      gauntlet_removed_from_product_path: true,
    });
  });

  it("preserves forbidden capabilities through closeout", async () => {
    const closeout = await createPipelineDemoDirectorCloseout();

    expect(closeout.prohibited_capabilities).toEqual({
      wake_word_enabled: false,
      conversation_mode_enabled: false,
      standing_consent_enabled: false,
      camera_enabled: false,
      real_cai_execution_enabled: false,
      autonomous_publishing_enabled: false,
      auto_upload_enabled: false,
      execution_bypass_enabled: false,
    });
  });
});
