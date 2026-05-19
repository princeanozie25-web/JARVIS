import Database from "better-sqlite3";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  READ_ONLY_PROVIDER_TOOL_IDS,
  WRITE_PROVIDER_TOOL_IDS,
} from "../chat/tool-continuation";
import { applyMigrations } from "../db/schema";
import { getToolCall } from "../db/tool-calls";
import { toAnthropicTools, toOpenAITools } from "../providers/tools";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { providerToolMetadata, tools } from ".";
import { InProcessToolRuntime } from "./runtime";

const allowDecision: RouterDecision = {
  intent: { intent: "DETERMINISTIC_COMMAND", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T0",
    requiredCapabilities: ["tools"],
    reason: "test",
  },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["text", "stream"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let workspaceRoot: string;
let outsideRoot: string;
let outputDir: string;
let previousWorkspaceRoot: string | undefined;
let telemetryEvents: Array<
  Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
>;

function runtime(): InProcessToolRuntime {
  return new InProcessToolRuntime(tools, {
    db,
    outputDataDir: outputDir,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-doc-readers-"));
  outsideRoot = mkdtempSync(join(tmpdir(), "jarvis-doc-outside-"));
  outputDir = mkdtempSync(join(tmpdir(), "jarvis-doc-outputs-"));
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
  telemetryEvents = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  db.close();
  rmSync(workspaceRoot, { recursive: true, force: true });
  rmSync(outsideRoot, { recursive: true, force: true });
  rmSync(outputDir, { recursive: true, force: true });
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
});

async function readTxt(input: { path: string; maxChars?: number }) {
  return runtime().runTool({
    toolId: "doc.read_txt",
    input,
    sessionId: "session-1",
    executionId: `exec-${input.path.replace(/[^a-z0-9]/gi, "_")}`,
    decision: allowDecision,
  });
}

async function readPdf(input: {
  path: string;
  maxPages?: number;
  maxChars?: number;
}) {
  return runtime().runTool({
    toolId: "doc.read_pdf",
    input,
    sessionId: "session-1",
    executionId: `exec-pdf-${input.path.replace(/[^a-z0-9]/gi, "_")}`,
    decision: allowDecision,
  });
}

async function readDocx(input: { path: string; maxChars?: number }) {
  return runtime().runTool({
    toolId: "doc.read_docx",
    input,
    sessionId: "session-1",
    executionId: `exec-docx-${input.path.replace(/[^a-z0-9]/gi, "_")}`,
    decision: allowDecision,
  });
}

function xmlString(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function makeSimpleDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs
      .map(
        (paragraph) =>
          `<w:p><w:r><w:t>${xmlString(paragraph)}</w:t></w:r></w:p>`,
      )
      .join("")}
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

async function makeDocxWithDocumentXml(documentXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file("word/document.xml", documentXml);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

function makeOleCompoundFixture(): Buffer {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(128, 0),
  ]);
}

function pdfString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function makePdfStream(text: string): string {
  const chunks = text.match(/.{1,1000}/g) ?? [""];
  const operations = chunks
    .map((chunk, index) => {
      const move = index === 0 ? "72 720 Td" : "0 -14 Td";
      return `${move} (${pdfString(chunk)}) Tj`;
    })
    .join("\n");
  return `BT /F1 12 Tf ${operations} ET`;
}

function makeSimplePdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("pending-pages");

  for (const text of pages) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents ${contentId} 0 R >>`,
    );
    const stream = makePdfStream(text);
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    );
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "binary");
}

function makeEncryptedPdfFixture(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] >>",
    "<< /Filter /Standard /V 1 /R 2 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R /Encrypt 4 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "binary");
}

describe("doc.read_txt", () => {
  it("reads .txt files", async () => {
    writeFileSync(join(workspaceRoot, "notes.txt"), "hello txt");

    await expect(readTxt({ path: "notes.txt" })).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        path: "notes.txt",
        extension: ".txt",
        sizeBytes: 9,
        truncated: false,
        text: "hello txt",
      },
    });
  });

  it("reads .md files", async () => {
    writeFileSync(join(workspaceRoot, "notes.md"), "# Heading");

    await expect(readTxt({ path: "notes.md" })).resolves.toMatchObject({
      ok: true,
      data: { extension: ".md", text: "# Heading" },
    });
  });

  it("reads .json files", async () => {
    writeFileSync(join(workspaceRoot, "data.json"), '{"ok":true}');

    await expect(readTxt({ path: "data.json" })).resolves.toMatchObject({
      ok: true,
      data: { extension: ".json", text: '{"ok":true}' },
    });
  });

  it("refuses unsupported extensions", async () => {
    writeFileSync(join(workspaceRoot, "document.pdf"), "not really a pdf");

    await expect(readTxt({ path: "document.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "unsupported_file_type" },
    });
  });

  it("refuses missing files", async () => {
    await expect(readTxt({ path: "missing.txt" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "not_found" },
    });
  });

  it("refuses binary files", async () => {
    writeFileSync(join(workspaceRoot, "binary.txt"), Buffer.from([0, 1, 2]));

    await expect(readTxt({ path: "binary.txt" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "binary_file" },
    });
  });

  it("refuses oversized files", async () => {
    writeFileSync(
      join(workspaceRoot, "large.log"),
      "a".repeat(1024 * 1024 + 1),
    );

    await expect(readTxt({ path: "large.log" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "file_too_large" },
    });
  });

  it("denies traversal outside the workspace", async () => {
    writeFileSync(join(outsideRoot, "outside.txt"), "outside");

    await expect(readTxt({ path: "../outside.txt" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("denies protected paths", async () => {
    writeFileSync(join(workspaceRoot, ".env.local"), "OPENAI_API_KEY=x");

    await expect(readTxt({ path: ".env.local" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "protected_path" },
    });
  });

  it("denies symlink escapes outside the workspace", async () => {
    writeFileSync(join(outsideRoot, "outside.txt"), "outside");
    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await expect(
      readTxt({ path: "escape/outside.txt" }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("truncates long text at the requested character limit", async () => {
    writeFileSync(join(workspaceRoot, "long.txt"), "abcdef");

    await expect(
      readTxt({ path: "long.txt", maxChars: 3 }),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        truncated: true,
        text: "abc",
      },
    });
  });

  it("does not put raw document text in telemetry notes", async () => {
    writeFileSync(join(workspaceRoot, "private.txt"), "secret document body");

    await readTxt({ path: "private.txt" });

    const completed = telemetryEvents.find(
      (event) => event.event_type === "tool_completed",
    );
    expect(completed).toMatchObject({
      execution_id: "exec-private_txt",
      tool_name: "doc.read_txt",
      notes: expect.stringContaining("path=private.txt"),
    });
    expect(completed?.notes).toContain("size_bytes=20");
    expect(completed?.notes).toContain("truncated=false");
    expect(JSON.stringify(telemetryEvents)).not.toContain(
      "secret document body",
    );
  });

  it("rejects paths containing a NUL byte", async () => {
    await expect(readTxt({ path: "notes\0.txt" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("rejects Windows-style absolute paths that escape the workspace", async () => {
    await expect(
      readTxt({ path: "C:\\Windows\\System32\\config\\sam" }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
    });
    await expect(
      readTxt({ path: "C:\\Users\\admin\\.aws\\credentials" }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
    });
  });

  it("is classified as a read-only provider tool and never a write tool", () => {
    expect(READ_ONLY_PROVIDER_TOOL_IDS.has("doc.read_txt")).toBe(true);
    expect(WRITE_PROVIDER_TOOL_IDS.has("doc.read_txt")).toBe(false);
  });

  it("denies credential filenames (credentials.json)", async () => {
    writeFileSync(join(workspaceRoot, "credentials.json"), "{}");
    await expect(readTxt({ path: "credentials.json" })).resolves.toMatchObject({
      ok: false,
      data: { reason: "protected_path" },
    });
  });

  it("denies service-account*.json variants", async () => {
    writeFileSync(join(workspaceRoot, "service-account.json"), "{}");
    writeFileSync(join(workspaceRoot, "service-account-prod.json"), "{}");
    writeFileSync(join(workspaceRoot, "main-service-account.json"), "{}");

    for (const path of [
      "service-account.json",
      "service-account-prod.json",
      "main-service-account.json",
    ]) {
      await expect(readTxt({ path })).resolves.toMatchObject({
        ok: false,
        data: { reason: "protected_path" },
      });
    }
  });

  it("denies firebase-adminsdk-*.json", async () => {
    writeFileSync(join(workspaceRoot, "firebase-adminsdk-abc123.json"), "{}");
    await expect(
      readTxt({ path: "firebase-adminsdk-abc123.json" }),
    ).resolves.toMatchObject({
      ok: false,
      data: { reason: "protected_path" },
    });
  });

  it("denies gcloud-key.json and application_default_credentials.json", async () => {
    writeFileSync(join(workspaceRoot, "gcloud-key.json"), "{}");
    writeFileSync(
      join(workspaceRoot, "application_default_credentials.json"),
      "{}",
    );

    await expect(readTxt({ path: "gcloud-key.json" })).resolves.toMatchObject({
      ok: false,
      data: { reason: "protected_path" },
    });
    await expect(
      readTxt({ path: "application_default_credentials.json" }),
    ).resolves.toMatchObject({
      ok: false,
      data: { reason: "protected_path" },
    });
  });

  it("denies aws-credentials, .npmrc, .pypirc, .netrc", async () => {
    writeFileSync(join(workspaceRoot, "aws-credentials"), "x");
    writeFileSync(join(workspaceRoot, ".npmrc"), "x");
    writeFileSync(join(workspaceRoot, ".pypirc"), "x");
    writeFileSync(join(workspaceRoot, ".netrc"), "x");

    for (const path of ["aws-credentials", ".npmrc", ".pypirc", ".netrc"]) {
      await expect(readTxt({ path })).resolves.toMatchObject({
        ok: false,
        data: { reason: "protected_path" },
      });
    }
  });

  it("denies *.kdbx, *.kdb, *.gpg, *.asc by extension (independent of read allowlist)", async () => {
    // These extensions are also not on the doc.read_txt allowlist, but the
    // protected-path check fires first when the file would otherwise be
    // reachable. Use the safe-path module via the runtime to confirm denial.
    writeFileSync(join(workspaceRoot, "vault.kdbx"), "x");
    writeFileSync(join(workspaceRoot, "vault.kdb"), "x");
    writeFileSync(join(workspaceRoot, "key.gpg"), "x");
    writeFileSync(join(workspaceRoot, "pubkey.asc"), "x");

    for (const path of ["vault.kdbx", "vault.kdb", "key.gpg", "pubkey.asc"]) {
      const result = await readTxt({ path });
      expect(result.ok).toBe(false);
      expect(result.data).toMatchObject({
        reason: expect.stringMatching(/protected_path|unsupported_file_type/),
      });
    }
  });

  it("denies files inside .aws/, .ssh/, .gnupg/, .config/gcloud/, .config/op/", async () => {
    const dirs = [".aws", ".ssh", ".gnupg", ".config/gcloud", ".config/op"];
    for (const dir of dirs) {
      mkdirSync(join(workspaceRoot, dir), { recursive: true });
      writeFileSync(join(workspaceRoot, dir, "data.json"), "{}");
      await expect(
        readTxt({ path: `${dir}/data.json` }),
      ).resolves.toMatchObject({
        ok: false,
        data: { reason: "protected_path" },
      });
    }
  });

  it("caps tool_calls.output_json and externalises large doc.read_txt results", async () => {
    // Write a file whose serialized JSON exceeds the 64 KB inline limit.
    const big = "a".repeat(100_000);
    writeFileSync(join(workspaceRoot, "big.txt"), big);

    const result = await readTxt({ path: "big.txt", maxChars: 100_000 });
    expect(result.ok).toBe(true);

    const row = getToolCall(db, "exec-big_txt");
    expect(row).toBeDefined();
    const stored = JSON.parse(row!.output_json ?? "null") as {
      truncated: boolean;
      externalPath?: string;
      byteSize?: number;
    };
    expect(stored.truncated).toBe(true);
    expect(stored.externalPath).toMatch(/^exec_[A-Za-z0-9_-]+\.json$/);
    expect(stored.byteSize).toBeGreaterThan(64 * 1024);

    const fullPath = join(outputDir, stored.externalPath!);
    const restored = JSON.parse(readFileSync(fullPath, "utf8")) as {
      text: string;
    };
    expect(restored.text.length).toBe(big.length);

    // Inline row stores only the pointer, never the document body.
    expect(row!.output_json).not.toContain("aaaa");
  });

  it("converts doc.read_txt to a strict OpenAI schema", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["doc.read_txt"].includes(toolId),
    );
    const openAiTool = toOpenAITools(metadata.definitions)?.[0];

    expect(openAiTool?.function.name).toBe("doc_read_txt");
    expect(openAiTool?.function.parameters).toMatchObject({
      type: "object",
      properties: {
        path: expect.objectContaining({ type: "string" }),
        maxChars: expect.objectContaining({ type: "integer" }),
      },
      required: ["path"],
      additionalProperties: false,
    });
    expect(
      objectSchemasMissingAdditionalProperties(openAiTool?.function.parameters),
    ).toEqual([]);
  });

  it("exposes doc.read_txt through Anthropic tool metadata", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["doc.read_txt"].includes(toolId),
    );
    const anthropicTool = toAnthropicTools(metadata.definitions)?.[0];

    expect(anthropicTool).toMatchObject({
      name: "doc_read_txt",
      description: expect.stringContaining("Read a UTF-8 text document"),
      input_schema: {
        type: "object",
        properties: {
          path: expect.objectContaining({ type: "string" }),
          maxChars: expect.objectContaining({ type: "integer" }),
        },
        required: ["path"],
      },
    });
  });
});

describe("doc.read_pdf", () => {
  it("reads simple PDF files", async () => {
    writeFileSync(
      join(workspaceRoot, "simple.pdf"),
      makeSimplePdf(["hello pdf"]),
    );

    await expect(readPdf({ path: "simple.pdf" })).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        path: "simple.pdf",
        extension: ".pdf",
        pagesRead: 1,
        totalPages: 1,
        truncated: false,
        text: expect.stringContaining("hello pdf"),
      },
    });
  });

  it("rejects non-PDF extensions", async () => {
    writeFileSync(join(workspaceRoot, "not-pdf.txt"), makeSimplePdf(["hello"]));

    await expect(readPdf({ path: "not-pdf.txt" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "unsupported_file_type" },
    });
  });

  it("rejects wrong PDF magic bytes", async () => {
    writeFileSync(join(workspaceRoot, "wrong.pdf"), "not really a pdf");

    await expect(readPdf({ path: "wrong.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_pdf_magic" },
    });
  });

  it("rejects missing files", async () => {
    await expect(readPdf({ path: "missing.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "not_found" },
    });
  });

  it("rejects protected paths", async () => {
    writeFileSync(join(workspaceRoot, ".env.pdf"), makeSimplePdf(["secret"]));

    await expect(readPdf({ path: ".env.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "protected_path" },
    });
  });

  it("rejects traversal and symlink escapes", async () => {
    writeFileSync(join(outsideRoot, "outside.pdf"), makeSimplePdf(["outside"]));

    await expect(readPdf({ path: "../outside.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });

    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "pdf-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await expect(
      readPdf({ path: "pdf-escape/outside.pdf" }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("rejects oversized PDFs", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, "a");
    oversized.write("%PDF-");
    writeFileSync(join(workspaceRoot, "large.pdf"), oversized);

    await expect(readPdf({ path: "large.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "file_too_large" },
    });
  });

  it("handles malformed PDFs safely", async () => {
    writeFileSync(join(workspaceRoot, "malformed.pdf"), "%PDF-1.4\nnot enough");

    await expect(readPdf({ path: "malformed.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "pdf_parse_error" },
    });
  });

  it("handles encrypted PDFs safely with a specific error", async () => {
    writeFileSync(
      join(workspaceRoot, "encrypted.pdf"),
      makeEncryptedPdfFixture(),
    );

    await expect(readPdf({ path: "encrypted.pdf" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "pdf_encrypted_or_password_required" },
    });
  });

  it("parses the tiny PDF fixture through the runtime path", async () => {
    writeFileSync(
      join(workspaceRoot, "tiny-runtime.pdf"),
      readFileSync(
        join(
          process.cwd(),
          "src",
          "lib",
          "tools",
          "__fixtures__",
          "tiny-runtime.pdf",
        ),
      ),
    );

    const result = await readPdf({ path: "tiny-runtime.pdf" });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        path: "tiny-runtime.pdf",
        extension: ".pdf",
        pagesRead: 1,
        totalPages: 1,
        truncated: false,
      },
    });
    expect((result.data as { text?: string }).text).toContain(
      "Tiny JARVIS PDF fixture",
    );
    expect(JSON.stringify(result.data)).not.toContain("pdf_parse_error");
  });

  it("truncates returned text at the requested character limit", async () => {
    writeFileSync(join(workspaceRoot, "long.pdf"), makeSimplePdf(["abcdef"]));

    await expect(
      readPdf({ path: "long.pdf", maxChars: 3 }),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        truncated: true,
        text: "abc",
      },
    });
  });

  it("limits extraction to the requested page count", async () => {
    writeFileSync(
      join(workspaceRoot, "pages.pdf"),
      makeSimplePdf(["first page", "second page"]),
    );

    const result = await readPdf({ path: "pages.pdf", maxPages: 1 });

    expect(result).toMatchObject({
      ok: true,
      data: {
        pagesRead: 1,
        totalPages: 2,
        truncated: true,
        text: expect.stringContaining("first page"),
      },
    });
    expect(JSON.stringify(result.data)).not.toContain("second page");
  });

  it("does not put raw PDF text in telemetry notes", async () => {
    writeFileSync(
      join(workspaceRoot, "private.pdf"),
      makeSimplePdf(["secret pdf body"]),
    );

    await readPdf({ path: "private.pdf" });

    const completed = telemetryEvents.find(
      (event) => event.event_type === "tool_completed",
    );
    expect(completed).toMatchObject({
      execution_id: "exec-pdf-private_pdf",
      tool_name: "doc.read_pdf",
      notes: expect.stringContaining("path=private.pdf"),
    });
    expect(completed?.notes).toContain("pages_read=1");
    expect(JSON.stringify(telemetryEvents)).not.toContain("secret pdf body");
  });

  it("caps tool_calls.output_json and externalises large doc.read_pdf results", async () => {
    const pageText = "a".repeat(100_000);
    writeFileSync(
      join(workspaceRoot, "big.pdf"),
      makeSimplePdf(Array.from({ length: 20 }, () => pageText)),
    );

    const result = await readPdf({ path: "big.pdf", maxChars: 100_000 });
    expect(result.ok).toBe(true);

    const row = getToolCall(db, "exec-pdf-big_pdf");
    expect(row).toBeDefined();
    const stored = JSON.parse(row!.output_json ?? "null") as {
      truncated: boolean;
      externalPath?: string;
      byteSize?: number;
    };
    expect(stored.truncated).toBe(true);
    expect(stored.externalPath).toMatch(/^exec_[A-Za-z0-9_-]+\.json$/);
    expect(stored.byteSize).toBeGreaterThan(64 * 1024);

    const fullPath = join(outputDir, stored.externalPath!);
    const restored = JSON.parse(readFileSync(fullPath, "utf8")) as {
      text: string;
    };
    expect(restored.text.length).toBeGreaterThan(64 * 1024);
    expect(row!.output_json).not.toContain("aaaa");
  });

  it("converts doc.read_pdf to a strict OpenAI schema", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["doc.read_pdf"].includes(toolId),
    );
    const openAiTool = toOpenAITools(metadata.definitions)?.[0];

    expect(openAiTool?.function.name).toBe("doc_read_pdf");
    expect(openAiTool?.function.parameters).toMatchObject({
      type: "object",
      properties: {
        path: expect.objectContaining({ type: "string" }),
        maxPages: expect.objectContaining({ type: "integer" }),
        maxChars: expect.objectContaining({ type: "integer" }),
      },
      required: ["path"],
      additionalProperties: false,
    });
    expect(
      objectSchemasMissingAdditionalProperties(openAiTool?.function.parameters),
    ).toEqual([]);
  });

  it("exposes doc.read_pdf through Anthropic tool metadata", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["doc.read_pdf"].includes(toolId),
    );
    const anthropicTool = toAnthropicTools(metadata.definitions)?.[0];

    expect(anthropicTool).toMatchObject({
      name: "doc_read_pdf",
      description: expect.stringContaining("Extract text from a PDF"),
      input_schema: {
        type: "object",
        properties: {
          path: expect.objectContaining({ type: "string" }),
          maxPages: expect.objectContaining({ type: "integer" }),
          maxChars: expect.objectContaining({ type: "integer" }),
        },
        required: ["path"],
      },
    });
  });
});

describe("doc.read_docx", () => {
  it("reads simple DOCX files", async () => {
    writeFileSync(
      join(workspaceRoot, "simple.docx"),
      await makeSimpleDocx(["hello docx"]),
    );

    await expect(readDocx({ path: "simple.docx" })).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        path: "simple.docx",
        extension: ".docx",
        truncated: false,
        text: expect.stringContaining("hello docx"),
      },
    });
  });

  it("rejects legacy .doc files", async () => {
    writeFileSync(join(workspaceRoot, "legacy.doc"), makeOleCompoundFixture());

    await expect(readDocx({ path: "legacy.doc" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "legacy_doc" },
    });
  });

  it("rejects non-DOCX extensions", async () => {
    writeFileSync(
      join(workspaceRoot, "not-docx.zip"),
      await makeSimpleDocx(["hello"]),
    );

    await expect(readDocx({ path: "not-docx.zip" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "unsupported_file_type" },
    });
  });

  it("rejects wrong magic bytes and invalid ZIPs", async () => {
    writeFileSync(join(workspaceRoot, "wrong.docx"), "not really a zip");
    writeFileSync(
      join(workspaceRoot, "invalid.docx"),
      Buffer.concat([Buffer.from("PK\x03\x04", "binary"), Buffer.from("bad")]),
    );

    await expect(readDocx({ path: "wrong.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_docx_zip" },
    });
    await expect(readDocx({ path: "invalid.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "docx_parse_error" },
    });
  });

  it("rejects missing files", async () => {
    await expect(readDocx({ path: "missing.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "not_found" },
    });
  });

  it("rejects protected paths", async () => {
    writeFileSync(
      join(workspaceRoot, ".env.docx"),
      await makeSimpleDocx(["secret"]),
    );

    await expect(readDocx({ path: ".env.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "protected_path" },
    });
  });

  it("rejects traversal and symlink escapes", async () => {
    writeFileSync(
      join(outsideRoot, "outside.docx"),
      await makeSimpleDocx(["outside"]),
    );

    await expect(readDocx({ path: "../outside.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });

    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "docx-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await expect(
      readDocx({ path: "docx-escape/outside.docx" }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("rejects oversized DOCX files", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, "a");
    oversized.write("PK\x03\x04", "binary");
    writeFileSync(join(workspaceRoot, "large.docx"), oversized);

    await expect(readDocx({ path: "large.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "file_too_large" },
    });
  });

  it("rejects compressed-small DOCX files with inflated document XML", async () => {
    const hugeText = "a".repeat(1024 * 1024 + 1);
    const documentXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${hugeText}</w:t></w:r></w:p></w:body></w:document>`;
    const buffer = await makeDocxWithDocumentXml(documentXml);
    expect(buffer.byteLength).toBeLessThan(32 * 1024);
    writeFileSync(join(workspaceRoot, "zip-bomb-style.docx"), buffer);

    await expect(
      readDocx({ path: "zip-bomb-style.docx", maxChars: 10 }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "docx_xml_too_large" },
    });
  });

  it("rejects huge document XML before XML parsing", async () => {
    const parseSpy = vi.spyOn(XMLParser.prototype, "parse");
    const hugeText = "b".repeat(1024 * 1024 + 1);
    const documentXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${hugeText}</w:t></w:r></w:p></w:body></w:document>`;
    writeFileSync(
      join(workspaceRoot, "huge-document-xml.docx"),
      await makeDocxWithDocumentXml(documentXml),
    );

    await expect(
      readDocx({ path: "huge-document-xml.docx", maxChars: 10 }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "docx_xml_too_large" },
    });
    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });

  it("handles malformed DOCX packages safely", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types></Types>");
    writeFileSync(
      join(workspaceRoot, "malformed.docx"),
      await zip.generateAsync({ type: "nodebuffer" }),
    );

    await expect(readDocx({ path: "malformed.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_docx_package" },
    });
  });

  it("handles password-protected DOCX-like OLE packages safely", async () => {
    writeFileSync(
      join(workspaceRoot, "protected.docx"),
      makeOleCompoundFixture(),
    );

    await expect(readDocx({ path: "protected.docx" })).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "docx_encrypted_or_password_required" },
    });
  });

  it("truncates returned text at the requested character limit", async () => {
    writeFileSync(
      join(workspaceRoot, "long.docx"),
      await makeSimpleDocx(["abcdef"]),
    );

    await expect(
      readDocx({ path: "long.docx", maxChars: 3 }),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        truncated: true,
        text: "abc",
      },
    });
  });

  it("does not put raw DOCX text in telemetry notes", async () => {
    writeFileSync(
      join(workspaceRoot, "private.docx"),
      await makeSimpleDocx(["secret docx body"]),
    );

    await readDocx({ path: "private.docx" });

    const completed = telemetryEvents.find(
      (event) => event.event_type === "tool_completed",
    );
    expect(completed).toMatchObject({
      execution_id: "exec-docx-private_docx",
      tool_name: "doc.read_docx",
      notes: expect.stringContaining("path=private.docx"),
    });
    expect(JSON.stringify(telemetryEvents)).not.toContain("secret docx body");
  });

  it("caps tool_calls.output_json and externalises large doc.read_docx results", async () => {
    const big = "a".repeat(100_000);
    writeFileSync(join(workspaceRoot, "big.docx"), await makeSimpleDocx([big]));

    const result = await readDocx({ path: "big.docx", maxChars: 100_000 });
    expect(result.ok).toBe(true);

    const row = getToolCall(db, "exec-docx-big_docx");
    expect(row).toBeDefined();
    const stored = JSON.parse(row!.output_json ?? "null") as {
      truncated: boolean;
      externalPath?: string;
      byteSize?: number;
    };
    expect(stored.truncated).toBe(true);
    expect(stored.externalPath).toMatch(/^exec_[A-Za-z0-9_-]+\.json$/);
    expect(stored.byteSize).toBeGreaterThan(64 * 1024);

    const fullPath = join(outputDir, stored.externalPath!);
    const restored = JSON.parse(readFileSync(fullPath, "utf8")) as {
      text: string;
    };
    expect(restored.text.length).toBe(big.length);
    expect(row!.output_json).not.toContain("aaaa");
  });

  it("converts doc.read_docx to a strict OpenAI schema", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["doc.read_docx"].includes(toolId),
    );
    const openAiTool = toOpenAITools(metadata.definitions)?.[0];

    expect(openAiTool?.function.name).toBe("doc_read_docx");
    expect(openAiTool?.function.parameters).toMatchObject({
      type: "object",
      properties: {
        path: expect.objectContaining({ type: "string" }),
        maxChars: expect.objectContaining({ type: "integer" }),
      },
      required: ["path"],
      additionalProperties: false,
    });
    expect(
      objectSchemasMissingAdditionalProperties(openAiTool?.function.parameters),
    ).toEqual([]);
  });

  it("exposes doc.read_docx through Anthropic tool metadata", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["doc.read_docx"].includes(toolId),
    );
    const anthropicTool = toAnthropicTools(metadata.definitions)?.[0];

    expect(anthropicTool).toMatchObject({
      name: "doc_read_docx",
      description: expect.stringContaining("Extract text from a DOCX"),
      input_schema: {
        type: "object",
        properties: {
          path: expect.objectContaining({ type: "string" }),
          maxChars: expect.objectContaining({ type: "integer" }),
        },
        required: ["path"],
      },
    });
  });
});

function objectSchemasMissingAdditionalProperties(
  value: unknown,
  path = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      objectSchemasMissingAdditionalProperties(item, `${path}[${index}]`),
    );
  }
  if (value === null || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const missing =
    record.type === "object" && record.additionalProperties !== false
      ? [path]
      : [];

  return [
    ...missing,
    ...Object.entries(record).flatMap(([key, child]) =>
      objectSchemasMissingAdditionalProperties(child, `${path}.${key}`),
    ),
  ];
}
