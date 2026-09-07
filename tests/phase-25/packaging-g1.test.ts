// Phase 25G — G1: standalone output, the JARVIS_DATA_DIR seam, loopback health.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveDataDir } from "../../src/lib/db/client-node";
import { resolveEventStorePath } from "../../src/store/app-event-store";
import { isLoopbackHost } from "../../app/api/health/route";

describe("25G G1 — data dir seam", () => {
  it("defaults to <cwd>/data so nothing changes for dev", () => {
    expect(resolveDataDir({})).toBe(resolve(process.cwd(), "data"));
    expect(resolveEventStorePath({})).toBe(resolve("data/event-store.db"));
  });

  it("follows JARVIS_DATA_DIR for both stores; an explicit event db path still wins", () => {
    expect(resolveDataDir({ JARVIS_DATA_DIR: "/tmp/jarvis-data" })).toBe(
      "/tmp/jarvis-data",
    );
    expect(resolveEventStorePath({ JARVIS_DATA_DIR: "/tmp/jarvis-data" })).toBe(
      "/tmp/jarvis-data/event-store.db",
    );
    expect(
      resolveEventStorePath({
        JARVIS_DATA_DIR: "/tmp/jarvis-data",
        JARVIS_EVENT_DB_PATH: "/x/y.db",
      }),
    ).toBe("/x/y.db");
    expect(
      resolveEventStorePath({
        JARVIS_DATA_DIR: "/tmp/jarvis-data",
        JARVIS_EVENT_STORE_ENABLED: "false",
      }),
    ).toBeNull();
  });
});

describe("25G G1 — standalone output", () => {
  it("next.config declares output: standalone and keeps better-sqlite3 external", () => {
    const text = readFileSync("next.config.ts", "utf8");
    expect(text).toMatch(/output:\s*"standalone"/);
    expect(text).toMatch(/serverExternalPackages:\s*\["better-sqlite3"\]/);
  });
});

describe("25G G1 — /api/health is loopback only", () => {
  it("accepts 127.0.0.1 / localhost / [::1] with or without a port, refuses everything else", () => {
    for (const ok of [
      "127.0.0.1",
      "127.0.0.1:3000",
      "localhost:3000",
      "LOCALHOST",
      "[::1]:3000",
    ]) {
      expect(isLoopbackHost(ok), ok).toBe(true);
    }
    for (const bad of [
      null,
      "",
      "0.0.0.0:3000",
      "jarvis.local:3000",
      "192.168.1.10:3000",
      "example.com",
    ]) {
      expect(isLoopbackHost(bad), String(bad)).toBe(false);
    }
  });
});
