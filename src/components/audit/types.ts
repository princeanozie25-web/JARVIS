export type AuditRegionId =
  | "replay_timeline"
  | "trace_viewer"
  | "governance_boundary_viewer"
  | "runtime_dependency_viewer"
  | "redaction_status"
  | "disabled_feature_matrix";

export interface AuditRegionPlaceholder {
  region_id: AuditRegionId;
  title: string;
  eyebrow: string;
  description: string;
  status: "placeholder" | "withheld" | "not_connected";
  posture: "inspection_only";
  dataClassification: "metadata_only";
  authority: "none";
  rows: readonly {
    label: string;
    value: string;
  }[];
}

export interface AuditShellModel {
  title: string;
  subtitle: string;
  posture: "read_only_forensics_shell";
  localOnly: true;
  metadataOnly: true;
  authority: "none";
  regions: readonly AuditRegionPlaceholder[];
}
