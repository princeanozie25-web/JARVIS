export interface SessionSummaryConfig {
  enabled: boolean;
  everyMessages: number;
}

function booleanEnv(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function integerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function sessionSummaryConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SessionSummaryConfig {
  return {
    enabled: booleanEnv(env.JARVIS_SESSION_SUMMARY_ENABLED, true),
    everyMessages: integerEnv(env.JARVIS_SESSION_SUMMARY_EVERY_MESSAGES, 10),
  };
}
