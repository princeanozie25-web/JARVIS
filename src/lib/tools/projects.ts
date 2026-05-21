import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type DatabaseType from "better-sqlite3";
import { z } from "zod";
import {
  getProjectArtifactCounts,
  getProjectBlockerByOrigin,
  getProjectTask,
  getProjectTaskByOrigin,
  insertProjectBlocker,
  insertProjectTask,
  listOpenProjectBlockers,
  listPromotedProjectTasks,
  promoteProjectTask,
} from "../db/project-artifacts";
import {
  finishProjectIndexSnapshot,
  hasActiveProjectIndexSnapshot,
  insertProjectIndexSnapshot,
  listProjectIndexSnapshots,
} from "../db/project-index-snapshots";
import {
  countProjectSources,
  insertProjectSource,
  listProjectSources,
  updateProjectSourceIndexMetadata,
} from "../db/project-sources";
import type { ProjectSourceRow } from "../db/project-sources";
import {
  getRegisteredProject,
  insertRegisteredProject,
  listRegisteredProjects,
  updateProjectStatus,
} from "../db/projects";
import {
  createOpaqueProjectSourceId,
  createOpaqueProjectIndexSnapshotId,
  createOpaqueProjectBlockerId,
  createOpaqueProjectTaskId,
  createProjectRegistrationDraft,
  extractProjectMarkers,
  PROJECT_ROOT_KINDS,
  PROJECT_SOURCE_KINDS,
  projectFromRow,
  projectIndexSnapshotFromRow,
  projectRegistryAuthorityNote,
  projectSourceFromRow,
  PROJECT_STATUSES,
  ProjectSlugSchema,
} from "../projects";
import type {
  ProjectRootKind,
  ProjectSourceKind,
  ProjectStatus,
} from "../projects/types";
import {
  resolveSafePath,
  SafePathError,
  type SafePathResult,
} from "./fs-safe-path";
import type { Tool, ToolResult } from "./types";

const PROJECT_TOOL_TIMEOUT_MS = 3_000;
const PROJECT_INDEX_MAX_FILE_BYTES = 256_000;
const PROJECT_GET_PROMOTED_TASK_LIMIT = 5;
const PROJECT_GET_OPEN_BLOCKER_LIMIT = 5;
const PROJECT_GET_TEXT_MAX_CHARS = 160;

const ProjectListInputSchema = z.object({
  includeArchived: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(100).default(50),
});

const ProjectGetInputSchema = z
  .object({
    id: z.string().trim().min(1).max(200).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
  })
  .refine((input) => Boolean(input.id || input.slug), {
    message: "Either id or slug is required.",
  });

const ProjectRegisterInputSchema = z.object({
  slug: ProjectSlugSchema,
  displayName: z.string().trim().min(1).max(200),
  rootKind: z.enum(PROJECT_ROOT_KINDS),
  rootRef: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !isNetworkRootRef(value), {
      message: "Network project sources are disabled.",
    }),
  status: z.enum(PROJECT_STATUSES).default("active"),
});

const ProjectAddSourceInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  kind: z.enum(PROJECT_SOURCE_KINDS),
  ref: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !isNetworkRootRef(value), {
      message: "Network project sources are disabled.",
    }),
});

const ProjectIndexInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  triggeredBy: z.string().trim().min(1).max(120).default("manual"),
});

const ProjectPromoteTaskInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  taskId: z.string().trim().min(1).max(200),
});

const ProjectSetStatusInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  status: z.enum(PROJECT_STATUSES),
});

export type ProjectListInput = z.infer<typeof ProjectListInputSchema>;
export type ProjectGetInput = z.infer<typeof ProjectGetInputSchema>;
export type ProjectRegisterInput = z.infer<typeof ProjectRegisterInputSchema>;
export type ProjectAddSourceInput = z.infer<typeof ProjectAddSourceInputSchema>;
export type ProjectIndexInput = z.infer<typeof ProjectIndexInputSchema>;
export type ProjectPromoteTaskInput = z.infer<
  typeof ProjectPromoteTaskInputSchema
>;
export type ProjectSetStatusInput = z.infer<typeof ProjectSetStatusInputSchema>;

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isNetworkRootRef(rootRef: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(rootRef.trim());
}

export function projectListScopeOf(input: ProjectListInput): string {
  return [
    "project.list",
    input.includeArchived ? "include_archived" : "active_only",
    `max:${input.maxResults ?? 50}`,
  ].join(":");
}

