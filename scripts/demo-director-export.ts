import {
  createNarrationFailoverTelemetrySink,
  DEMO_SCRIPT_GENERAL,
  DEMO_SCRIPT_RECRUITER,
  DEMO_SCRIPT_SECURITY,
  DEMO_SCRIPT_TECHNICAL,
  prepareDemoNarration,
} from "../src/lib/demo-director";
import { createRuntimeNarrationProviders } from "../src/lib/demo-director/chatterbox";
import { createDemoExportPackage } from "../src/lib/demo-director/export-package";
import type { DemoAudience, DemoScript } from "../src/lib/demo-director";

const SCRIPTS: Record<DemoAudience, DemoScript> = {
  recruiter: DEMO_SCRIPT_RECRUITER,
  technical: DEMO_SCRIPT_TECHNICAL,
  security: DEMO_SCRIPT_SECURITY,
  general: DEMO_SCRIPT_GENERAL,
};

async function main() {
  const audience = readAudience();
  const script = SCRIPTS[audience];
  const timestamp =
    process.env.JARVIS_DEMO_TIMESTAMP ?? new Date().toISOString();
  const outputRoot = process.env.JARVIS_DEMO_OUTPUT_ROOT ?? "demo-exports";
  const baseUrl = process.env.JARVIS_DEMO_BASE_URL ?? "http://127.0.0.1:3000";
  const audioOutput = `${outputRoot}/${timestamp.replace(/[:]/g, "-")}/audio`;
  const providers = createRuntimeNarrationProviders({
    chatterbox_url:
      process.env.JARVIS_CHATTERBOX_URL ?? "http://127.0.0.1:8004",
    kokoro_url: process.env.JARVIS_KOKORO_URL ?? "http://127.0.0.1:8880",
    output_dir: audioOutput,
    timeout_ms: Number(process.env.JARVIS_DEMO_TTS_TIMEOUT_MS ?? 1_500),
  });
  // 23G-3: emit metadata-only failover + selection audit. The DB layer is
  // `server-only` (unavailable in this tsx script), so this CLI routes the
  // sink to stdout; server callers route recordEvent -> telemetry_events.
  const narration = await prepareDemoNarration({
    script,
    providers,
    telemetry: createNarrationFailoverTelemetrySink({
      sessionId: `demo-narration:${script.script_id}`,
      recordEvent: (event) =>
        console.log(`[narration-audit] ${JSON.stringify(event)}`),
    }),
  });
  const pkg = await createDemoExportPackage({
    script,
    narration,
    outputRoot,
    timestamp,
    baseUrl,
    dwell_ms: Number(process.env.JARVIS_DEMO_CAPTURE_DWELL_MS ?? 1_100),
  });

  console.log(
    JSON.stringify(
      {
        audience,
        provider: narration.provider_id,
        export_dir: pkg.root_dir,
        demo_mp4: pkg.demo_mp4_path,
        real_browser_capture: pkg.real_browser_capture,
        export_valid: pkg.export_validation.valid,
        upload_performed: pkg.upload_performed,
        post_performed: pkg.post_performed,
      },
      null,
      2,
    ),
  );
}

function readAudience(): DemoAudience {
  const raw = process.argv[2] ?? "recruiter";
  if (raw in SCRIPTS) return raw as DemoAudience;
  throw new Error(
    `Unknown demo audience '${raw}'. Use recruiter, technical, security, or general.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
