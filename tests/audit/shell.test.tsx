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
  "src/components/audit/AuditCockpit.tsx",
  "src/components/audit/AuditShell.tsx",
  "src/components/audit/panel-registry.ts",
  "src/components/audit/types.ts",
] as const;

const REQUIRED_REGIONS = [
  "TRACE TIMELINE",
  "REPLAY VIEWER",
  "TELEMETRY",
  "GOVERNANCE BOUNDARY",
  "DISABLED MATRIX",
] as const;

function renderAuditPage() {
  return renderToStaticMarkup(<AuditPage />);
}

function sourceText() {
  return AUDIT_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

function assertAuditNavigationLinksOnly(html: string) {
  const anchors = html.match(/<a\b[^>]*>/gi) ?? [];
  const hrefs = anchors.map(
    (anchor) => anchor.match(/\bhref="([^"]+)"/i)?.[1] ?? "",
  );
  expect(hrefs).toEqual(
    expect.arrayContaining([
      "/",
      "/rest",
      "/working",
      "/audit",
      "/audit/pipeline",
    ]),
  );
  expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
}

function assertAuditZeroMutation(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  assertAuditNavigationLinksOnly(html);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(approve|run|retry|execute|schedule|replay_execute|graph_execute)\b/i,
  );
}

describe("Phase 12C.1 Audit screen shell", () => {
  it("/audit page renders the read-only forensics shell", () => {
    const html = renderAuditPage();

    expect(html).toContain('data-audit-layout="read-only-forensics"');
    expect(html).toContain('data-audit-shell="read-only"');
    expect(html).toContain('data-audit-cockpit="read-only-fortress"');
    expect(html).toContain("Audit");
    expect(html).toContain("FORENSIC - READ-ONLY OBSERVABILITY");
    expect(html).toContain("REPLAY VIEWER");
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-audit-authority="none"');
    expect(html).toContain('data-zero-mutation="true"');
    expect(html).toContain('data-replay-non-executable="true"');
  });

  it("renders every audit fortress view", () => {
    const html = renderAuditPage();

    for (const title of REQUIRED_REGIONS) {
      expect(html).toContain(title);
    }
    expect(html).toContain('data-trace-selection="inspection-only"');
    expect(html).toContain('data-replay-control="inspection-only"');
    expect(html).toContain('data-raw-payloads-rendered="false"');
    expect(html).toContain('data-stage-trigger="none"');
  });

  it("renders read-only replay, telemetry, and tripwire surfaces", () => {
    const html = renderAuditPage();

    expect(html).toContain('data-tripwire-status="armed"');
    expect(html).toContain('data-trust-class="observe_only"');
    expect(html).toContain('data-trust-class="forbidden"');
    expect(html).toContain("DISABLED MATRIX");
    expect(html).toContain("Remote dashboard");
    expect(html).toContain("P95 LATENCY");
    expect(html).toContain("input redacted");
    expect(html).toContain("output redacted");
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
      panels: expect.arrayContaining([
        expect.objectContaining({
          panel_id: "replay_timeline",
          posture: "inspection_only",
          data_classification: "metadata_only",
          authority: "read_only",
          shellAuthority: "none",
        }),
      ]),
    });
  });

  it("renders no buttons, forms, action links, or authority affordances", () => {
    const html = renderAuditPage();

    assertAuditZeroMutation(html);
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
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider|openai|anthropic|ollama|model runtime/i,
    );
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
    expect(sourceText()).not.toMatch(/<button|<form|<input|onSubmit/i);
  });

  it("does not touch global fetch during render", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderAuditPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
