import { z } from "zod";

export const PROJECT_ROOT_KINDS = [
  "fs",
  "memory",
  "obsidian",
  "virtual",
] as const;

export const PROJECT_STATUSES = ["active", "paused", "archived"] as const;
export const PROJECT_SOURCE_KINDS = [
  "file",
  "memory_slug",
  "obsidian_note",
  "thread",
] as const;
export const PROJECT_INDEX_SNAPSHOT_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "rejected",
] as const;
export const PROJECT_THREAD_STATUSES = ["open", "resolved", "stale"] as const;
export const PROJECT_TASK_STATUSES = [
  "extracted",
  "open",
  "in_progress",
  "blocked",
  "done",
  "dismissed",
] as const;
export const PROJECT_BLOCKER_STATUSES = ["open", "cleared"] as const;

export type ProjectRootKind = (typeof PROJECT_ROOT_KINDS)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectSourceKind = (typeof PROJECT_SOURCE_KINDS)[number];
export type ProjectIndexSnapshotStatus =
  (typeof PROJECT_INDEX_SNAPSHOT_STATUSES)[number];
export type ProjectThreadStatus = (typeof PROJECT_THREAD_STATUSES)[number];
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
export type ProjectBlockerStatus = (typeof PROJECT_BLOCKER_STATUSES)[number];

export const ProjectRootKindSchema = z.enum(PROJECT_ROOT_KINDS);
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export const ProjectSourceKindSchema = z.enum(PROJECT_SOURCE_KINDS);
export const ProjectIndexSnapshotStatusSchema = z.enum(
  PROJECT_INDEX_SNAPSHOT_STATUSES,
);
export const ProjectThreadStatusSchema = z.enum(PROJECT_THREAD_STATUSES);
export const ProjectTaskStatusSchema = z.enum(PROJECT_TASK_STATUSES);
export const ProjectBlockerStatusSchema = z.enum(PROJECT_BLOCKER_STATUSES);

export const ProjectSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const RegisteredProjectSchema = z.object({
  id: z.string().trim().min(1).max(200),
  slug: ProjectSlugSchema,
  displayName: z.string().trim().min(1).max(200),
  rootKind: ProjectRootKindSchema,
  rootRef: z.string().trim().min(1).max(500),
  createdAt: z.number().int().nonnegative(),
  archivedAt: z.number().int().nonnegative().nullable(),
  status: ProjectStatusSchema,
  indexedAt: z.null(),
  sourceCount: z.number().int().nonnegative(),
});

export type RegisteredProject = z.infer<typeof RegisteredProjectSchema>;

export const ProjectSourceSchema = z.object({
  id: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  kind: ProjectSourceKindSchema,
  ref: z.string().trim().min(1).max(500),
  lastIndexedAt: z.number().int().nonnegative().nullable(),
  sourceHash: z.string().trim().min(1).max(300).nullable(),
});

export type ProjectSource = z.infer<typeof ProjectSourceSchema>;

export const ProjectIndexSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  startedAt: z.number().int().nonnegative(),
  finishedAt: z.number().int().nonnegative().nullable(),
  sourcesSeen: z.number().int().nonnegative(),
  artifactsExtracted: z.number().int().nonnegative(),
  triggeredBy: z.string().trim().min(1).max(120),
  status: ProjectIndexSnapshotStatusSchema,
});

export type ProjectIndexSnapshot = z.infer<typeof ProjectIndexSnapshotSchema>;

export const ProjectThreadSchema = z.object({
  id: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  status: ProjectThreadStatusSchema,
  firstSeenAt: z.number().int().nonnegative(),
  lastActiveAt: z.number().int().nonnegative(),
  originRef: z.string().trim().min(1).max(500),
});

export type ProjectThread = z.infer<typeof ProjectThreadSchema>;

export const ProjectTaskSchema = z.object({
  id: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  threadId: z.string().trim().min(1).max(200).nullable(),
  title: z.string().trim().min(1).max(500),
  status: ProjectTaskStatusSchema,
  confidence: z.number().min(0).max(1),
  promoted: z.boolean(),
  originRef: z.string().trim().min(1).max(500),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type ProjectTask = z.infer<typeof ProjectTaskSchema>;

export const ProjectBlockerSchema = z.object({
  id: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  taskId: z.string().trim().min(1).max(200).nullable(),
  description: z.string().trim().min(1).max(1_000),
  status: ProjectBlockerStatusSchema,
  originRef: z.string().trim().min(1).max(500),
});

export type ProjectBlocker = z.infer<typeof ProjectBlockerSchema>;

export const ProjectDecisionSchema = z.object({
  id: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(1_000),
  decidedAt: z.number().int().nonnegative().nullable(),
  originRef: z.string().trim().min(1).max(500),
});

export type ProjectDecision = z.infer<typeof ProjectDecisionSchema>;

export interface ProjectRegistrationDraft {
  id: string;
  slug: string;
  displayName: string;
  rootKind: ProjectRootKind;
  rootRef: string;
  status: ProjectStatus;
}

export const PROJECT_STATE_AUTHORITY_NOTE =
  "Phase 5 project state is a read-mostly derived cache over canonical sources, not a source of truth.";
