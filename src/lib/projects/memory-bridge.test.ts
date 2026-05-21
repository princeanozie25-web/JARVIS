import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLongTermMemory, listLongTermMemory } from "../db/memory";
import { applyMigrations } from "../db/schema";
import {
  discoverProjectMemorySourcePointers,
  isProjectMemoryBridgeEnabled,
  PROJECT_MEMORY_BRIDGE_FEATURE_FLAG,
} from "./memory-bridge";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function insertMemory(input: {
  id: string;
  content: string;
  project?: string | null;
}) {
  insertLongTermMemory(db, {
    id: input.id,
    category: "decision",
    content: input.content,
    source: "user",
    source_id: null,
    project: input.project ?? "jarvis",
    tags_json: JSON.stringify(["#project"]),
    sensitivity: "personal",
    created_at: 1_000,
    updated_at: 1_000,
    obsidian_path: `20-projects/jarvis/${input.id}.md`,
    hash: hash(input.content),
  });
}

describe("project memory bridge scaffold", () => {
  it("is disabled by default and performs no memory metadata read", () => {
    insertMemory({
      id: "mem_secret",
      content: "raw memory text must stay hidden",
    });
    const before = listLongTermMemory(db);

    const result = discoverProjectMemorySourcePointers({
      db,
      projectId: "proj_jarvis",
      projectSlug: "jarvis",
      env: {},
    });

    expect(isProjectMemoryBridgeEnabled({})).toBe(false);
    expect(result).toEqual({
      enabled: false,
      metadataRead: false,
      memoryIsPeerSource: true,
      derivedState: true,
      mutation: "none",
      reason: "feature_disabled",
      sourcePointers: [],
    });
    expect(listLongTermMemory(db)).toEqual(before);
    expect(JSON.stringify(result)).not.toContain("raw memory text");
    expect(JSON.stringify(result)).not.toContain("20-projects/jarvis");
  });

  it("fails closed when enabled because existing memory accessors expose content", () => {
    insertMemory({
      id: "mem_enabled_secret",
      content: "enabled bridge must not expose this memory body",
    });

    const result = discoverProjectMemorySourcePointers({
      db,
      projectId: "proj_jarvis",
      projectSlug: "jarvis",
      env: { [PROJECT_MEMORY_BRIDGE_FEATURE_FLAG]: "true" },
    });

    expect(
      isProjectMemoryBridgeEnabled({
        [PROJECT_MEMORY_BRIDGE_FEATURE_FLAG]: "true",
      }),
    ).toBe(true);
    expect(result).toEqual({
      enabled: true,
      metadataRead: false,
      memoryIsPeerSource: true,
      derivedState: true,
      mutation: "none",
      reason: "metadata_api_unavailable",
      sourcePointers: [],
    });
    expect(JSON.stringify(result)).not.toContain(
      "enabled bridge must not expose this memory body",
    );
    expect(JSON.stringify(result)).not.toContain("mem_enabled_secret");
  });
});
