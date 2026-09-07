// Phase 25G (G4, E-055) — the typed first-run bootstrap projection.
//
// What the packaged app knows about its own launch, for Astra's bootstrap
// screen: packaged or dev, the packaged doctor's checks with the exact
// runbook step per failure, the sidecars' supervision state, and where the
// data lives. Pure data; no UI, no route composition, no copy beyond the
// checks' own text.
import { z } from "zod";
import {
  PackagedDoctorReportSchema,
  type PackagedDoctorReport,
} from "./install-root";
import {
  SidecarSupervisorSnapshotSchema,
  type SidecarSupervisorSnapshot,
} from "./supervisor";

export const BootstrapProjectionSchema = z.strictObject({
  projection_version: z.literal("25G.4-bootstrap"),
  packaged: z.boolean(),
  data_dir: z.string().max(400),
  verdict: z.enum(["ready", "degraded", "blocked", "not_packaged"]),
  doctor: PackagedDoctorReportSchema.nullable(),
  sidecars: z.strictObject({
    ollama: z.strictObject({
      reachable: z.boolean(),
      managed: z.literal(false),
    }),
    mlx_audio: SidecarSupervisorSnapshotSchema.nullable(),
  }),
  next_steps: z
    .array(
      z.strictObject({
        check_id: z.string().max(80),
        step: z.string().max(240),
      }),
    )
    .max(16),
  generated_at: z.string(),
  metadata_only: z.literal(true),
  secret_material_included: z.literal(false),
});
export type BootstrapProjection = z.infer<typeof BootstrapProjectionSchema>;

export function buildBootstrapProjection(input: {
  packaged: boolean;
  dataDir: string;
  doctor: PackagedDoctorReport | null;
  ollamaReachable: boolean;
  mlxAudio: SidecarSupervisorSnapshot | null;
  now: Date;
}): BootstrapProjection {
  const nextSteps = (input.doctor?.checks ?? [])
    .filter((c) => c.status !== "pass" && c.next_step)
    .map((c) => ({ check_id: c.check_id, step: c.next_step! }));
  return BootstrapProjectionSchema.parse({
    projection_version: "25G.4-bootstrap",
    packaged: input.packaged,
    data_dir: input.dataDir,
    verdict: input.packaged
      ? (input.doctor?.verdict ?? "blocked")
      : "not_packaged",
    doctor: input.doctor,
    sidecars: {
      ollama: { reachable: input.ollamaReachable, managed: false },
      mlx_audio: input.mlxAudio,
    },
    next_steps: nextSteps.slice(0, 16),
    generated_at: input.now.toISOString(),
    metadata_only: true,
    secret_material_included: false,
  });
}
