import { homedir } from "node:os";
import { join } from "node:path";
import { embeddingConfigFromEnv } from "../memory/embedding-config";
import { vectorStoreConfigFromEnv } from "../memory/vector-config";
import { sessionSummaryConfigFromEnv } from "../session-summary/config";
import { workingMemoryConfigFromEnv } from "../working-memory/config";

// E-037 (Phase 25B-1): cloud keys are OPTIONAL. JARVIS is local-first; a
// missing key must not throw at import (it used to kill /api/chat on a
// machine with no cloud account). A provider whose key is empty is simply
// not registered (src/lib/providers/registry.ts) — fail closed, no fallback.
function optionalEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

export const config = {
  openai: {
    apiKey: optionalEnv("OPENAI_API_KEY"),
  },

  anthropic: {
    apiKey: optionalEnv("ANTHROPIC_API_KEY"),
  },

  app: {
    name: "JARVIS",
  },

  ollama: {
    baseUrl:
      process.env.JARVIS_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
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

  sessionSummary: sessionSummaryConfigFromEnv(process.env),

  workingMemory: workingMemoryConfigFromEnv(process.env),
};
