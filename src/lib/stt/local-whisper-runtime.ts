import type {
  LocalTranscriptionProviderConfig,
  TranscriptionProviderCapabilities,
  TranscriptionProviderStatus,
} from "./types";

export interface LocalWhisperRuntimeConfig extends LocalTranscriptionProviderConfig {
  enabled: boolean;
}

export interface LocalWhisperRuntimeStatus {
  providerId: "local-whisper-placeholder";
  status: TranscriptionProviderStatus;
  message?: string;
  capabilities: TranscriptionProviderCapabilities;
  config: LocalWhisperRuntimeConfig;
}

export interface LocalWhisperRuntimeHandle {
  shutdown(): Promise<void>;
}

export interface LocalWhisperRuntimeOptions {
  config: LocalWhisperRuntimeConfig;
  capabilities?: TranscriptionProviderCapabilities;
  fileExists?: (path: string) => Promise<boolean>;
  launchRuntime?: (
    config: LocalWhisperRuntimeConfig,
    signal: AbortSignal,
  ) => Promise<LocalWhisperRuntimeHandle>;
}

export const localWhisperRuntimeCapabilities: TranscriptionProviderCapabilities =
  {
    supportsStreaming: false,
    supportsPartialResults: false,
    runsLocally: true,
    requiresNetwork: false,
    storesAudio: false,
  };

export class LocalWhisperRuntime {
  private status: TranscriptionProviderStatus = "disabled";
  private message: string | undefined;
  private handle: LocalWhisperRuntimeHandle | undefined;

  constructor(private readonly opts: LocalWhisperRuntimeOptions) {
    this.status = opts.config.enabled ? "not_installed" : "disabled";
  }

  async initialize(): Promise<LocalWhisperRuntimeStatus> {
    await this.shutdown();

    const config = this.opts.config;
    if (!config.enabled) {
      this.status = "disabled";
      this.message = "Local Whisper provider is disabled.";
      return this.getStatus();
    }

    this.status = "loading";
    this.message = undefined;

    try {
      assertLocalOnly(this.capabilities);
      const availability = await this.checkAvailability(config);
      if (!availability.ok) {
        this.status = "not_installed";
        this.message = availability.message;
        return this.getStatus();
      }

      if (this.opts.launchRuntime) {
        const startupAbort = new AbortController();
        this.handle = await withTimeout(
          this.opts.launchRuntime(config, startupAbort.signal),
          config.startupTimeoutMs,
          "Local Whisper startup timed out.",
          () => startupAbort.abort(),
        );
      }

      this.status = "ready";
      this.message = "Local Whisper runtime is ready.";
      return this.getStatus();
    } catch (error) {
      await this.shutdown();
      this.status = "error";
      this.message = error instanceof Error ? error.message : String(error);
      return this.getStatus();
    }
  }

  async shutdown(): Promise<void> {
    const handle = this.handle;
    this.handle = undefined;
    if (handle) {
      await handle.shutdown();
    }
  }

  getStatus(): LocalWhisperRuntimeStatus {
    return {
      providerId: "local-whisper-placeholder",
      status: this.status,
      message: this.message,
      capabilities: this.capabilities,
      config: this.opts.config,
    };
  }

  private get capabilities(): TranscriptionProviderCapabilities {
    return this.opts.capabilities ?? localWhisperRuntimeCapabilities;
  }

  private async checkAvailability(
    config: LocalWhisperRuntimeConfig,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!config.binaryPath) {
      return { ok: false, message: "Local Whisper binary path is not set." };
    }
    if (!config.modelPath) {
      return { ok: false, message: "Local Whisper model path is not set." };
    }

    const exists = this.opts.fileExists ?? defaultFileExists;
    const [binaryExists, modelExists] = await Promise.all([
      exists(config.binaryPath),
      exists(config.modelPath),
    ]);

    if (!binaryExists) {
      return {
        ok: false,
        message: `Local Whisper binary was not found: ${config.binaryPath}`,
      };
    }
    if (!modelExists) {
      return {
        ok: false,
        message: `Local Whisper model was not found: ${config.modelPath}`,
      };
    }

    return { ok: true };
  }
}

export function assertLocalOnly(
  capabilities: TranscriptionProviderCapabilities,
): void {
  if (!capabilities.runsLocally) {
    throw new Error("Local Whisper runtime must run locally.");
  }
  if (capabilities.requiresNetwork) {
    throw new Error("Local Whisper runtime must not require network access.");
  }
  if (capabilities.storesAudio) {
    throw new Error("Local Whisper runtime must not store audio.");
  }
}

async function defaultFileExists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          onTimeout?.();
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
