import type DatabaseType from "better-sqlite3";
import { getProjectState, listProjectStates } from "../db/project-state";
import { insertTelemetryEvent } from "../db/telemetry";

export type ProjectContextDetectionSource = "explicit" | "keyword";

export interface DetectProjectContextInput {
  explicitProject?: string | null;
  text?: string | null;
  now?: () => number;
}

export interface ProjectContextDetectionResult {
  projectId: string;
  projectName: string;
  source: ProjectContextDetectionSource;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function projectIdFromName(value: string): string {
  return normalize(value).replace(/\s+/g, "-");
}

function emitDetected(
  db: DatabaseType.Database,
  result: ProjectContextDetectionResult,
  input: DetectProjectContextInput,
): void {
  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "project_context_detected",
    success: true,
    notes: `source=${result.source} project_id=${result.projectId}`,
  });
}

export function detectProjectContext(
  db: DatabaseType.Database,
  input: DetectProjectContextInput,
): ProjectContextDetectionResult | null {
  const explicit = input.explicitProject?.trim();
  if (explicit) {
    const byId = getProjectState(db, explicit, { now: input.now });
    const existing =
      byId ??
      listProjectStates(db, { now: input.now }).find(
        (row) => normalize(row.project_name) === normalize(explicit),
      );
    const result: ProjectContextDetectionResult = {
      projectId: existing?.project_id ?? projectIdFromName(explicit),
      projectName: existing?.project_name ?? explicit,
      source: "explicit",
    };
    emitDetected(db, result, input);
    return result;
  }

  const text = normalize(input.text ?? "");
  if (!text) return null;

  const rows = listProjectStates(db, { now: input.now }).sort(
    (a, b) => b.project_name.length - a.project_name.length,
  );
  const match = rows.find((row) => {
    const name = normalize(row.project_name);
    const id = normalize(row.project_id);
    return (name && text.includes(name)) || (id && text.includes(id));
  });
  if (!match) return null;

  const result: ProjectContextDetectionResult = {
    projectId: match.project_id,
    projectName: match.project_name,
    source: "keyword",
  };
  emitDetected(db, result, input);
  return result;
}
