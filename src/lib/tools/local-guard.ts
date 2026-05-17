export interface ToolsRuntimeGuardOptions {
  toolsEnabled: boolean;
  bindHost: string;
}

export interface ToolsRuntimeGuardResult {
  ok: boolean;
  reason?: string;
  message?: string;
}

export function parseToolsEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function toolsRuntimeOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ToolsRuntimeGuardOptions {
  return {
    toolsEnabled: parseToolsEnabled(env.JARVIS_TOOLS_ENABLED),
    bindHost: env.JARVIS_BIND_HOST ?? env.HOST ?? env.HOSTNAME ?? "localhost",
  };
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (!normalized || normalized === "localhost") return true;
  if (normalized.endsWith(".localhost")) return true;
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("127.")) return true;

  return false;
}

export function checkToolsRuntimeGuard(
  opts: ToolsRuntimeGuardOptions = toolsRuntimeOptionsFromEnv(),
): ToolsRuntimeGuardResult {
  if (!opts.toolsEnabled) {
    return { ok: true };
  }

  if (isLoopbackHost(opts.bindHost)) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: "non_loopback_bind",
    message:
      "JARVIS tools require a loopback/local-only bind when JARVIS_TOOLS_ENABLED=true.",
  };
}

export function assertToolsRuntimeGuard(
  opts: ToolsRuntimeGuardOptions = toolsRuntimeOptionsFromEnv(),
): void {
  const result = checkToolsRuntimeGuard(opts);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
