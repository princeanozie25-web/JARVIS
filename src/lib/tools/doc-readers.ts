import { readFile, stat } from "node:fs/promises";
import { extname, relative } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import { resolveSafePath, SafePathError } from "./fs-safe-path";
import type { Tool, ToolContext, ToolResult } from "./types";

const READ_TXT_TIMEOUT_MS = 5_000;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const DEFAULT_MAX_RETURNED_CHARS = 20_000;
const MAX_RETURNED_CHARS = 200_000;
const ALLOWED_TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
]);

const ReadTxtInputSchema = z.object({
  path: z.string().min(1),
  maxChars: z
    .number()
    .int()
    .min(1)
    .max(MAX_RETURNED_CHARS)
    .optional()
    .default(DEFAULT_MAX_RETURNED_CHARS),
});

export type ReadTxtInput = z.infer<typeof ReadTxtInputSchema>;

function denied(message: string, reason: string): ToolResult {
  return { ok: false, status: "DENIED", message, data: { reason } };
}

function safeError(error: unknown): ToolResult {
  if (error instanceof SafePathError) {
    return denied(error.message, error.reason);
  }
  return denied(
    error instanceof Error ? error.message : String(error),
    "document_read_error",
  );
}

function decodeText(buffer: Buffer): string | null {
  if (buffer.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

function scopeOf(input: ReadTxtInput): string {
  return `doc.read_txt:${input.path}:${input.maxChars}`;
}

function telemetryNotes(input: {
  path: string;
  extension: string;
  sizeBytes: number;
  truncated: boolean;
}): string {
  return `path=${input.path} extension=${input.extension} size_bytes=${input.sizeBytes} truncated=${input.truncated}`;
}

export const docReadTxtTool: Tool<ReadTxtInput> = {
  id: "doc.read_txt",
  name: "Read Text Document",
  description:
    "Read a UTF-8 text document inside the configured workspace with strict size and extension limits.",
  requiredSafetyTag: "ALLOW",
  inputSchema: ReadTxtInputSchema,
  scopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: READ_TXT_TIMEOUT_MS,
  async execute(input, context: ToolContext) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    try {
      const safePath = await resolveSafePath(input.path);
      const extension = extname(safePath.resolvedPath).toLowerCase();
      if (!ALLOWED_TEXT_EXTENSIONS.has(extension)) {
        return denied(
          "File extension is not supported.",
          "unsupported_file_type",
        );
      }

      const info = await stat(safePath.resolvedPath);
      if (!info.isFile()) {
        return denied("Path is not a file.", "not_file");
      }
      if (info.size > MAX_TEXT_FILE_BYTES) {
        return denied("File exceeds 1 MB read limit.", "file_too_large");
      }

      const buffer = await readFile(safePath.resolvedPath);
      const decoded = decodeText(buffer);
      if (decoded === null) {
        return denied("Binary files are not supported.", "binary_file");
      }

      const path =
        relative(safePath.workspaceRoot, safePath.resolvedPath) || ".";
      const text =
        decoded.length > input.maxChars
          ? decoded.slice(0, input.maxChars)
          : decoded;
      const truncated = text.length < decoded.length;

      // Local audit DB may store output_json with returned text; telemetry notes
      // intentionally carry metadata only.
      return {
        ok: true,
        status: "COMPLETED",
        message: "Text document read.",
        data: {
          path,
          extension,
          sizeBytes: buffer.byteLength,
          truncated,
          text,
        },
        telemetry: {
          notes: telemetryNotes({
            path,
            extension,
            sizeBytes: buffer.byteLength,
            truncated,
          }),
        },
      };
    } catch (error) {
      return safeError(error);
    }
  },
};

export const documentReaderTools = [docReadTxtTool];

export {
  ALLOWED_TEXT_EXTENSIONS,
  DEFAULT_MAX_RETURNED_CHARS,
  MAX_TEXT_FILE_BYTES,
  READ_TXT_TIMEOUT_MS,
};
