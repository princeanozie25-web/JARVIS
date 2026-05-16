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
  },

  anthropic: {
    apiKey: requiredEnv("ANTHROPIC_API_KEY"),
  },

  app: {
    name: "JARVIS",
  },
};
