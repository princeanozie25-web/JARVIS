import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type TauriConfig = {
  build?: {
    beforeDevCommand?:
      | string
      | { script?: string; cwd?: string; wait?: boolean };
    beforeBuildCommand?: string;
    devUrl?: string;
    frontendDist?: string;
    removeUnusedCommands?: boolean;
  };
  app?: {
    windows?: Array<{ label?: string; url?: string; title?: string }>;
    security?: {
      capabilities?: string[];
      assetProtocol?: { enable?: boolean; scope?: string[] };
      csp?: string | null;
      dangerousDisableAssetCspModification?: boolean;
    };
    withGlobalTauri?: boolean;
    macOSPrivateApi?: boolean;
  };
  bundle?: {
    active?: boolean;
    createUpdaterArtifacts?: boolean;
    targets?: string[];
  };
  plugins?: Record<string, unknown>;
};

const TAURI_DIR = "src-tauri";
const CONFIG_PATH = join(TAURI_DIR, "tauri.conf.json");
const MAIN_RS_PATH = join(TAURI_DIR, "src", "main.rs");
const CAPABILITY_PATH = join(TAURI_DIR, "capabilities", "default.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readTauriConfig(): TauriConfig {
  return readJson<TauriConfig>(CONFIG_PATH);
}

function readPackageJson(): {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return readJson("package.json");
}

function tauriSourceText(): string {
  return [
    readFileSync(CONFIG_PATH, "utf8"),
    readFileSync(MAIN_RS_PATH, "utf8"),
    readFileSync(CAPABILITY_PATH, "utf8"),
  ].join("\n");
}

function localUrlsFrom(config: TauriConfig): string[] {
  const buildUrls = [config.build?.devUrl, config.build?.frontendDist].filter(
    (value): value is string => typeof value === "string",
  );
  const windowUrls =
    config.app?.windows
      ?.map((windowConfig) => windowConfig.url)
      .filter((value): value is string => typeof value === "string") ?? [];
  const cspUrls =
    config.app?.security?.csp?.match(/\b(?:http|ws):\/\/[^;\s']+/g) ?? [];

  return [...buildUrls, ...windowUrls, ...cspUrls];
}

function assertLocalUrl(value: string) {
  const url = new URL(value);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
}

describe("Phase 12A.1 Tauri shell skeleton", () => {
  it("defines the minimal Tauri config and Rust shell files", () => {
    expect(existsSync(CONFIG_PATH)).toBe(true);
    expect(existsSync(join(TAURI_DIR, "Cargo.toml"))).toBe(true);
    expect(existsSync(join(TAURI_DIR, "build.rs"))).toBe(true);
    expect(existsSync(MAIN_RS_PATH)).toBe(true);
    expect(existsSync(CAPABILITY_PATH)).toBe(true);

    expect(readTauriConfig()).toMatchObject({
      productName: "JARVIS Command Center",
      identifier: "dev.princeanozie.jarvis",
      build: {
        devUrl: "http://127.0.0.1:3000",
        frontendDist: "http://127.0.0.1:3000",
      },
    });
  });

  it("wraps the local Next.js app on localhost or 127.0.0.1 only", () => {
    const config = readTauriConfig();
    const urls = localUrlsFrom(config);

    expect(urls).toEqual(expect.arrayContaining(["http://127.0.0.1:3000"]));
    for (const url of urls) {
      assertLocalUrl(url);
    }
    expect(tauriSourceText()).not.toMatch(
      /0\.0\.0\.0|\[::\]|\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/i,
    );
  });

  it("does not configure a remote dashboard, updater, or public bundle channel", () => {
    const config = readTauriConfig();
    const pluginNames = Object.keys(config.plugins ?? {});

    expect(config.bundle).toEqual({
      active: false,
      createUpdaterArtifacts: false,
      targets: [],
    });
    expect(config.plugins).toEqual({});
    expect(pluginNames.some((name) => /updater|dashboard/i.test(name))).toBe(
      false,
    );
    expect(tauriSourceText()).not.toMatch(/dashboard_url|tunnel|ngrok/i);
  });

  it("registers no mutating IPC commands or authority command names", () => {
    const rustSource = readFileSync(MAIN_RS_PATH, "utf8");
    const capability = readJson<{ permissions?: unknown[] }>(CAPABILITY_PATH);

    expect(rustSource).not.toMatch(/#\[tauri::command\]/);
    expect(rustSource).not.toMatch(/invoke_handler|generate_handler/i);
    expect(JSON.stringify(capability.permissions)).not.toMatch(
      /\b(approve|approval|execute|retry|mutate|write|device_action|room_command|provider_call)\b/i,
    );
  });

  it("requests no camera, microphone, screen, file-system, device, or global-hotkey permissions", () => {
    const capability = readJson<{ permissions?: unknown[] }>(CAPABILITY_PATH);
    const config = readTauriConfig();

    expect(capability.permissions).toEqual([]);
    expect(config.app?.security?.capabilities).toEqual(["default"]);
    expect(config.app?.security?.assetProtocol).toEqual({
      enable: false,
      scope: [],
    });
    expect(config.app?.withGlobalTauri).toBe(false);
    expect(config.app?.macOSPrivateApi).toBe(false);
    expect(JSON.stringify(capability.permissions)).not.toMatch(
      /camera|microphone|mic|screen|capture|global-hotkey|globalShortcut|fs:|filesystem|dialog|shell:|device|serial|usb|hid/i,
    );
    expect(Object.keys(config.plugins ?? {}).join("\n")).not.toMatch(
      /camera|microphone|screen|global-hotkey|fs|dialog|shell/i,
    );
  });

  it("imports no provider, model, hardware, persistence, or room execution modules", () => {
    const main = readFileSync(MAIN_RS_PATH, "utf8");
    const cargo = readFileSync(join(TAURI_DIR, "Cargo.toml"), "utf8");

    expect(main).not.toMatch(
      /openai|anthropic|ollama|hue|adapter|sqlite|store|room|provider|model|hardware/i,
    );
    expect(cargo).not.toMatch(
      /openai|anthropic|ollama|hue|rusqlite|sqlx|redis|postgres|serial|usb|cpal|opencv/i,
    );
  });

  it("adds safe local-only package scripts for the shell", () => {
    const packageJson = readPackageJson();

    expect(packageJson.devDependencies?.["@tauri-apps/cli"]).toMatch(/^\^2\./);
    expect(packageJson.scripts).toMatchObject({
      "dev:local": "next dev --hostname 127.0.0.1",
      tauri: "tauri",
      "tauri:dev": "tauri dev",
      "tauri:build": "tauri build",
    });
    expect(JSON.stringify(packageJson.scripts)).not.toMatch(
      /0\.0\.0\.0|--host\s+0|--hostname\s+0|tunnel|ngrok|cloud|remote/i,
    );
  });
});
