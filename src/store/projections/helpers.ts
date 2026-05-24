import Database from "better-sqlite3";

export type ProjectionStatus = "ok" | "degraded";

export interface ProjectionPosture {
  readonly metadata_only: true;
  readonly raw_payload_included: false;
  readonly secrets_included: false;
  readonly executable_payload_included: false;
  readonly network_called: false;
  readonly ui_rendered: false;
}

export interface ProjectionOptions {
  readonly databasePath: string;
}

export const PROJECTION_POSTURE: ProjectionPosture = {
  metadata_only: true,
  raw_payload_included: false,
  secrets_included: false,
  executable_payload_included: false,
  network_called: false,
  ui_rendered: false,
};

export function withReadonlyDatabase<T>(
  databasePath: string,
  read: (db: Database.Database) => T,
): T {
  const db = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    return read(db);
  } finally {
    db.close();
  }
}

export function parseMetadataJson(value: string | null): boolean {
  if (value === null) return true;
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}

export function safeMetadataText(value: string): string {
  return /(api[_-]?key|password|secret|token|sk-)/i.test(value)
    ? "[redacted]"
    : value;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
