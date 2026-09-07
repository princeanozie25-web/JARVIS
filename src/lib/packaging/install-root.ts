// Phase 25G (G4, E-055) — the packaged app's own doctor.
//
// The 20B safe-runtime doctor inspects a REPOSITORY (src/, tests/, docs/…),
// which the installed .app deliberately does not carry, so inside the bundle
// it reports "blocked" for the wrong reasons. In packaged mode JARVIS checks
// what actually matters for a launch: its bundled resources, a writable data
// dir, the two loopback sidecars, and the voice venv it is configured to
// supervise. Read-only, deterministic, injectable; never installs anything.
import { z } from "zod";

export const PACKAGED_DOCTOR_VERSION = "25G.4" as const;

export function isPackaged(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = env.JARVIS_PACKAGED?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export const PACKAGED_CHECK_IDS = [
  "packaged:resource-prompts",
  "packaged:resource-migrations",
  "packaged:resource-model-registry",
  "packaged:data-dir-writable",
  "packaged:ollama-reachable",
  "packaged:mlx-audio-reachable",
  "packaged:voice-venv-configured",
] as const;
export type PackagedCheckId = (typeof PACKAGED_CHECK_IDS)[number];

export const PackagedCheckResultSchema = z.strictObject({
  check_id: z.enum(PACKAGED_CHECK_IDS),
  status: z.enum(["pass", "warn", "fail"]),
  blocking: z.boolean(),
  detail: z.string().max(240),
  // The human step from docs/runbooks/macos-bringup.md that fixes it.
  next_step: z.string().max(240).nullable(),
});
export type PackagedCheckResult = z.infer<typeof PackagedCheckResultSchema>;

export const PackagedDoctorReportSchema = z.strictObject({
  version: z.literal(PACKAGED_DOCTOR_VERSION),
  verdict: z.enum(["ready", "degraded", "blocked"]),
  checks: z.array(PackagedCheckResultSchema),
  blocking_failures: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  observed_at: z.string(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});
export type PackagedDoctorReport = z.infer<typeof PackagedDoctorReportSchema>;

export interface PackagedDoctorAdapters {
  fileExists(relativePath: string): boolean;
  dataDirWritable(): boolean;
  reachable(url: string): Promise<boolean>;
  commandExists(path: string): boolean;
}

export interface PackagedDoctorInput {
  env: Record<string, string | undefined>;
  adapters: PackagedDoctorAdapters;
  now?: Date;
}

const RUNBOOK = "docs/runbooks/macos-bringup.md";

export async function runPackagedDoctor(
  input: PackagedDoctorInput,
): Promise<PackagedDoctorReport> {
  const { env, adapters } = input;
  const ollama = env.JARVIS_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const mlx = env.JARVIS_MLX_AUDIO_URL?.trim() || "http://127.0.0.1:8004";
  const python =
    env.JARVIS_STT_MLX_PYTHON_COMMAND?.trim() ||
    env.JARVIS_MLX_PYTHON?.trim() ||
    "";
  const [ollamaUp, mlxUp] = await Promise.all([
    adapters.reachable(`${ollama}/api/tags`),
    adapters.reachable(`${mlx}/v1/models`),
  ]);
  const check = (
    check_id: PackagedCheckId,
    ok: boolean,
    blocking: boolean,
    detail: string,
    next_step: string | null,
  ): PackagedCheckResult => ({
    check_id,
    status: ok ? "pass" : blocking ? "fail" : "warn",
    blocking,
    detail,
    next_step: ok ? null : next_step,
  });
  const checks: PackagedCheckResult[] = [
    check(
      "packaged:resource-prompts",
      adapters.fileExists("prompts/jarvis_system.md"),
      true,
      "system prompt bundled",
      `rebuild: scripts/package/build-mac.ts (${RUNBOOK})`,
    ),
    check(
      "packaged:resource-migrations",
      adapters.fileExists("db/migrations/0001_init.sql"),
      true,
      "event-store migration bundled",
      "rebuild: scripts/package/build-mac.ts",
    ),
    check(
      "packaged:resource-model-registry",
      adapters.fileExists("config/models/registry.yaml"),
      true,
      "model registry bundled",
      "rebuild: scripts/package/build-mac.ts",
    ),
    check(
      "packaged:data-dir-writable",
      adapters.dataDirWritable(),
      true,
      "data dir writable (JARVIS_DATA_DIR)",
      "check ~/Library/Application Support/dev.princeanozie.jarvis permissions",
    ),
    check(
      "packaged:ollama-reachable",
      ollamaUp,
      true,
      `Ollama at ${ollama}`,
      `brew services start ollama (${RUNBOOK} §toolchain)`,
    ),
    check(
      "packaged:mlx-audio-reachable",
      mlxUp,
      false,
      `mlx-audio at ${mlx}`,
      "set JARVIS_STT_MLX_PYTHON_COMMAND in jarvis.env so the app can start it, or start scripts/voice/mlx-audio-server.sh",
    ),
    check(
      "packaged:voice-venv-configured",
      python !== "" && adapters.commandExists(python),
      false,
      python ? `voice python: ${python}` : "voice python not configured",
      `create .venv-mlx from runtimes/requirements-mlx.txt and set JARVIS_STT_MLX_PYTHON_COMMAND (${RUNBOOK})`,
    ),
  ];
  const blocking = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  return PackagedDoctorReportSchema.parse({
    version: PACKAGED_DOCTOR_VERSION,
    verdict: blocking > 0 ? "blocked" : warnings > 0 ? "degraded" : "ready",
    checks,
    blocking_failures: blocking,
    warnings,
    observed_at: (input.now ?? new Date()).toISOString(),
    metadata_only: true,
    read_only: true,
  });
}
