import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultToolOutputDir,
  INLINE_OUTPUT_BYTE_LIMIT,
  persistToolOutput,
} from "./persist-output";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "jarvis-tool-output-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("persistToolOutput", () => {
  it("stores small payloads inline and reports no truncation", () => {
    const result = persistToolOutput(
      "exec-small",
      { hello: "world" },
      { dataDir },
    );

    expect(result.truncated).toBe(false);
    expect(result.externalPath).toBeUndefined();
    expect(result.byteSize).toBe(Buffer.byteLength(result.outputJson, "utf8"));
    expect(JSON.parse(result.outputJson)).toEqual({ hello: "world" });
  });

  it("externalises payloads larger than the inline cap", () => {
    const huge = "a".repeat(INLINE_OUTPUT_BYTE_LIMIT + 16);
    const result = persistToolOutput("exec-large", { text: huge }, { dataDir });

    expect(result.truncated).toBe(true);
    expect(result.externalPath).toBeDefined();
    expect(result.externalAbsolutePath).toBeDefined();

    const pointer = JSON.parse(result.outputJson);
    expect(pointer).toMatchObject({
      truncated: true,
      externalPath: result.externalPath,
      byteSize: result.byteSize,
    });
    expect(pointer.externalPath).toMatch(/^exec_[A-Za-z0-9_-]+\.json$/);
    expect(result.externalAbsolutePath!.startsWith(dataDir)).toBe(true);

    const restored = JSON.parse(
      readFileSync(result.externalAbsolutePath!, "utf8"),
    ) as { text: string };
    expect(restored.text.length).toBe(huge.length);
  });

  it("respects a custom inline byte limit", () => {
    const result = persistToolOutput(
      "exec-custom",
      { value: "x".repeat(32) },
      { dataDir, inlineByteLimit: 8 },
    );

    expect(result.truncated).toBe(true);
    expect(result.externalPath).toBeDefined();
  });

  it("never writes outside the configured dataDir", () => {
    const big = "z".repeat(INLINE_OUTPUT_BYTE_LIMIT + 1);
    const result = persistToolOutput(
      "../../escape",
      { text: big },
      { dataDir },
    );

    expect(result.externalAbsolutePath!.startsWith(dataDir)).toBe(true);
  });

  it("handles unserializable data without throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = persistToolOutput("exec-circular", circular, { dataDir });
    expect(result.truncated).toBe(false);
    expect(JSON.parse(result.outputJson)).toEqual({ unserializable: true });
  });

  it("defaults the data dir to data/tool-outputs", () => {
    expect(defaultToolOutputDir()).toBe(join("data", "tool-outputs"));
  });
});
