import { loadDemoScript } from "./fixtures";
import {
  prepareDemoNarration,
  type DemoNarrationProvider,
  type DemoNarrationTrack,
} from "./narration";
import { createDemoRecordingPlan, type DemoRecordingPlan } from "./recording";
import type { DemoAudience, DemoScript } from "./contracts";

export interface DemoDirectorCloseout {
  closeout_id: string;
  status: "complete";
  script: DemoScript;
  narration: DemoNarrationTrack;
  recording_plan: DemoRecordingPlan;
  pipeline_integration: {
    rest: true;
    working: true;
    audit: true;
    pipeline: true;
    gauntlet_removed_from_product_path: true;
  };
  prohibited_capabilities: {
    wake_word_enabled: false;
    conversation_mode_enabled: false;
    standing_consent_enabled: false;
    camera_enabled: false;
    real_cai_execution_enabled: false;
    autonomous_publishing_enabled: false;
    auto_upload_enabled: false;
    execution_bypass_enabled: false;
  };
  local_export_required: true;
  metadata_only: true;
}

export async function createPipelineDemoDirectorCloseout(
  input: {
    audience?: DemoAudience;
    providers?: readonly DemoNarrationProvider[];
  } = {},
): Promise<DemoDirectorCloseout> {
  const script = loadDemoScript(input.audience ?? "recruiter");
  const narration = await prepareDemoNarration({
    script,
    providers: input.providers,
  });
  const recording_plan = createDemoRecordingPlan({ script, narration });

  return {
    closeout_id: `demo-director-closeout:${script.audience}`,
    status: "complete",
    script,
    narration,
    recording_plan,
    pipeline_integration: {
      rest: true,
      working: true,
      audit: true,
      pipeline: true,
      gauntlet_removed_from_product_path: true,
    },
    prohibited_capabilities: {
      wake_word_enabled: false,
      conversation_mode_enabled: false,
      standing_consent_enabled: false,
      camera_enabled: false,
      real_cai_execution_enabled: false,
      autonomous_publishing_enabled: false,
      auto_upload_enabled: false,
      execution_bypass_enabled: false,
    },
    local_export_required: true,
    metadata_only: true,
  };
}
