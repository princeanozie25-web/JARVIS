import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AuditPage from "../../src/app/audit/page";
import {
  AUDIT_SHELL_MODEL,
  AuditShell,
} from "../../src/components/audit/AuditShell";

const AUDIT_SOURCE_FILES = [
  "src/app/audit/page.tsx",
  "app/audit/page.tsx",
  "src/components/audit/AuditShell.tsx",
  "src/components/audit/types.ts",
] as const;

const REQUIRED_REGIONS = [
  "Replay timeline",
  "Trace viewer",
  "Governance boundary viewer",
  "Runtime dependency viewer",
  "Redaction status",
  "Disabled-feature matrix",
] as const;

function renderAuditPage() {
  return renderToStaticMarkup(<AuditPage />);
}

function sourceText() {
  return AUDIT_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

describe("Phase 12C.1 Audit screen shell", () => {
  it("/audit page renders the read-only forensics shell", () => {
    const html = renderAuditPage();

    expect(html).toContain('data-audit-layout="read-only-forensics"');
    expect(html).toContain('data-audit-shell="read-only"');
    expect(html).toContain("JARVIS Room OS");
    expect(html).toContain("Audit Mode");
    expect(html).toContain("Command Center Forensics");
    expect(html).toContain("Read-only forensics shell");
    expect(html).toContain('data-local-only="true"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-authority="none"');
  });

  it("renders every placeholder audit region", () => {
    const html = renderAuditPage();

    for (const title of REQUIRED_REGIONS) {
      expect(html).toContain(title);
    }
    expect(html).toContain('data-audit-region-id="replay_timeline"');
    expect(html).toContain('data-audit-region-id="trace_viewer"');
    expect(html).toContain('data-audit-region-id="governance_boundary_viewer"');
    expect(html).toContain('data-audit-region-id="runtime_dependency_viewer"');
    expect(html).toContain('data-audit-region-id="redaction_status"');
    expect(html).toContain('data-audit-region-id="disabled_feature_matrix"');
  });

  it("uses deterministic static placeholder data only", () => {
    const first = renderToStaticMarkup(<AuditShell />);
    const second = renderToStaticMarkup(
      <AuditShell model={AUDIT_SHELL_MODEL} />,
    );

    expect(first).toBe(second);
    expect(AUDIT_SHELL_MODEL).toMatchObject({
      posture: "read_only_forensics_shell",
      localOnly: true,
      metadataOnly: true,
      authority: "none",
      regions: expect.arrayContaining([
        expect.objectContaining({
          region_id: "replay_timeline",
          posture: "inspection_only",
          dataClassification: "metadata_only",
          authority: "none",
        }),
      ]),
    });
  });

  it("renders no buttons, forms, action links, or authority affordances", () => {
    const html = renderAuditPage();

    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(
      /\b(approve|run|retry|execute|mutate|schedule)\b/i,
    );
  });

  it("does not expose replay or graph execution affordances", () => {
    const html = renderAuditPage();

    expect(html).not.toMatch(
      /replay execution|start replay|rerun|graph execution|graph-driven execution|dependency action/i,
    );
  });

  it("does not render raw payload language", () => {
    const html = renderAuditPage();

    expect(html).not.toMatch(
      /raw_payload|prompt body|model output|transcript|frame bytes|secret|token/i,
    );
  });

  it("does not import network, provider, persistence, room execution, or Tauri IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider|openai|anthropic|ollama|model runtime/i,
    );
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
  });

  it("does not touch global fetch during render", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderAuditPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