export function projectGetScopeOf(input: ProjectGetInput): string {
  return [
    "project.get",
    input.id ? `id:${input.id}` : "id:none",
    input.slug ? `slug:${input.slug}` : "slug:none",
  ].join(":");
}

export function projectRegisterScopeOf(input: ProjectRegisterInput): string {
  return [
    "project.register",
    `slug:${input.slug}`,
    `root_kind:${input.rootKind}`,
    `status:${input.status ?? "active"}`,
    `root_ref_sha256:${sha256(input.rootRef)}`,
  ].join(":");
}

export function projectAddSourceScopeOf(input: ProjectAddSourceInput): string {
  return [
    "project.add_source",
    `project:${input.projectId}`,
    `kind:${input.kind}`,
    `ref_sha256:${sha256(input.ref)}`,
  ].join(":");
}

export function projectIndexScopeOf(input: ProjectIndexInput): string {
  return [
    "project.index",
    `project:${input.projectId}`,
    `triggered_by:${input.triggeredBy ?? "manual"}`,
    "mode:deterministic_markers",
  ].join(":");
}

export function projectPromoteTaskScopeOf(
  input: ProjectPromoteTaskInput,
): string {
  return [
    "project.promote_task",
    `project:${input.projectId}`,
    `task:${input.taskId}`,
  ].join(":");
}

export function projectSetStatusScopeOf(input: ProjectSetStatusInput): string {
  return [
    "project.set_status",
    `project:${input.projectId}`,
    `status:${input.status}`,
  ].join(":");
}

function projectWithSourceCount(
  db: DatabaseType.Database,
  row: NonNullable<ReturnType<typeof getRegisteredProject>>,
) {
  return projectFromRow({
    ...row,
    source_count: countProjectSources(db, row.id),
  });
}

function boundedText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= PROJECT_GET_TEXT_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, PROJECT_GET_TEXT_MAX_CHARS - 3)}...`;
}

function projectArtifactSummary(db: DatabaseType.Database, projectId: string) {
  const counts = getProjectArtifactCounts(db, projectId);
  const promotedTasks = listPromotedProjectTasks(
    db,
    projectId,
    PROJECT_GET_PROMOTED_TASK_LIMIT,
  ).map((task) => ({
    id: task.id,
    title: boundedText(task.title),
    status: task.status,
    confidence: task.confidence,
    updatedAt: task.updated_at,
  }));
  const openBlockers = listOpenProjectBlockers(
    db,
    projectId,
    PROJECT_GET_OPEN_BLOCKER_LIMIT,
  ).map((blocker) => ({
    id: blocker.id,
    description: boundedText(blocker.description),
    status: blocker.status,
    taskId: blocker.task_id,
  }));
  const latestSnapshotRow = listProjectIndexSnapshots(db, projectId)[0] ?? null;
  const latestSnapshot = latestSnapshotRow
    ? projectIndexSnapshotFromRow(latestSnapshotRow)
    : null;

  return {
    derivedState: true,
    counts,
    promotedTasks: {
      limit: PROJECT_GET_PROMOTED_TASK_LIMIT,
      items: promotedTasks,
    },
    openBlockers: {
      limit: PROJECT_GET_OPEN_BLOCKER_LIMIT,
      items: openBlockers,
    },
    latestSnapshot,
    indexFreshness: latestSnapshot
      ? {
          indexedAt: latestSnapshot.finishedAt,
          status: latestSnapshot.status,
          sourcesSeen: latestSnapshot.sourcesSeen,
          artifactsExtracted: latestSnapshot.artifactsExtracted,
        }
      : null,
    semantics: {
      promotedTasks: "commitments",
      extractedTasks: "candidate_tasks",
    },
  };
}

async function validateSourcePointer(input: ProjectAddSourceInput) {
  if (isNetworkRootRef(input.ref)) {
    return denied(
      "Network project sources are not supported in Phase 5 A3.",
      "network_project_source_disabled",
    );
  }

  if (input.kind !== "file") return null;

  try {
    await resolveSafePath(input.ref);
    return null;
  } catch (error) {
    if (error instanceof SafePathError) {
      return denied(error.message, `unsafe_file_ref_${error.reason}`);
    }
    return denied("File source ref could not be validated.", "unsafe_file_ref");
  }
}

async function validateSourcePointerForIndex(
  source: ProjectSourceRow,
): Promise<{ denied: ToolResult } | { safePath: SafePathResult | null }> {
  if (isNetworkRootRef(source.ref)) {
    return {
      denied: denied(
        "Network project sources are not supported in Phase 5 A7.",
        "network_project_source_disabled",
      ),
    };
  }

  if (source.kind !== "file") return { safePath: null };

  try {
    return { safePath: await resolveSafePath(source.ref) };
  } catch (error) {
    if (error instanceof SafePathError) {
      return {
        denied: denied(error.message, `unsafe_file_ref_${error.reason}`),
      };
    }
    return {
      denied: denied(
        "File source ref could not be validated.",
        "unsafe_file_ref",
      ),
    };
  }
}

function originRefForMarker(
  source: ProjectSourceRow,
  marker: ReturnType<typeof extractProjectMarkers>[number],
): string {
  return `${source.ref}#L${marker.line}:C${marker.column}:${marker.kind}:${marker.marker}`;
}

