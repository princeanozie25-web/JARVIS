import { createHash } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import { z } from "zod";
import {
  hasActiveProjectIndexSnapshot,
  insertProjectIndexSnapshot,
} from "../db/project-index-snapshots";
import {
  countProjectSources,
  insertProjectSource,
} from "../db/project-sources";
import {
  getRegisteredProject,
  insertRegisteredProject,
  listRegisteredProjects,
} from "../db/projects";
import {
  createOpaqueProjectSourceId,
  createOpaqueProjectIndexSnapshotId,
  createProjectRegistrationDraft,
  PROJECT_ROOT_KINDS,
  PROJECT_SOURCE_KINDS,
  projectFromRow,
  projectIndexSnapshotFromRow,
  projectRegistryAuthorityNote,
  projectSourceFromRow,
  PROJECT_STATUSES,
  ProjectSlugSchema,
} from "../projects";
import type { ProjectRootKind, ProjectSourceKind } from "../projects/types";
import { resolveSafePath, SafePathError } from "./fs-safe-path";
import type { Tool, ToolResult } from "./types";

const PROJECT_TOOL_TIMEOUT_MS = 3_000;

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

export type ProjectListInput = z.infer<typeof ProjectListInputSchema>;
export type ProjectGetInput = z.infer<typeof ProjectGetInputSchema>;
export type ProjectRegisterInput = z.infer<typeof ProjectRegisterInputSchema>;
export type ProjectAddSourceInput = z.infer<typeof ProjectAddSourceInputSchema>;
export type ProjectIndexInput = z.infer<typeof ProjectIndexInputSchema>;

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
    "mode:metadata_only",
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
    "Create a metadata-only Phase 5 index snapshot audit row after explicit approval. This does not read, scan, hash, extract, or write memory.",
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

    const now = Date.now();
    const sourcesSeen = countProjectSources(context.db, project.id);
    if (hasActiveProjectIndexSnapshot(context.db, project.id)) {
      const row = insertProjectIndexSnapshot(context.db, {
        id: createOpaqueProjectIndexSnapshotId(),
        projectId: project.id,
        startedAt: now,
        finishedAt: now,
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
      startedAt: now,
      finishedAt: now,
      sourcesSeen,
      artifactsExtracted: 0,
      triggeredBy: input.triggeredBy,
      status: "completed",
    });

    return {
      ok: true,
      status: "COMPLETED",
      message: "Project index snapshot recorded.",
      data: {
        snapshot: projectIndexSnapshotFromRow(row),
        indexed: false,
        extracted: false,
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
] as const;
export { PROJECT_TOOL_TIMEOUT_MS };
