import { describe, expect, it, vi } from "vitest";
import {
  assertLocalOnly,
  LocalWhisperRuntime,
  localWhisperRuntimeCapabilities,
  type LocalWhisperRuntimeConfig,
  type LocalWhisperRuntimeHandle,
} from "./local-whisper-runtime";
import {
  localWhisperProviderWithStatus,
  localWhisperPlaceholderConfig,
} from "./local-whisper-placeholder";

const enabledConfig: LocalWhisperRuntimeConfig = {
  ...localWhisperPlaceholderConfig,
  enabled: true,
  binaryPath: "C:\\local\\whisper.exe",
  modelPath: "C:\\local\\ggml-base.bin",
  startupTimeoutMs: 1,
};

describe("LocalWhisperRuntime", () => {
  it("stays disabled unless explicitly enabled", async () => {
    const runtime = new LocalWhisperRuntime({
      config: {
        ...localWhisperPlaceholderConfig,
        enabled: false,
      },
      fileExists: vi.fn(),
      launchRuntime: vi.fn(),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      providerId: "local-whisper-placeholder",
      status: "disabled",
      message: "Local Whisper provider is disabled.",
      capabilities: localWhisperRuntimeCapabilities,
    });
  });

  it("reports not installed when configured paths are missing", async () => {
    const runtime = new LocalWhisperRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(false),
      launchRuntime: vi.fn(),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "not_installed",
      message: `Local Whisper binary was not found: ${enabledConfig.binaryPath}`,
    });
  });

  it("times out startup and transitions to error", async () => {
    let startupAborted = false;
    const runtime = new LocalWhisperRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
      launchRuntime: vi.fn(
        (_config, signal) =>
          new Promise<LocalWhisperRuntimeHandle>(() => {
            signal.addEventListener("abort", () => {
              startupAborted = true;
            });
            // Intentionally never resolves; startup timeout must protect callers.
          }),
      ),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "error",
      message: "Local Whisper startup timed out.",
    });
    expect(startupAborted).toBe(true);
  });

  it("shuts down a handle that resolves after startup timeout", async () => {
    let resolveLateHandle:
      | ((handle: LocalWhisperRuntimeHandle) => void)
      | undefined;
    const lateShutdown = vi.fn().mockResolvedValue(undefined);
    const runtime = new LocalWhisperRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
      launchRuntime: vi.fn(
        () =>
          new Promise<LocalWhisperRuntimeHandle>((resolve) => {
            resolveLateHandle = resolve;
          }),
      ),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "error",
      message: "Local Whisper startup timed out.",
    });

    resolveLateHandle?.({
      shutdown: lateShutdown,
      transcribe: vi.fn(),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lateShutdown).toHaveBeenCalledTimes(1);
  });

  it("shuts down an initialized runtime handle", async () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const runtime = new LocalWhisperRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
      launchRuntime: vi
        .fn()
        .mockResolvedValue({ shutdown, transcribe: vi.fn() }),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "ready",
      message: "Local Whisper runtime is ready.",
    });

    await runtime.shutdown();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("does not report ready without an execution launcher", async () => {
    const runtime = new LocalWhisperRuntime({
      config: enabledConfig,
      fileExists: vi.fn().mockResolvedValue(true),
    });

    await expect(runtime.initialize()).resolves.toMatchObject({
      status: "error",
      message: "Local Whisper runtime launcher is not configured.",
    });
  });

  it("rejects capabilities that would break the local-only invariant", () => {
    expect(() =>
      assertLocalOnly({
        ...localWhisperRuntimeCapabilities,
        requiresNetwork: true,
      }),
    ).toThrow("Local Whisper runtime must not require network access.");

    expect(() =>
      assertLocalOnly({
        ...localWhisperRuntimeCapabilities,
        storesAudio: true,
      }),
    ).toThrow("Local Whisper runtime must not store audio.");
  });
});

describe("localWhisperProviderWithStatus", () => {
  it("creates readiness snapshots without enabling transcription by default", () => {
    expect(localWhisperProviderWithStatus({ status: "ready" })).toMatchObject({
      id: "local-whisper-placeholder",
      enabled: false,
      status: "ready",
      capabilities: {
        runsLocally: true,
        requiresNetwork: false,
        storesAudio: false,
      },
    });
  });
});