async function extractRegisteredFileSourceMarkers(input: {
  db: DatabaseType.Database;
  projectId: string;
  source: ProjectSourceRow;
  safePath: SafePathResult;
  now: number;
}): Promise<number> {
  const metadata = await stat(input.safePath.resolvedPath);
  if (!metadata.isFile()) return 0;
  if (metadata.size > PROJECT_INDEX_MAX_FILE_BYTES) {
    throw new Error(
      "registered file source exceeds A7 marker extraction limit",
    );
  }

  const content = await readFile(input.safePath.resolvedPath, {
    encoding: "utf8",
    flag: "r",
  });

  let created = 0;
  for (const marker of extractProjectMarkers(content)) {
    const originRef = originRefForMarker(input.source, marker);
    if (marker.kind === "task") {
      if (getProjectTaskByOrigin(input.db, input.projectId, originRef)) {
        continue;
      }
      insertProjectTask(input.db, {
        id: createOpaqueProjectTaskId(),
        projectId: input.projectId,
        title: marker.text,
        status: "extracted",
        confidence: marker.confidence ?? 0.8,
        promoted: false,
        originRef,
        createdAt: input.now,
        updatedAt: input.now,
      });
      created += 1;
    } else {
      if (getProjectBlockerByOrigin(input.db, input.projectId, originRef)) {
        continue;
      }
      insertProjectBlocker(input.db, {
        id: createOpaqueProjectBlockerId(),
        projectId: input.projectId,
        description: marker.text,
        status: "open",
        originRef,
      });
      created += 1;
    }
  }
  return created;
}

