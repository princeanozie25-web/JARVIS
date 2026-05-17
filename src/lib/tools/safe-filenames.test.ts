import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertPathDirectChild,
  executionPathSegment,
  SAFE_FILENAME_SEGMENT_MAX_LENGTH,
} from "./safe-filenames";

const hostileExecutionIds = [
  { label: "relative slash escape", value: "../../escape" },
  { label: "relative backslash escape", value: "..\\..\\escape" },
  { label: "nested slash escape", value: "abc/../../escape" },
  { label: "nested backslash escape", value: "abc\\..\\escape" },
  { label: "null byte", value: "id-with-null-byte\0tail" },
  { label: "windows absolute path", value: "C:\\Windows\\System32" },
  { label: "posix absolute path", value: "/etc/passwd" },
  { label: "extremely long id", value: "x".repeat(2_000) },
  { label: "empty id", value: "" },
] as const;

describe("safe execution filename segments", () => {
  it.each(hostileExecutionIds)(
    "sanitizes hostile execution id: $label",
    ({ value }) => {
      const segment = executionPathSegment(value);

      expect(segment).toMatch(/^exec_[A-Za-z0-9_-]+$/);
      expect(segment).not.toContain("..");
      expect(segment).not.toContain("/");
      expect(segment).not.toContain("\\");
      expect(segment).not.toContain(":");
      expect(segment).not.toContain("\0");
      expect(segment.length).toBeGreaterThan(0);
      expect(segment.length).toBeLessThanOrEqual(
        SAFE_FILENAME_SEGMENT_MAX_LENGTH,
      );
    },
  );

  it.each(hostileExecutionIds)(
    "keeps temp and backup paths contained for: $label",
    ({ value }) => {
      const segment = executionPathSegment(value);
      const targetParent = resolve("C:/jarvis-workspace/docs");
      const tempPath = resolve(targetParent, `.target.txt.${segment}.tmp`);
      const backupRoot = resolve("C:/jarvis-workspace/.jarvis-trash/backups");
      const backupPath = resolve(backupRoot, segment);

      expect(() => assertPathDirectChild(targetParent, tempPath)).not.toThrow();
      expect(dirname(tempPath)).toBe(targetParent);
      expect(() => assertPathDirectChild(backupRoot, backupPath)).not.toThrow();
      expect(dirname(backupPath)).toBe(backupRoot);
    },
  );

  it("does not interpolate raw execution ids into filesystem path templates", () => {
    const files = [
      "src/lib/tools/fs-write.ts",
      "src/lib/tools/fs-undo.ts",
    ] as const;

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(
        /\$\{\s*(?:context\.executionId|input\.executionId|row\.execution_id)\s*\}/,
      );
    }
  });
});
