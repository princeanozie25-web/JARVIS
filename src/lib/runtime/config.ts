import { homedir } from "node:os";
import { join } from "node:path";
import { embeddingConfigFromEnv } from "../memory/embedding-config";
import { vectorStoreConfigFromEnv } from "../memory/vector-config";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
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

  tools: {
    enabled: booleanEnv("JARVIS_TOOLS_ENABLED", false),
    workspaceRoot:
      process.env.JARVIS_WORKSPACE_ROOT ?? join(homedir(), "jarvis-workspace"),
    bindHost:
      process.env.JARVIS_BIND_HOST ??
      process.env.HOST ??
      process.env.HOSTNAME ??
      "localhost",
  },

  memory: {
    embeddings: embeddingConfigFromEnv(process.env),
    vectorStore: vectorStoreConfigFromEnv(process.env),
  },
};
