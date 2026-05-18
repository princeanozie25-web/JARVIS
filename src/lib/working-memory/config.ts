export interface WorkingMemoryConfig {
  enabled: boolean;
  maxRecentMessages: number;
  maxRetrievedMemories: number;
  maxChars: number;
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

export function workingMemoryConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WorkingMemoryConfig {
  return {
    enabled: booleanEnv(env.JARVIS_WORKING_MEMORY_ENABLED, false),
    maxRecentMessages: integerEnv(
      env.JARVIS_WORKING_MEMORY_MAX_RECENT_MESSAGES,
      20,
    ),
    maxRetrievedMemories: integerEnv(
      env.JARVIS_WORKING_MEMORY_MAX_RETRIEVED_MEMORIES,
      8,
    ),
    maxChars: integerEnv(env.JARVIS_WORKING_MEMORY_MAX_CHARS, 12_000),
  };
}
