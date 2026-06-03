import { z } from "zod";

export const PHASE_21_REALIZATION_REPORT_VERSION =
  "phase21.realization-bundle.status.v1" as const;

export const PHASE_21_REALIZATION_CLASSIFICATIONS = [
  "foundation",
  "workflow",
  "realized",
  "execution_enabled",
] as const;

const SliceIdSchema = z.enum(["21F-R", "21G-R", "21B-R", "21I-R"]);
const ClassificationSchema = z.enum(PHASE_21_REALIZATION_CLASSIFICATIONS);
const BoundedTextSchema = z.string().trim().min(1).max(600);

export const Phase21RealizationSliceStatusSchema = z.strictObject({
  slice_id: SliceIdSchema,
  name: BoundedTextSchema,
  classification: ClassificationSchema,
  execution_enabled: z.boolean(),
  approval_gated: z.boolean(),
  adapter_or_writer_injected: z.boolean(),
  telemetry_metadata_only: z.boolean(),
  auto_execution_enabled: z.literal(false),
  silent_write_enabled: z.literal(false),
  raw_payload_telemetry_enabled: z.literal(false),
  status_notes: z.array(BoundedTextSchema),
});

export const Phase21RealizationReportSchema = z.strictObject({
  report_version: z.literal(PHASE_21_REALIZATION_REPORT_VERSION),
  title: z.literal("Phase 21 realization bundle status report"),
  slices: z.array(Phase21RealizationSliceStatusSchema),
  remaining_avoidable_scaffold_only_work: z.array(BoundedTextSchema),
  phase_21_closeout_unblocked: z.boolean(),
  closeout_note: BoundedTextSchema,
  governance: z.strictObject({
    approval_lifecycle_required_for_side_effects: z.literal(true),
    no_auto_execution: z.literal(true),
    no_silent_writes: z.literal(true),
    no_background_sync: z.literal(true),
    no_raw_email_job_or_vault_body_telemetry: z.literal(true),
    injected_boundary_required_for_provider_network_tool_calls: z.literal(true),
    phase_21_closed_claimed: z.literal(false),
  }),
});

export type Phase21RealizationSliceStatus = z.infer<
  typeof Phase21RealizationSliceStatusSchema
>;
export type Phase21RealizationReport = z.infer<
  typeof Phase21RealizationReportSchema
>;

export function buildPhase21RealizationReport(): Phase21RealizationReport {
  const slices: Phase21RealizationSliceStatus[] = [
    {
      slice_id: "21F-R",
      name: "Live Council",
      classification: "realized",
      execution_enabled: true,
      approval_gated: false,
      adapter_or_writer_injected: true,
      telemetry_metadata_only: true,
      auto_execution_enabled: false,
      silent_write_enabled: false,
      raw_payload_telemetry_enabled: false,
      status_notes: [
        "Opt-in cost-gated live provider workflow exists through an injected provider runner boundary.",
        "Council remains advisory-only and cannot approve or execute actions.",
      ],
    },
    {
      slice_id: "21G-R",
      name: "Knowledge Compounding Vault Write",
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
      adapter_or_writer_injected: true,
      telemetry_metadata_only: true,
      auto_execution_enabled: false,
      silent_write_enabled: false,
      raw_payload_telemetry_enabled: false,
      status_notes: [
        "Approved hub drafts can be written through an injected vault writer after target path validation.",
        "Rejected or deferred approvals do not invoke the writer, and approved writes emit bounded reindex metadata.",
      ],
    },
    {
      slice_id: "21B-R",
      name: "Google Actions",
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
      adapter_or_writer_injected: true,
      telemetry_metadata_only: true,
      auto_execution_enabled: false,
      silent_write_enabled: false,
      raw_payload_telemetry_enabled: false,
      status_notes: [
        "Gmail draft creation is T1 draft-only through an injected adapter.",
        "Gmail send and Calendar create are T2 action paths gated by approval/consent metadata; Drive writes remain forbidden.",
      ],
    },
    {
      slice_id: "21I-R",
      name: "Job Scout Acquisition and Submission",
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
      adapter_or_writer_injected: true,
      telemetry_metadata_only: true,
      auto_execution_enabled: false,
      silent_write_enabled: false,
      raw_payload_telemetry_enabled: false,
      status_notes: [
        "Acquisition uses injected adapters and source policy/rate metadata.",
        "Application submission requires ranked-job selection, draft plan, user approval, preview, final UI confirmation, and an injected fakeable adapter.",
      ],
    },
  ];

  return Phase21RealizationReportSchema.parse({
    report_version: PHASE_21_REALIZATION_REPORT_VERSION,
    title: "Phase 21 realization bundle status report",
    slices,
    remaining_avoidable_scaffold_only_work: [],
    phase_21_closeout_unblocked: true,
    closeout_note:
      "Phase 21 closeout is unblocked by the 21F-R, 21G-R, 21B-R, and 21I-R realization gates, but this report does not itself close Phase 21.",
    governance: {
      approval_lifecycle_required_for_side_effects: true,
      no_auto_execution: true,
      no_silent_writes: true,
      no_background_sync: true,
      no_raw_email_job_or_vault_body_telemetry: true,
      injected_boundary_required_for_provider_network_tool_calls: true,
      phase_21_closed_claimed: false,
    },
  });
}
