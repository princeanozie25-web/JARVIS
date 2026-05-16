import "server-only";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export const config = {
  openai: {
    apiKey: requiredEnv("OPENAI_API_KEY"),
    model: "gpt-4o-mini",
  },

  anthropic: {
    apiKey: requiredEnv("ANTHROPIC_API_KEY"),
    model: "claude-haiku-4-5-20251001",
  },

  app: {
    name: "JARVIS",
  },
};
