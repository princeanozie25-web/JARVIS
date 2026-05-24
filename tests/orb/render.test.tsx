import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RestPage from "../../src/app/rest/page";
import { Orb } from "../../src/components/orb/Orb";
import { IDLE_ORB_STATE } from "../../src/components/orb/types";

const ORB_SOURCE_FILES = [
  "src/app/rest/page.tsx",
  "app/rest/page.tsx",
  "src/components/orb/Orb.tsx",
  "src/components/orb/types.ts",
] as const;

function renderRestPage() {
  return renderToStaticMarkup(<RestPage />);
}

function sourceText() {
  return ORB_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("Phase 12A.2 Rest orb skeleton", () => {
  it("/rest page renders the local Rest Mode placeholder", () => {
    const html = renderRestPage();

    expect(html).toContain("JARVIS Room OS - Rest Mode");
    expect(html).toContain("Idle. Local shell only.");
    expect(html).toContain('data-orb-mode="idle"');
    expect(html).toContain('data-local-only="true"');
    expect(html).toContain('data-authority="none"');
  });

  it("orb component renders the deterministic idle state", () => {
    const first = renderToStaticMarkup(<Orb />);
    const second = renderToStaticMarkup(<Orb state={IDLE_ORB_STATE} />);

    expect(first).toBe(second);
    expect(first).toContain('aria-label="JARVIS Room OS - Rest Mode"');
    expect(IDLE_ORB_STATE).toEqual({
      mode: "idle",
      label: "JARVIS Room OS - Rest Mode",
      statusText: "Idle. Local shell only.",
      localOnly: true,
      authority: "none",
    });
  });

  it("renders no buttons, form controls, or authority affordances", () => {
    const html = renderRestPage();

    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(/\b(run|retry|approve|execute)\b/i);
  });

  it("does not reference capture, room, provider, persistence, network, or Tauri IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /getUserMedia|getDisplayMedia|mediaDevices|AudioContext|navigator\.mediaDevices|camera|microphone|screen capture|global-hotkey|globalShortcut/i,
    );
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|invoke\(|@tauri-apps|tauri::command/i,
    );
    expect(sourceText()).not.toMatch(
      /room\/|store\/|event-store|better-sqlite3|provider|openai|anthropic|ollama|hue|adapter/i,
    );
  });

  it("does not touch global fetch during render", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderRestPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
