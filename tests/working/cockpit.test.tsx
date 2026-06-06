import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WorkingPage from "../../src/app/working/page";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";

const WORKFLOWS = ["project", "research", "build", "brief"] as const;
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

  it("ships all four workflow pages and starts with exactly one visible", () => {
    const html = renderWorkingPage();

    for (const workflow of WORKFLOWS) {
      expect(html).toContain(`data-workflow-page="${workflow}"`);
      expect(html).toContain(`data-workflow-tab="${workflow}"`);
      expect(html).toContain(`data-sidebar-workflow="${workflow}"`);
    }
    expect(html.match(/data-active-workflow-page="true"/g)).toHaveLength(1);
    expect(html.match(/data-active-workflow-page="false"/g)).toHaveLength(3);
    expect(html).toContain('data-grid-template="1.1fr 1.4fr 0.95fr"');
    expect(html).toContain('data-grid-template="1fr 1.2fr 1fr"');
    expect(html).toContain('data-grid-template="1.3fr 1.1fr 1fr"');
    expect(html).toContain('data-grid-template="1fr 1.3fr 1fr"');
  });

  it("renders the Human Gate as the center mutation surface", () => {
    const html = renderWorkingPage();

    expect(html.match(/data-human-gate-panel="true"/g)).toHaveLength(4);
    expect(html).toContain('data-only-path-to-side-effects="true"');
    expect(html).toContain('data-mutator-entrypoint="resolveProposal"');
    expect(html).toContain("Human Gate");
    expect(html).toContain("only path to side effects");
    expect(html).toContain("dry-run diff");
    expect(html).toContain("expires in");
  });

  it("keeps approve and deny controls inside gate cards only", () => {
    const html = renderWorkingPage();
    const labels = buttonLabels(html);

    expect(labels).toContain("Approve");
    expect(labels).toContain("Deny");
    expect(html.match(/wc-gate-approve/g)).toHaveLength(4);
    expect(html.match(/wc-gate-deny/g)).toHaveLength(4);
    expect(labels.join(" ")).not.toMatch(FORBIDDEN_OUTSIDE_GATE);
    expect(html).not.toContain("replay_execute");
    expect(html).not.toContain("graph_execute");
  });

  it("marks fake-adapter panels and read-only context surfaces", () => {
    const html = renderWorkingPage();

    expect(html).toContain("FAKE ADAPTER");
    expect(
      html.match(/data-read-only-context-panel="true"/g)?.length,
    ).toBeGreaterThanOrEqual(8);
    expect(html).toContain("Room");
    expect(html).toContain("Cost");
    expect(html).toContain("Activity");
    expect(html).toContain("Vault state");
    expect(html).toContain("Suggestion inbox");
  });

  it("keeps workflow content propose-only rather than executable", () => {
    const html = renderWorkingPage();

    expect(html).toContain("Propose-only input");
    expect(html).toContain("proposal chip - prop-room-1842");
    expect(html).toContain("display-only agents");
    expect(html).toContain("Proposal available through the gate.");
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
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|setInterval|poll/i,
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
