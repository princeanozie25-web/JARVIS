// Phase 25G — G4 (E-055): packaged doctor, sidecar supervisor, bootstrap projection.
import { describe, expect, it } from "vitest";

import {
  buildBootstrapProjection,
  BootstrapProjectionSchema,
} from "../../src/lib/packaging/bootstrap-projection";
import {
  isPackaged,
  runPackagedDoctor,
  type PackagedDoctorAdapters,
} from "../../src/lib/packaging/install-root";
import {
  MlxAudioSupervisor,
  type SupervisedChild,
} from "../../src/lib/packaging/supervisor";
import { createPackagedRuntime } from "../../src/lib/packaging/node";

const NOW = new Date("2026-09-07T20:00:00.000Z");

function adapters(
  over: Partial<PackagedDoctorAdapters> = {},
): PackagedDoctorAdapters {
  return {
    fileExists: () => true,
    dataDirWritable: () => true,
    reachable: async () => true,
    commandExists: () => true,
    ...over,
  };
}

describe("25G G4 — packaged mode detection", () => {
  it("is off unless JARVIS_PACKAGED is 1/true", () => {
    expect(isPackaged({})).toBe(false);
    expect(isPackaged({ JARVIS_PACKAGED: "0" })).toBe(false);
    expect(isPackaged({ JARVIS_PACKAGED: "1" })).toBe(true);
    expect(isPackaged({ JARVIS_PACKAGED: "true" })).toBe(true);
  });
});

describe("25G G4 — packaged doctor", () => {
  it("is ready when resources, data dir, Ollama, mlx-audio and the venv are all present", async () => {
    const r = await runPackagedDoctor({
      env: { JARVIS_STT_MLX_PYTHON_COMMAND: "/x/python" },
      adapters: adapters(),
      now: NOW,
    });
    expect(r.verdict).toBe("ready");
    expect(r.checks).toHaveLength(7);
    expect(
      r.checks.every((c) => c.status === "pass" && c.next_step === null),
    ).toBe(true);
  });

  it("blocks on missing resources / data dir / Ollama, only degrades on voice, and names the runbook step", async () => {
    const blocked = await runPackagedDoctor({
      env: {},
      adapters: adapters({ reachable: async (url) => !url.includes("11434") }),
      now: NOW,
    });
    expect(blocked.verdict).toBe("blocked");
    expect(
      blocked.checks.find((c) => c.check_id === "packaged:ollama-reachable")
        ?.next_step,
    ).toMatch(/brew services start ollama/);
    const degraded = await runPackagedDoctor({
      env: {},
      adapters: adapters({ reachable: async (url) => !url.includes("8004") }),
      now: NOW,
    });
    expect(degraded.verdict).toBe("degraded");
    expect(degraded.blocking_failures).toBe(0);
    expect(degraded.warnings).toBe(2); // mlx-audio down + venv not configured
    const noPrompt = await runPackagedDoctor({
      env: {},
      adapters: adapters({ fileExists: (p) => !p.startsWith("prompts/") }),
      now: NOW,
    });
    expect(
      noPrompt.checks.find((c) => c.check_id === "packaged:resource-prompts")
        ?.status,
    ).toBe("fail");
  });
});

function fakeChild(): SupervisedChild & { exit(code: number | null): void } {
  const cbs: Array<(code: number | null) => void> = [];
  return {
    pid: 4242,
    kill: () => {},
    onExit: (cb) => cbs.push(cb),
    exit: (code) => cbs.forEach((cb) => cb(code)),
  };
}

function clock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => void (t += ms),
    advance: (ms: number) => void (t += ms),
  };
}

