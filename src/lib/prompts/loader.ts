import "server-only";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export interface LoadedPrompt {
  name: string;
  content: string;
  hash: string;
}

const PROMPTS_DIR = join(process.cwd(), "prompts");
const cache = new Map<string, LoadedPrompt>();

export function loadPrompt(name: string): LoadedPrompt {
  const cached = cache.get(name);
  if (cached) return cached;

  const filePath = join(PROMPTS_DIR, `${name}.md`);
  const content = readFileSync(filePath, "utf8");
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);

  const loaded: LoadedPrompt = { name, content, hash };
  cache.set(name, loaded);
  return loaded;
}

export function loadSystemPrompt(): LoadedPrompt {
  return loadPrompt("jarvis_system");
}
