import type DatabaseType from "better-sqlite3";
import {
  getProjectArtifactCounts,
  listOpenProjectBlockers,
  listPromotedProjectTasks,
  type ProjectArtifactCounts,
} from "../db/project-artifacts";
import { listProjectIndexSnapshots } from "../db/project-index-snapshots";
import { getRegisteredProject } from "../db/projects";
import type { ProjectStatus } from "./types";

export const PROJECT_CONTEXT_DEFAULT_BUDGET_CHARS = 2_400;
export const PROJECT_CONTEXT_MIN_BUDGET_CHARS = 320;
export const PROJECT_CONTEXT_MAX_BUDGET_CHARS = 8_000;
export const PROJECT_CONTEXT_PROMOTED_TASK_LIMIT = 5;
export const PROJECT_CONTEXT_OPEN_BLOCKER_LIMIT = 5;
const PROJECT_CONTEXT_TEXT_MAX_CHARS = 180;

export interface AssembleProjectContextInput {
  projectId?: string | null;
  maxChars?: number;
  now?: number;
}

export interface ProjectContextIdentity {
  id: string;
  slug: string;
  displayName: string;
  status: ProjectStatus;
  archivedAt: number | null;
}

export interface ProjectContextIndexFreshness {
  snapshotId: string;
  status: string;
  startedAt: number;
  finishedAt: number | null;
  snapshotAgeMs: number | null;
  sourcesSeen: number;
  artifactsExtracted: number;
}

export interface ProjectContextCommitment {
  id: string;
  title: string;
  status: string;
  confidence: number;
  updatedAt: number;
}

export interface ProjectContextOpenBlocker {
  id: string;
  description: string;
  status: string;
  taskId: string | null;
}

export interface ProjectContextBudget {
  maxChars: number;
  usedChars: number;
  truncated: boolean;
}

export interface ProjectContextAssembly {
  derivedState: true;
  authoritative: false;
  project: ProjectContextIdentity;
  indexFreshness: ProjectContextIndexFreshness | null;
  counts: ProjectArtifactCounts;
  commitments: {
    semantics: "promoted_tasks_are_commitments";
    limit: number;
    items: ProjectContextCommitment[];
  };
  openBlockers: {
    semantics: "open_blockers_only";
    limit: number;
    items: ProjectContextOpenBlocker[];
  };
  candidateTasks: {
    semantics: "unpromoted_extracted_tasks_are_candidates_only";
    count: number;
  };
  contextText: string;
  budget: ProjectContextBudget;
}

export type ProjectContextAssemblyResult =
  | {
      ok: true;
      context: ProjectContextAssembly;
    }
  | {
      ok: false;
      reason: "project_id_required" | "project_not_found";
      derivedState: true;
      authoritative: false;
      context: null;
    };

export function assembleProjectContext(
  db: DatabaseType.Database,
  input: AssembleProjectContextInput,
): ProjectContextAssemblyResult {
  const projectId = input.projectId?.trim();
  if (!projectId) {
    return fail("project_id_required");
  }

  const project = getRegisteredProject(db, { id: projectId });
  if (!project) {
    return fail("project_not_found");
  }

  const maxChars = normalizeBudget(input.maxChars);
  const counts = getProjectArtifactCounts(db, project.id);
  const commitments = listPromotedProjectTasks(
    db,
    project.id,
    PROJECT_CONTEXT_PROMOTED_TASK_LIMIT,
  ).map((task) => ({
    id: task.id,
    title: boundedText(task.title),
    status: task.status,
    confidence: task.confidence,
    updatedAt: task.updated_at,
  }));
  const blockers = listOpenProjectBlockers(
    db,
    project.id,
    PROJECT_CONTEXT_OPEN_BLOCKER_LIMIT,
  ).map((blocker) => ({
    id: blocker.id,
    description: boundedText(blocker.description),
    status: blocker.status,
    taskId: blocker.task_id,
  }));
  const latestSnapshot = listProjectIndexSnapshots(db, project.id)[0] ?? null;
  const indexFreshness = latestSnapshot
    ? {
        snapshotId: latestSnapshot.id,
        status: latestSnapshot.status,
        startedAt: latestSnapshot.started_at,
        finishedAt: latestSnapshot.finished_at,
        snapshotAgeMs:
          latestSnapshot.finished_at === null
            ? null
            : Math.max(
                0,
                (input.now ?? Date.now()) - latestSnapshot.finished_at,
              ),
        sourcesSeen: latestSnapshot.sources_seen,
        artifactsExtracted: latestSnapshot.artifacts_extracted,
      }
    : null;

  const baseText = buildContextText({
    project: {
      id: project.id,
      slug: project.slug,
      displayName: project.display_name,
      status: project.status,
      archivedAt: project.archived_at,
    },
    indexFreshness,
    counts,
    commitments,
    blockers,
  });
  const budgeted = enforceBudget(baseText, maxChars);

  return {
    ok: true,
    context: {
      derivedState: true,
      authoritative: false,
      project: {
        id: project.id,
        slug: project.slug,
        displayName: project.display_name,
        status: project.status,
        archivedAt: project.archived_at,
      },
      indexFreshness,
      counts,
      commitments: {
        semantics: "promoted_tasks_are_commitments",
        limit: PROJECT_CONTEXT_PROMOTED_TASK_LIMIT,
        items: commitments,
      },
      openBlockers: {
        semantics: "open_blockers_only",
        limit: PROJECT_CONTEXT_OPEN_BLOCKER_LIMIT,
        items: blockers,
      },
      candidateTasks: {
        semantics: "unpromoted_extracted_tasks_are_candidates_only",
        count: counts.extractedTasks,
      },
      contextText: budgeted.text,
      budget: {
        maxChars,
        usedChars: budgeted.text.length,
        truncated: budgeted.truncated,
      },
    },
  };
}