describe("25G G4 — mlx-audio supervisor", () => {
  it("reports 'external' when the port already answers and never spawns", async () => {
    let spawned = 0;
    const c = clock();
    const s = new MlxAudioSupervisor({
      pythonCommand: "/x/python",
      adapters: {
        reachable: async () => true,
        spawn: () => ((spawned += 1), fakeChild()),
        now: c.now,
        sleep: c.sleep,
      },
    });
    expect((await s.ensure()).state).toBe("external");
    expect(spawned).toBe(0);
  });

  it("is 'disabled' without a configured python and spawns nothing", async () => {
    const c = clock();
    let spawned = 0;
    const s = new MlxAudioSupervisor({
      pythonCommand: null,
      adapters: {
        reachable: async () => false,
        spawn: () => ((spawned += 1), fakeChild()),
        now: c.now,
        sleep: c.sleep,
      },
    });
    expect((await s.ensure()).state).toBe("disabled");
    expect(spawned).toBe(0);
  });

  it("spawns once, becomes 'running' when the port answers, restarts with backoff on exit, and exhausts after the cap", async () => {
    const c = clock();
    let up = false;
    const children: ReturnType<typeof fakeChild>[] = [];
    const s = new MlxAudioSupervisor({
      pythonCommand: "/x/python",
      maxRestarts: 2,
      baseBackoffMs: 1000,
      startupTimeoutMs: 5000,
      adapters: {
        reachable: async () => up,
        spawn: () => {
          const ch = fakeChild();
          children.push(ch);
          up = true; // comes up immediately
          return ch;
        },
        now: c.now,
        sleep: c.sleep,
      },
    });
    expect((await s.ensure()).state).toBe("running");
    expect(children).toHaveLength(1);
    // Crash → backoff → automatic restart (ensure() is re-entered after sleep).
    up = false;
    children[0]!.exit(1);
    expect(s.snapshot().state).toBe("backoff");
    expect(s.snapshot().restarts).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    expect(children).toHaveLength(2);
    expect(s.snapshot().state).toBe("running");
    up = false;
    children[1]!.exit(1);
    expect(s.snapshot().state).toBe("exhausted");
    expect((await s.ensure()).state).toBe("exhausted");
    expect(children).toHaveLength(2);
    expect(s.snapshot().last_error).toMatch(/exited with code 1/);
  });

  it("ensure() is idempotent while a start is in flight", async () => {
    const c = clock();
    let spawned = 0;
    let up = false;
    const s = new MlxAudioSupervisor({
      pythonCommand: "/x/python",
      startupTimeoutMs: 2000,
      adapters: {
        reachable: async () => up,
        spawn: () => ((spawned += 1), (up = true), fakeChild()),
        now: c.now,
        sleep: c.sleep,
      },
    });
    const [a, b] = await Promise.all([s.ensure(), s.ensure()]);
    expect(spawned).toBe(1);
    expect(a.state).toBe("running");
    expect(b.state).toBe("running");
  });
});

describe("25G G4 — bootstrap projection", () => {
  it("is 'not_packaged' in dev and carries next steps from failed checks when packaged", async () => {
    const dev = buildBootstrapProjection({
      packaged: false,
      dataDir: "/tmp/d",
      doctor: null,
      ollamaReachable: true,
      mlxAudio: null,
      now: NOW,
    });
    expect(dev.verdict).toBe("not_packaged");
    expect(BootstrapProjectionSchema.safeParse(dev).success).toBe(true);
    const report = await runPackagedDoctor({
      env: {},
      adapters: adapters({ reachable: async () => false }),
      now: NOW,
    });
    const packaged = buildBootstrapProjection({
      packaged: true,
      dataDir: "/tmp/d",
      doctor: report,
      ollamaReachable: false,
      mlxAudio: null,
      now: NOW,
    });
    expect(packaged.verdict).toBe("blocked");
    expect(packaged.next_steps.map((s) => s.check_id)).toEqual([
      "packaged:ollama-reachable",
      "packaged:mlx-audio-reachable",
      "packaged:voice-venv-configured",
    ]);
    expect(JSON.stringify(packaged)).not.toMatch(/sk-|api_key|token/);
  });

  it("the node runtime in dev mode is inert: no doctor, no supervisor child, not_packaged", async () => {
    const rt = createPackagedRuntime({
      env: {},
      cwd: "/nonexistent",
      fetchImpl: (async () => {
        throw new Error("no network");
      }) as typeof fetch,
    });
    expect(rt.packaged).toBe(false);
    expect(await rt.doctor()).toBeNull();
    expect(await rt.doctorObservation()).toBeNull();
    const b = await rt.bootstrap();
    expect(b.verdict).toBe("not_packaged");
    expect(b.sidecars.mlx_audio).toBeNull();
    expect(rt.supervisor.snapshot().state).toBe("disabled");
  });
});
