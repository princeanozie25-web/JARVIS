// Phase 25G — G2/G3 (E-054): the packaging overlay, entitlements, sidecar
// launcher and shell keep the 12A.1 posture: loopback only, one sidecar, no
// IPC commands, no plugins, no updater, no camera/mic/fs entitlements, and
// the artifact never carries data/ or env files.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TAURI = "src-tauri";
const overlay = JSON.parse(
  readFileSync(join(TAURI, "tauri.package.conf.json"), "utf8"),
) as {
  build: { devUrl: string; frontendDist: string; beforeBuildCommand: string };
  app: { windows: unknown[]; security: { csp: string } };
  bundle: {
    active: boolean;
    createUpdaterArtifacts: boolean;
    targets: string[];
    externalBin: string[];
    resources: Record<string, string>;
    macOS: { entitlements: string; signingIdentity: string };
  };
  plugins?: Record<string, unknown>;
};
const mainRs = readFileSync(join(TAURI, "src", "main.rs"), "utf8");
const entitlements = readFileSync(join(TAURI, "entitlements.plist"), "utf8");
const launcher = readFileSync("scripts/package/sidecar-launcher.js", "utf8");
const buildScript = readFileSync("scripts/package/build-mac.ts", "utf8");

describe("25G packaging overlay (tauri.package.conf.json)", () => {
  it("is applied only by the build script, never to tauri dev", () => {
    expect(buildScript).toMatch(
      /tauri", "build", "--config", "src-tauri\/tauri\.package\.conf\.json"/,
    );
    const base = JSON.parse(
      readFileSync(join(TAURI, "tauri.conf.json"), "utf8"),
    ) as { bundle: { active: boolean } };
    expect(base.bundle.active).toBe(false); // 12A.1 posture untouched
  });

  it("opens no window from config, bundles one sidecar, one resource tree, macOS app only, ad-hoc signed", () => {
    expect(overlay.app.windows).toEqual([]);
    expect(overlay.bundle).toMatchObject({
      active: true,
      createUpdaterArtifacts: false,
      targets: ["app"],
      externalBin: ["binaries/node"],
      resources: { "../dist/mac/standalone": "standalone" },
      macOS: { entitlements: "entitlements.plist", signingIdentity: "-" },
    });
    expect(overlay.plugins ?? {}).toEqual({});
  });

  it("keeps every URL on loopback", () => {
    const urls = [
      overlay.build.devUrl,
      overlay.build.frontendDist,
      ...(overlay.app.security.csp.match(/\b(?:http|ws):\/\/[^;\s']+/g) ?? []),
    ];
    expect(urls.length).toBeGreaterThan(2);
    for (const u of urls) expect(new URL(u).hostname).toBe("127.0.0.1");
  });
});

describe("25G entitlements", () => {
  it("grant JIT/native-addon loading for Node and nothing else", () => {
    for (const key of [
      "com.apple.security.cs.allow-jit",
      "com.apple.security.cs.allow-unsigned-executable-memory",
      "com.apple.security.cs.disable-library-validation",
    ]) {
      expect(entitlements).toContain(key);
    }
    expect(entitlements).not.toMatch(
      /network\.server|device\.camera|device\.microphone|device\.audio-input|files\.user-selected|files\.downloads|app-sandbox|automation\.apple-events/,
    );
  });
});

describe("25G shell (main.rs)", () => {
  it("still registers no IPC commands and no plugins", () => {
    expect(mainRs).not.toMatch(
      /#\[tauri::command\]|invoke_handler|generate_handler|\.plugin\(/,
    );
  });
  it("spawns exactly one child, on loopback, from the bundled resources, and kills it on exit", () => {
    expect(mainRs.match(/Command::new\(/g)).toHaveLength(1);
    expect(mainRs).toMatch(/"HOSTNAME", "127\.0\.0\.1"/);
    expect(mainRs).toMatch(/"JARVIS_BIND_HOST", "127\.0\.0\.1"/);
    expect(mainRs).toMatch(/resource_dir\(\)/);
    expect(mainRs).toMatch(/RunEvent::Exit/);
    expect(mainRs).toMatch(/child\.kill\(\)/);
    expect(mainRs).not.toMatch(/0\.0\.0\.0|\[::\]/);
  });
  it("lets a jarvis.env file configure the app but never widen the bind posture", () => {
    expect(mainRs).toMatch(
      /"HOSTNAME" \| "PORT" \| "JARVIS_BIND_HOST" \| "JARVIS_REMOTE_DASHBOARD_ENABLED"/,
    );
  });
});

describe("25G sidecar launcher and staging", () => {
  it("the launcher pins loopback and exits when its parent dies", () => {
    expect(launcher).toMatch(/HOSTNAME = "127\.0\.0\.1"/);
    expect(launcher).toMatch(/JARVIS_REMOTE_DASHBOARD_ENABLED = "false"/);
    expect(launcher).toMatch(/process\.ppid === 1/);
    expect(launcher).toMatch(/require\("\.\/server\.js"\)/);
  });
  it("the staging script excludes data, env files, tests and secrets-bearing trees and refuses to ship them", () => {
    for (const name of [
      '"data"',
      '".env"',
      '".env.local"',
      '"tests"',
      '"src"',
      '"docs"',
      '"tmp"',
      '".venv-mlx"',
    ]) {
      expect(buildScript).toContain(name);
    }
    expect(buildScript).toMatch(/staged tree still contains/);
    expect(buildScript).toMatch(/materialiseSymlinks\(STAGE\)/);
  });
  it("generated artifacts are ignored by git", () => {
    const ignore = readFileSync(join(TAURI, ".gitignore"), "utf8");
    expect(ignore).toMatch(/^target\//m);
    expect(ignore).toMatch(/^binaries\//m);
    expect(existsSync(join(TAURI, "icons", "icon.icns"))).toBe(true);
  });
});
