import { readFile, stat } from "node:fs/promises";
import { extname, relative } from "node:path";
import { TextDecoder } from "node:util";
import { z } from "zod";
import { resolveSafePath, SafePathError } from "./fs-safe-path";
import type { Tool, ToolContext, ToolResult } from "./types";

const READ_TXT_TIMEOUT_MS = 5_000;
const READ_PDF_TIMEOUT_MS = 5_000;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_PDF_FILE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_PDF_PAGES = 20;
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

const ReadPdfInputSchema = z.object({
  path: z.string().min(1),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(DEFAULT_MAX_PDF_PAGES)
    .optional()
    .default(DEFAULT_MAX_PDF_PAGES),
  maxChars: z
    .number()
    .int()
    .min(1)
    .max(MAX_RETURNED_CHARS)
    .optional()
    .default(DEFAULT_MAX_RETURNED_CHARS),
});

export type ReadPdfInput = z.infer<typeof ReadPdfInputSchema>;

type PdfTextItem = {
  str?: unknown;
  hasEOL?: unknown;
};

type PdfPage = {
  getTextContent(): Promise<{ items: unknown[] }>;
  cleanup?(): void;
};

type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void> | void;
};

type PdfJsModule = {
  getDocument(input: unknown): { promise: Promise<PdfDocument> };
};

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

function pdfScopeOf(input: ReadPdfInput): string {
  return `doc.read_pdf:${input.path}:${input.maxPages}:${input.maxChars}`;
}

function telemetryNotes(input: {
  path: string;
  extension: string;
  sizeBytes: number;
  truncated: boolean;
  pagesRead?: number;
  totalPages?: number;
}): string {
  const pageNotes =
    input.pagesRead === undefined || input.totalPages === undefined
      ? ""
      : ` pages_read=${input.pagesRead} total_pages=${input.totalPages}`;
  return `path=${input.path} extension=${input.extension} size_bytes=${input.sizeBytes}${pageNotes} truncated=${input.truncated}`;
}

function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function textItemString(item: unknown): string | null {
  if (item === null || typeof item !== "object") return null;
  const str = (item as PdfTextItem).str;
  return typeof str === "string" ? str : null;
}

function textItemHasEol(item: unknown): boolean {
  if (item === null || typeof item !== "object") return false;
  return (item as PdfTextItem).hasEOL === true;
}

async function loadPdfJs(): Promise<PdfJsModule> {
  return (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
}

async function extractPdfText(input: {
  buffer: Buffer;
  maxPages: number;
  maxChars: number;
  signal: AbortSignal;
}): Promise<{
  text: string;
  totalPages: number;
  pagesRead: number;
  truncated: boolean;
}> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(input.buffer),
    disableWorker: true,
    isEvalSupported: false,
    standardFontDataUrl: import.meta.resolve("pdfjs-dist/standard_fonts/"),
  });
  const document = await loadingTask.promise;
  let text = "";
  let pagesRead = 0;
  let truncated = false;

  try {
    const pagesToRead = Math.min(document.numPages, input.maxPages);
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      if (input.signal.aborted) {
        return { text, totalPages: document.numPages, pagesRead, truncated };
      }
      if (text.length >= input.maxChars) {
        truncated = true;
        break;
      }

      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        pagesRead += 1;
        for (const item of content.items) {
          const chunk = textItemString(item);
          if (chunk === null) continue;
          const separator = text.length > 0 ? " " : "";
          const next = `${separator}${chunk}`;
          const remaining = input.maxChars - text.length;
          if (next.length > remaining) {
            text += next.slice(0, remaining);
            truncated = true;
            break;
          }
          text += next;
          if (textItemHasEol(item) && text.length < input.maxChars) {
            text += "\n";
          }
        }
      } finally {
        page.cleanup?.();
      }
    }

    if (document.numPages > input.maxPages) {
      truncated = true;
    }

    return { text, totalPages: document.numPages, pagesRead, truncated };
  } finally {
    await document.destroy();
  }
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

export const docReadPdfTool: Tool<ReadPdfInput> = {
  id: "doc.read_pdf",
  name: "Read PDF Document",
  description:
    "Extract text from a PDF document inside the configured workspace with strict page, size, and character limits.",
  requiredSafetyTag: "ALLOW",
  inputSchema: ReadPdfInputSchema,
  scopeOf: pdfScopeOf,
  reversibilityClass: "PURE_READ",
  timeoutMs: READ_PDF_TIMEOUT_MS,
  async execute(input, context: ToolContext) {
    if (context.signal.aborted) {
      return denied("Tool execution aborted.", "aborted");
    }

    try {
      const safePath = await resolveSafePath(input.path);
      const extension = extname(safePath.resolvedPath).toLowerCase();
      if (extension !== ".pdf") {
        return denied(
          "File extension is not supported.",
          "unsupported_file_type",
        );
      }

      const info = await stat(safePath.resolvedPath);
      if (!info.isFile()) {
        return denied("Path is not a file.", "not_file");
      }
      if (info.size > MAX_PDF_FILE_BYTES) {
        return denied("File exceeds 5 MB read limit.", "file_too_large");
      }

      const buffer = await readFile(safePath.resolvedPath);
      if (!hasPdfMagicBytes(buffer)) {
        return denied("File is not a valid PDF.", "invalid_pdf_magic");
      }

      const extracted = await extractPdfText({
        buffer,
        maxPages: input.maxPages,
        maxChars: input.maxChars,
        signal: context.signal,
      });
      const path =
        relative(safePath.workspaceRoot, safePath.resolvedPath) || ".";

      return {
        ok: true,
        status: "COMPLETED",
        message: "PDF document read.",
        data: {
          path,
          extension,
          sizeBytes: buffer.byteLength,
          pagesRead: extracted.pagesRead,
          totalPages: extracted.totalPages,
          truncated: extracted.truncated,
          text: extracted.text,
        },
        telemetry: {
          notes: telemetryNotes({
            path,
            extension,
            sizeBytes: buffer.byteLength,
            pagesRead: extracted.pagesRead,
            totalPages: extracted.totalPages,
            truncated: extracted.truncated,
          }),
        },
      };
    } catch (error) {
      if (error instanceof SafePathError) {
        return safeError(error);
      }
      return denied("PDF could not be parsed.", "pdf_parse_error");
    }
  },
};

export const documentReaderTools = [docReadTxtTool, docReadPdfTool];

export {
  ALLOWED_TEXT_EXTENSIONS,
  DEFAULT_MAX_RETURNED_CHARS,
  DEFAULT_MAX_PDF_PAGES,
  MAX_PDF_FILE_BYTES,
  MAX_TEXT_FILE_BYTES,
  READ_PDF_TIMEOUT_MS,
  READ_TXT_TIMEOUT_MS,
};