function fail(
  reason: "project_id_required" | "project_not_found",
): ProjectContextAssemblyResult {
  return {
    ok: false,
    reason,
    derivedState: true,
    authoritative: false,
    context: null,
  };
}

function normalizeBudget(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return PROJECT_CONTEXT_DEFAULT_BUDGET_CHARS;
  }
  return Math.min(
    Math.max(Math.trunc(value), PROJECT_CONTEXT_MIN_BUDGET_CHARS),
    PROJECT_CONTEXT_MAX_BUDGET_CHARS,
  );
}

function boundedText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= PROJECT_CONTEXT_TEXT_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, PROJECT_CONTEXT_TEXT_MAX_CHARS - 3)}...`;
}

function buildContextText(input: {
  project: ProjectContextIdentity;
  indexFreshness: ProjectContextIndexFreshness | null;
  counts: ProjectArtifactCounts;
  commitments: ProjectContextCommitment[];
  blockers: ProjectContextOpenBlocker[];
}): string {
  const freshness = input.indexFreshness
    ? [
        `Latest index: ${input.indexFreshness.status}`,
        `finished_at=${input.indexFreshness.finishedAt ?? "none"}`,
        `age_ms=${input.indexFreshness.snapshotAgeMs ?? "unknown"}`,
        `sources_seen=${input.indexFreshness.sourcesSeen}`,
        `artifacts_extracted=${input.indexFreshness.artifactsExtracted}`,
      ].join(", ")
    : "Latest index: none.";
  const commitmentLines =
    input.commitments.length === 0
      ? ["Commitments: none."]
      : [
          "Commitments:",
          ...input.commitments.map(
            (task) =>
              `- ${task.title} [${task.status}, confidence=${task.confidence}]`,
          ),
        ];
  const blockerLines =
    input.blockers.length === 0
      ? ["Open blockers: none."]
      : [
          "Open blockers:",
          ...input.blockers.map(
            (blocker) => `- ${blocker.description} [${blocker.status}]`,
          ),
        ];

  return [
    `Project context for ${input.project.displayName} (${input.project.slug}); status=${input.project.status}.`,
    "Derived state: true. Authoritative: false. Canonical truth remains in registered sources.",
    freshness,
    `Counts: candidate_tasks=${input.counts.extractedTasks}, promoted_tasks=${input.counts.promotedTasks}, open_blockers=${input.counts.openBlockers}, cleared_blockers=${input.counts.clearedBlockers}, decisions=${input.counts.decisions}, threads=${input.counts.threads}.`,
    "Promoted tasks are commitments; unpromoted extracted tasks are candidates only.",
    ...commitmentLines,
    ...blockerLines,
  ].join("\n");
}

function enforceBudget(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  if (maxChars <= 3) return { text: ".".repeat(maxChars), truncated: true };
  return {
    text: `${text.slice(0, maxChars - 3).trimEnd()}...`,
    truncated: true,
  };
}
