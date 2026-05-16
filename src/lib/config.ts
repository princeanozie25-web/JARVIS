export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-4o-mini",
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-opus-4-1",
  },

  app: {
    name: "JARVIS",
  },
};