export const projectListTool: Tool<ProjectListInput> = {
  id: "project.list",
  name: "List Projects",
  description:
    "Read registered Phase 5 projects from the local derived project registry.",
  requiredSafetyTag: "ALLOW",
  inputSchema: ProjectListInputSchema,
  scopeOf: projectListScopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }

    const db = context.db;
    const rows = listRegisteredProjects(db, {
      includeArchived: input.includeArchived,
      limit: input.maxResults,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message:
        rows.length === 0
          ? "No registered projects found."
          : "Registered projects found.",
      data: {
        projects: rows.map((row) => projectWithSourceCount(db, row)),
        count: rows.length,
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectGetTool: Tool<ProjectGetInput> = {
  id: "project.get",
  name: "Get Project",
  description:
    "Read one registered Phase 5 project from the local derived project registry.",
  requiredSafetyTag: "ALLOW",
  inputSchema: ProjectGetInputSchema,
  scopeOf: projectGetScopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }

    const row = getRegisteredProject(context.db, {
      id: input.id,
      slug: input.slug,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message: row
        ? "Registered project found."
        : "Registered project not found.",
      data: {
        project: row ? projectWithSourceCount(context.db, row) : null,
        artifactSummary: row
          ? projectArtifactSummary(context.db, row.id)
          : null,
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectRegisterTool: Tool<ProjectRegisterInput> = {
  id: "project.register",
  name: "Register Project",
  description:
    "Register a Phase 5 project in the local derived project registry after explicit approval.",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  inputSchema: ProjectRegisterInputSchema,
  scopeOf: projectRegisterScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }
    if (isNetworkRootRef(input.rootRef)) {
      return denied(
        "Network project sources are not supported in Phase 5 A2.",
        "network_project_source_disabled",
      );
    }
    if (getRegisteredProject(context.db, { slug: input.slug })) {
      return denied("Project slug is already registered.", "duplicate_slug");
    }

    const draft = createProjectRegistrationDraft({
      slug: input.slug,
      displayName: input.displayName,
      rootKind: input.rootKind as ProjectRootKind,
      rootRef: input.rootRef,
      status: input.status,
    });
    const createdAt = Date.now();
    const row = insertRegisteredProject(context.db, {
      id: draft.id,
      slug: draft.slug,
      displayName: draft.displayName,
      rootKind: draft.rootKind,
      rootRef: draft.rootRef,
      status: draft.status,
      createdAt,
      archivedAt: draft.status === "archived" ? createdAt : null,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message: "Project registered.",
      data: {
        project: projectFromRow(row),
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectAddSourceTool: Tool<ProjectAddSourceInput> = {
  id: "project.add_source",
  name: "Add Project Source",
  description:
    "Add a known source pointer to the Phase 5 project source ledger after explicit approval. This does not index or read source contents.",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  inputSchema: ProjectAddSourceInputSchema,
  scopeOf: projectAddSourceScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }

    const project = getRegisteredProject(context.db, { id: input.projectId });
    if (!project) {
      return denied("Project is not registered.", "project_not_found");
    }

    const pointerDenied = await validateSourcePointer(input);
    if (pointerDenied) return pointerDenied;

    const row = insertProjectSource(context.db, {
      id: createOpaqueProjectSourceId(),
      projectId: project.id,
      kind: input.kind as ProjectSourceKind,
      ref: input.ref.trim(),
      lastIndexedAt: null,
      sourceHash: null,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message: "Project source added.",
      data: {
        source: projectSourceFromRow(row),
        indexed: false,
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectIndexTool: Tool<ProjectIndexInput> = {
  id: "project.index",
  name: "Index Project Snapshot",
  description:
    "Run a Phase 5 index snapshot after explicit approval. A7 reads only explicitly registered safe file sources for deterministic markers.",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  inputSchema: ProjectIndexInputSchema,
  scopeOf: projectIndexScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }

    const project = getRegisteredProject(context.db, { id: input.projectId });
    if (!project) {
      return denied("Project is not registered.", "project_not_found");
    }

    const startedAt = Date.now();
    const sources = listProjectSources(context.db, project.id);
    const sourcesSeen = sources.length;
    if (hasActiveProjectIndexSnapshot(context.db, project.id)) {
      const row = insertProjectIndexSnapshot(context.db, {
        id: createOpaqueProjectIndexSnapshotId(),
        projectId: project.id,
        startedAt,
        finishedAt: startedAt,
        sourcesSeen,
        artifactsExtracted: 0,
        triggeredBy: input.triggeredBy,
        status: "rejected",
      });
      return {
        ok: false,
        status: "DENIED",
        message:
          "Project index snapshot rejected because one is already active.",
        data: {
          reason: "active_snapshot_exists",
          snapshot: projectIndexSnapshotFromRow(row),
          indexed: false,
          extracted: false,
        },
      };
    }

    const row = insertProjectIndexSnapshot(context.db, {
      id: createOpaqueProjectIndexSnapshotId(),
      projectId: project.id,
      startedAt,
      finishedAt: null,
      sourcesSeen,
      artifactsExtracted: 0,
      triggeredBy: input.triggeredBy,
      status: "running",
    });

    const safeFileSources: Array<{
      source: ProjectSourceRow;
      safePath: SafePathResult;
    }> = [];
    for (const source of sources) {
      const validation = await validateSourcePointerForIndex(source);
      if ("denied" in validation) {
        const failed = finishProjectIndexSnapshot(context.db, {
          id: row.id,
          finishedAt: Date.now(),
          status: "failed",
        });
        return {
          ok: false,
          status: "ERROR",
          message: "Project index snapshot failed during metadata validation.",
          data: {
            reason: "source_validation_failed",
            snapshot: failed ? projectIndexSnapshotFromRow(failed) : null,
            indexed: false,
            extracted: false,
          },
        };
      }
      if (validation.safePath) {
        safeFileSources.push({ source, safePath: validation.safePath });
      }
    }

    let artifactsExtracted = 0;
    try {
      for (const source of sources) {
        updateProjectSourceIndexMetadata(context.db, {
          id: source.id,
          lastIndexedAt: startedAt,
          sourceHash: null,
        });
      }
      for (const fileSource of safeFileSources) {
        artifactsExtracted += await extractRegisteredFileSourceMarkers({
          db: context.db,
          projectId: project.id,
          source: fileSource.source,
          safePath: fileSource.safePath,
          now: startedAt,
        });
      }
    } catch {
      const failed = finishProjectIndexSnapshot(context.db, {
        id: row.id,
        finishedAt: Date.now(),
        status: "failed",
        artifactsExtracted,
      });
      return {
        ok: false,
        status: "ERROR",
        message: "Project index snapshot failed during metadata update.",
        data: {
          reason: "source_metadata_update_failed",
          snapshot: failed ? projectIndexSnapshotFromRow(failed) : null,
          indexed: false,
          extracted: false,
        },
      };
    }

    const completed = finishProjectIndexSnapshot(context.db, {
      id: row.id,
      finishedAt: Date.now(),
      status: "completed",
      artifactsExtracted,
    });

    return {
      ok: true,
      status: "COMPLETED",
      message: "Project index snapshot recorded.",
      data: {
        snapshot: completed ? projectIndexSnapshotFromRow(completed) : null,
        indexed: true,
        extracted: artifactsExtracted > 0,
        artifactsExtracted,
        sourcesRead: safeFileSources.length,
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectPromoteTaskTool: Tool<ProjectPromoteTaskInput> = {
  id: "project.promote_task",
  name: "Promote Project Task",
  description:
    "Promote an existing extracted Phase 5 project task to a commitment after explicit approval. This does not index, read sources, or write memory.",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  inputSchema: ProjectPromoteTaskInputSchema,
  scopeOf: projectPromoteTaskScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }

    const project = getRegisteredProject(context.db, { id: input.projectId });
    if (!project) {
      return denied("Project is not registered.", "project_not_found");
    }

    const task = getProjectTask(context.db, input.taskId);
    if (!task || task.project_id !== project.id) {
      return denied("Project task is not registered.", "task_not_found");
    }
    if (task.promoted === 1) {
      return denied(
        "Project task is already promoted.",
        "task_already_promoted",
      );
    }
    if (task.status !== "extracted") {
      return denied(
        "Only extracted project tasks can be promoted.",
        "task_not_promotable",
      );
    }

    const updated = promoteProjectTask(context.db, {
      projectId: project.id,
      taskId: task.id,
      updatedAt: Date.now(),
    });
    if (!updated || updated.promoted !== 1) {
      return {
        ok: false,
        status: "ERROR",
        message: "Project task promotion failed.",
        data: { reason: "promotion_failed" },
      };
    }

    return {
      ok: true,
      status: "COMPLETED",
      message: "Project task promoted.",
      data: {
        task: {
          id: updated.id,
          projectId: updated.project_id,
          promoted: updated.promoted === 1,
          updatedAt: updated.updated_at,
        },
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectSetStatusTool: Tool<ProjectSetStatusInput> = {
  id: "project.set_status",
  name: "Set Project Status",
  description:
    "Change the status of an existing Phase 5 project after explicit approval. This does not index, read sources, summarize, or write memory.",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  inputSchema: ProjectSetStatusInputSchema,
  scopeOf: projectSetStatusScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input, context) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }
    if (!context.db) {
      return denied(
        "Project registry database is unavailable.",
        "db_unavailable",
      );
    }

    const project = getRegisteredProject(context.db, { id: input.projectId });
    if (!project) {
      return denied("Project is not registered.", "project_not_found");
    }
    if (project.status === input.status) {
      return denied(
        "Project already has requested status.",
        "project_status_unchanged",
      );
    }

    const updated = updateProjectStatus(context.db, {
      id: project.id,
      status: input.status as ProjectStatus,
      updatedAt: Date.now(),
    });
    if (!updated || updated.status !== input.status) {
      return {
        ok: false,
        status: "ERROR",
        message: "Project status update failed.",
        data: { reason: "project_status_update_failed" },
      };
    }

    return {
      ok: true,
      status: "COMPLETED",
      message: "Project status updated.",
      data: {
        project: {
          id: updated.id,
          status: updated.status,
          archivedAt: updated.archived_at,
        },
        derivedState: true,
        authority: projectRegistryAuthorityNote(),
      },
    };
  },
};

export const projectReadTools = [projectListTool, projectGetTool] as const;
export const projectRegisterToolScaffold = projectRegisterTool;
export const projectMutationTools = [
  projectRegisterTool,
  projectAddSourceTool,
  projectIndexTool,
  projectPromoteTaskTool,
  projectSetStatusTool,
] as const;
export { PROJECT_TOOL_TIMEOUT_MS };
