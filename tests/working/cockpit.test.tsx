import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WorkingPage from "../../src/app/working/page";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";

const FORBIDDEN_OUTSIDE_GATE = /\b(run|retry|execute|schedule)\b/i;
const SECRET_VALUE = /\bsk-[A-Za-z0-9_-]{8,}\b/i;

function renderWorkingPage() {
  return renderToStaticMarkup(<WorkingPage />);
}

function buttonLabels(html: string): string[] {
  return Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi))
    .map((match) => match[1] ?? "")
    .map((content) => content.replace(/<[^>]+>/g, " "))
    .map((content) => content.replace(/\s+/g, " ").trim());
}

describe("Phase 12 /working cockpit - gate-centered production prototype", () => {
  it("renders the approval-gated working cockpit route", () => {
    const html = renderWorkingPage();

    expect(html).toContain('data-working-layout="approval-gated-cockpit"');
    expect(html).toContain('data-working-cockpit="working-cockpit"');
    expect(html).toContain('data-working-shell="approval-gated"');
    expect(html).toContain('data-only-mutator="human-gate"');
    expect(html).toContain("Working Cockpit");
  });

  it("renders the reference workflow rail and focused cockpit grid", () => {
    const html = renderWorkingPage();

    expect(html).toContain("Project");
    expect(html).toContain("Research");
    expect(html).toContain("Build Monitor");
    expect(html).toContain("Morning Brief");
    expect(html).toContain("jcc-work-grid");
    expect(html).toContain("jcc-chat");
    expect(html).toContain("jcc-gate");
    expect(html).toContain("jcc-context");
  });

  it("renders the Human Gate as the center mutation surface", () => {
    const html = renderWorkingPage();

    expect(html.match(/data-human-gate-panel="true"/g)).toHaveLength(1);
    expect(html).toContain('data-only-path-to-side-effects="true"');
    expect(html).toContain(
      'data-mutator-entrypoint="human-gate-approval-lifecycle"',
    );
    expect(html).toContain('data-approval-service="phase_18_contract"');
    expect(html).toContain("Human Gate");
    expect(html).toContain("THE ONLY PATH TO SIDE EFFECTS");
    expect(html).toContain("DRY-RUN DIFF");
    expect(html).toContain("EXPIRES IN");
  });

  it("keeps approve and deny controls inside gate cards only", () => {
    const html = renderWorkingPage();
    const labels = buttonLabels(html);

    expect(labels).toContain("APPROVE");
    expect(labels).toContain("DENY");
    expect(html.match(/wc-gate-approve/g)).toHaveLength(1);
    expect(html.match(/wc-gate-deny/g)).toHaveLength(1);
    expect(labels.join(" ")).not.toMatch(FORBIDDEN_OUTSIDE_GATE);
    expect(html).not.toContain("replay_execute");
    expect(html).not.toContain("graph_execute");
  });

  it("marks observability panels and read-only context surfaces", () => {
    const html = renderWorkingPage();

    expect(html).toContain("OBSERVABILITY");
    expect(
      html.match(/data-read-only-context-panel=/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(html).toContain("ROOM");
    expect(html).toContain("COST");
    expect(html).toContain("ACTIVITY");
  });

  it("keeps workflow content propose-only rather than executable", () => {
    const html = renderWorkingPage();

    expect(html).toContain("PROPOSE-ONLY INPUT");
    expect(html).toContain("PROPOSAL - PROP-ROOM-1842");
    expect(html).toContain("Ask, draft, or prepare a proposal");
    expect(html).not.toMatch(/onclick="|javascript:/i);
  });

  it("does not render raw payload language or secret-like data", () => {
    const html = renderWorkingPage();

    expect(html).not.toMatch(
      /raw_payload|payload_json|prompt body|model output|transcript|frame bytes|api[_-]?key|secret|token/i,
    );
    expect(html).not.toMatch(SECRET_VALUE);
  });

  it("keeps the component free of store, network, IPC, and direct adapter imports", () => {
    const source = [
      "src/app/working/page.tsx",
      "app/working/page.tsx",
      "src/components/working/WorkingCockpit.tsx",
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|poll/i,
    );
    expect(source).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|better-sqlite3|room\/adapters|executeCommand|commandRoom/i,
    );
  });
});

describe("WorkingCockpit direct render", () => {
  it("renders without route props", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);

    expect(html).toContain('data-working-cockpit="working-cockpit"');
    expect(html).toContain('data-human-gate-panel="true"');
  });
});
