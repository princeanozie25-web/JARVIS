import { createHash } from "node:crypto";
import { z } from "zod";
import {
  getRegisteredProject,
  insertRegisteredProject,
  listRegisteredProjects,
} from "../db/projects";
import {
  createProjectRegistrationDraft,
  PROJECT_ROOT_KINDS,
  projectFromRow,
  projectRegistryAuthorityNote,
  PROJECT_STATUSES,
  ProjectSlugSchema,
} from "../projects";
import type { ProjectRootKind } from "../projects/types";
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

export type ProjectListInput = z.infer<typeof ProjectListInputSchema>;
export type ProjectGetInput = z.infer<typeof ProjectGetInputSchema>;
export type ProjectRegisterInput = z.infer<typeof ProjectRegisterInputSchema>;

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

    const rows = listRegisteredProjects(context.db, {
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
        projects: rows.map(projectFromRow),
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
        project: row ? projectFromRow(row) : null,
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

export const projectReadTools = [projectListTool, projectGetTool] as const;
export const projectRegisterToolScaffold = projectRegisterTool;
export const projectMutationTools = [projectRegisterTool] as const;
export { PROJECT_TOOL_TIMEOUT_MS };
