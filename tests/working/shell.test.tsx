import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import WorkingPage from "../../src/app/working/page";
import {
  WORKING_SHELL_MODEL,
  WorkingShell,
} from "../../src/components/working/WorkingShell";

const WORKING_SOURCE_FILES = [
  "src/app/working/page.tsx",
  "app/working/page.tsx",
  "src/components/working/WorkingShell.tsx",
  "src/components/working/panel-registry.ts",
  "src/components/working/types.ts",
] as const;

const REQUIRED_PANELS = [
  "System status",
  "Room state",
  "Recent activity",
  "Model/router status",
  "Suggestions inbox",
  "Cost/usage",
  "Safety/governance",
] as const;

function renderWorkingPage() {
  return renderToStaticMarkup(<WorkingPage />);
}

function sourceText() {
  return WORKING_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

describe("Phase 12B.1 Working screen shell", () => {
  it("/working page renders the read-only cockpit shell", () => {
    const html = renderWorkingPage();

    expect(html).toContain('data-working-layout="read-only-cockpit"');
    expect(html).toContain('data-working-shell="read-only"');
    expect(html).toContain("JARVIS Working");
    expect(html).toContain("Read-only cockpit shell");
    expect(html).toContain('data-local-only="true"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-authority="none"');
  });

  it("renders every placeholder panel region", () => {
    const html = renderWorkingPage();

    for (const title of REQUIRED_PANELS) {
      expect(html).toContain(title);
    }
    expect(html).toContain('data-panel-id="system_status"');
    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-panel-id="recent_activity"');
    expect(html).toContain('data-panel-id="model_router"');
    expect(html).toContain('data-panel-id="suggestions_inbox"');
    expect(html).toContain('data-panel-id="cost_usage"');
    expect(html).toContain('data-panel-id="safety_governance"');
  });

  it("uses deterministic static placeholder data only", () => {
    const first = renderToStaticMarkup(<WorkingShell />);
    const second = renderToStaticMarkup(
      <WorkingShell model={WORKING_SHELL_MODEL} />,
    );

    expect(first).toBe(second);
    expect(WORKING_SHELL_MODEL).toMatchObject({
      posture: "read_only_placeholder",
      localOnly: true,
      metadataOnly: true,
      authority: "none",
      panels: expect.arrayContaining([
        expect.objectContaining({
          panel_id: "system_status",
          metadataOnly: true,
          authority: "read_only",
          shellAuthority: "none",
        }),
      ]),
    });
  });

  it("renders no buttons, forms, action links, or authority affordances", () => {
    const html = renderWorkingPage();

    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(/\b(approve|run|retry|execute)\b/i);
  });

  it("does not render raw payload language", () => {
    const html = renderWorkingPage();

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

    renderWorkingPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
