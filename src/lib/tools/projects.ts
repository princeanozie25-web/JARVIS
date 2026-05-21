import { createHash } from "node:crypto";
import { z } from "zod";
import { getRegisteredProject, listRegisteredProjects } from "../db/projects";
import {
  createProjectRegistrationDraft,
  projectFromRow,
  projectRegistryAuthorityNote,
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
  slug: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  rootKind: z.enum(["fs", "memory", "obsidian", "virtual"]),
  rootRef: z.string().trim().min(1).max(500),
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

export const projectRegisterToolScaffold: Tool<ProjectRegisterInput> = {
  id: "project.register",
  name: "Register Project",
  description:
    "Scaffold for approval-gated Phase 5 project registration. It is intentionally not registered live in W1.",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  inputSchema: ProjectRegisterInputSchema,
  scopeOf: projectRegisterScopeOf,
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: PROJECT_TOOL_TIMEOUT_MS,
  async execute(input) {
    return {
      ok: false,
      status: "DENIED",
      message:
        "Project registration is scaffolded but not live until the approval architecture is extended for Phase 5.",
      data: {
        reason: "phase_5_project_register_not_live",
        draft: createProjectRegistrationDraft({
          slug: input.slug,
          displayName: input.displayName,
          rootKind: input.rootKind as ProjectRootKind,
          rootRef: input.rootRef,
        }),
      },
    };
  },
};

export const projectReadTools = [projectListTool, projectGetTool] as const;
export { PROJECT_TOOL_TIMEOUT_MS };
