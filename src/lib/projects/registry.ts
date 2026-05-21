import { randomUUID } from "node:crypto";
import type { ProjectRow } from "../db/projects";
import type { ProjectSourceRow } from "../db/project-sources";
import type { ProjectIndexSnapshotRow } from "../db/project-index-snapshots";
import type {
  ProjectBlockerRow,
  ProjectDecisionRow,
  ProjectTaskRow,
  ProjectThreadRow,
} from "../db/project-artifacts";
import {
  ProjectIndexSnapshotSchema,
  ProjectIndexSnapshotStatusSchema,
  ProjectBlockerSchema,
  ProjectBlockerStatusSchema,
  ProjectDecisionSchema,
  PROJECT_STATE_AUTHORITY_NOTE,
  ProjectTaskSchema,
  ProjectTaskStatusSchema,
  ProjectThreadSchema,
  ProjectThreadStatusSchema,
  ProjectRootKindSchema,
  ProjectSlugSchema,
  ProjectSourceKindSchema,
  ProjectSourceSchema,
  ProjectStatusSchema,
  RegisteredProjectSchema,
  type ProjectRegistrationDraft,
  type ProjectBlocker,
  type ProjectBlockerStatus,
  type ProjectDecision,
  type ProjectIndexSnapshot,
  type ProjectIndexSnapshotStatus,
  type ProjectRootKind,
  type ProjectSource,
  type ProjectSourceKind,
  type ProjectStatus,
  type ProjectTask,
  type ProjectTaskStatus,
  type ProjectThread,
  type ProjectThreadStatus,
  type RegisteredProject,
} from "./types";

export function createOpaqueProjectId(
  newId: () => string = randomUUID,
): string {
  return `proj_${newId()}`;
}

export function createOpaqueProjectSourceId(
  newId: () => string = randomUUID,
): string {
  return `psrc_${newId()}`;
}

export function createOpaqueProjectIndexSnapshotId(
  newId: () => string = randomUUID,
): string {
  return `pidx_${newId()}`;
}

export function projectFromRow(
  row: ProjectRow & { source_count?: number },
): RegisteredProject {
  return RegisteredProjectSchema.parse({
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    rootKind: row.root_kind,
    rootRef: row.root_ref,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    status: row.status,
    indexedAt: null,
    sourceCount: row.source_count ?? 0,
  });
}

export function projectSourceFromRow(row: ProjectSourceRow): ProjectSource {
  return ProjectSourceSchema.parse({
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    ref: row.ref,
    lastIndexedAt: row.last_indexed_at,
    sourceHash: row.source_hash,
  });
}

export function projectIndexSnapshotFromRow(
  row: ProjectIndexSnapshotRow,
): ProjectIndexSnapshot {
  return ProjectIndexSnapshotSchema.parse({
    id: row.id,
    projectId: row.project_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    sourcesSeen: row.sources_seen,
    artifactsExtracted: row.artifacts_extracted,
    triggeredBy: row.triggered_by,
    status: row.status,
  });
}

export function projectThreadFromRow(row: ProjectThreadRow): ProjectThread {
  return ProjectThreadSchema.parse({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
    originRef: row.origin_ref,
  });
}

export function projectTaskFromRow(row: ProjectTaskRow): ProjectTask {
  return ProjectTaskSchema.parse({
    id: row.id,
    projectId: row.project_id,
    threadId: row.thread_id,
    title: row.title,
    status: row.status,
    confidence: row.confidence,
    promoted: row.promoted === 1,
    originRef: row.origin_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function projectBlockerFromRow(row: ProjectBlockerRow): ProjectBlocker {
  return ProjectBlockerSchema.parse({
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    description: row.description,
    status: row.status,
    originRef: row.origin_ref,
  });
}

export function projectDecisionFromRow(
  row: ProjectDecisionRow,
): ProjectDecision {
  return ProjectDecisionSchema.parse({
    id: row.id,
    projectId: row.project_id,
    summary: row.summary,
    decidedAt: row.decided_at,
    originRef: row.origin_ref,
  });
}

export function validateProjectRootKind(value: string): ProjectRootKind {
  return ProjectRootKindSchema.parse(value);
}

export function validateProjectStatus(value: string): ProjectStatus {
  return ProjectStatusSchema.parse(value);
}

export function validateProjectSourceKind(value: string): ProjectSourceKind {
  return ProjectSourceKindSchema.parse(value);
}

export function validateProjectIndexSnapshotStatus(
  value: string,
): ProjectIndexSnapshotStatus {
  return ProjectIndexSnapshotStatusSchema.parse(value);
}

export function validateProjectThreadStatus(
  value: string,
): ProjectThreadStatus {
  return ProjectThreadStatusSchema.parse(value);
}

export function validateProjectTaskStatus(value: string): ProjectTaskStatus {
  return ProjectTaskStatusSchema.parse(value);
}

export function validateProjectBlockerStatus(
  value: string,
): ProjectBlockerStatus {
  return ProjectBlockerStatusSchema.parse(value);
}

export function createProjectRegistrationDraft(input: {
  slug: string;
  displayName: string;
  rootKind: ProjectRootKind;
  rootRef: string;
  status?: ProjectStatus;
  newId?: () => string;
}): ProjectRegistrationDraft {
  const displayName = input.displayName.trim();
  const rootRef = input.rootRef.trim();
  if (!displayName) throw new Error("displayName is required");
  if (!rootRef) throw new Error("rootRef is required");

  return {
    id: createOpaqueProjectId(input.newId),
    slug: ProjectSlugSchema.parse(input.slug),
    displayName,
    rootKind: validateProjectRootKind(input.rootKind),
    rootRef,
    status: validateProjectStatus(input.status ?? "active"),
  };
}

export function projectRegistryAuthorityNote(): string {
  return PROJECT_STATE_AUTHORITY_NOTE;
}
