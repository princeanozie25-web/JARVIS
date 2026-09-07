// Self Model (E-050) — the default (node-side) composition.
//
// Wires the five sources to the real substrates: the live registries, the
// system prompt, the loopback probes, the SQLite audit tables and the
// repository documents. Every probe is bounded (timeout) and every source
// degrades to "unknown" claims rather than throwing. Keep this file the
// only place that knows about the environment; the sources stay pure.
import type DatabaseType from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { arch, freemem, platform, totalmem } from "node:os";
import { join, resolve } from "node:path";

import { getStaticArchitectureGraph } from "../architecture-graph/static-registry";
import { runSafeLocalDoctorRuntime } from "../bootstrap-readiness/doctor-runtime";
import { listTelemetryEvents } from "../db/telemetry";
import { listToolCalls } from "../db/tool-calls";
import { models as modelRegistry } from "../models/registry";
import { registry as providerRegistry } from "../providers/registry";
import type { Tool } from "../tools/types";
import { loadVoiceLiveConfig } from "../voice/live/config";
import { createDefaultVoiceRuntimeFeatureFlags } from "../voice-runtime/feature-flags";
import { buildHardwareProfile } from "../../models/hardware-fit";
import {
  getAppEventStore,
  resolveEventStorePath,
} from "../../store/app-event-store";

import { SelfModel, type SelfModelOptions } from "./model";
import { buildCapabilityClaims } from "./sources/capabilities";
import { buildConstitutionalClaims } from "./sources/constitutional";
import { buildExperienceClaims } from "./sources/experience";
import { buildRepositoryClaims } from "./sources/repository";
import {
  buildRuntimeClaims,
  type RuntimeDbObservation,
  type RuntimeDoctorObservation,
  type RuntimeMlxAudioObservation,
  type RuntimeOllamaObservation,
} from "./sources/runtime";
import { createSelfModelWriter } from "./writers";

export interface SelfRuntimeProbes {
  ollama(): Promise<RuntimeOllamaObservation | null>;
  mlxAudio(): Promise<RuntimeMlxAudioObservation | null>;
  doctor(): RuntimeDoctorObservation | null;
}

export interface DefaultSelfModelOptions {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  // The audit database (Phase 3 tables). null = experience source reports
  // "unknown"; tests pass an in-memory db.
  db?: DatabaseType.Database | null;
  // Tools to describe. Injected because the tool index registers the
  // self.* tools themselves (importing it here would be circular).
  tools?: readonly Tool[];
  probes?: Partial<SelfRuntimeProbes>;
  fetchImpl?: typeof fetch;
  probeTimeoutMs?: number;
  persistSnapshots?: boolean;
  now?: () => Date;
  cacheTtlMs?: number;
}

async function timedFetch(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<{ ok: boolean; json: unknown; ms: number } | null> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, json, ms: Date.now() - t0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createNodeSelfRuntimeProbes(options: {
  env: Record<string, string | undefined>;
  projectRoot: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): SelfRuntimeProbes {
  const ollamaBase =
    options.env.JARVIS_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const mlxBase =
    options.env.JARVIS_MLX_AUDIO_URL?.trim() || "http://127.0.0.1:8004";
  return {
    async ollama() {
      const r = await timedFetch(
        options.fetchImpl,
        `${ollamaBase}/api/tags`,
        options.timeoutMs,
      );
      if (!r) return { reachable: false, models: [], latency_ms: null };
      const list =
        (r.json as { models?: Array<{ name?: string }> } | null)?.models ?? [];
      return {
        reachable: r.ok,
        models: list.map((m) => m.name ?? "").filter(Boolean),
        latency_ms: r.ms,
      };
    },
    async mlxAudio() {
      // mlx-audio exposes OpenAI-compatible routes; /v1/models is the cheap liveness call.
      const r = await timedFetch(
        options.fetchImpl,
        `${mlxBase}/v1/models`,
        options.timeoutMs,
      );
      if (!r) return { reachable: false, latency_ms: null };
      return { reachable: r.ok, latency_ms: r.ms };
    },
    doctor() {
      try {
        const hardware = buildHardwareProfile({
          totalRamBytes: totalmem(),
          freeRamBytes: freemem(),
          platform: platform(),
          arch: arch(),
        });
        const evaluation = runSafeLocalDoctorRuntime({
          adapters: {
            pathExists: (req: { path?: string; relative_path?: string }) => {
              const p = req.path ?? req.relative_path ?? "";
              return p ? existsSync(resolve(options.projectRoot, p)) : false;
            },
            nodeVersion: () => process.version,
            platform: () => platform(),
          },
          hardwareProfile: hardware,
        });
        const report = evaluation.report;
        return {
          verdict: report.verdict,
          blocking_failures: report.blocking_failures.length,
          warnings: report.warnings.length,
          skipped: report.skipped_checks.length,
          pending: report.pending_checks.length,
          hardware: {
            total_ram_gb: hardware.totalRamGb,
            unified_memory: hardware.unifiedMemory,
            metal: hardware.metal,
            platform: hardware.platform,
            arch: hardware.arch,
          },
        };
      } catch {
        return null;
      }
    },
  };
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function readPackageVersion(root: string): string | null {
  const text = readText(join(root, "package.json"));
  if (!text) return null;
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

// Read-only, spawn-free: HEAD → ref → sha.
function readGit(
  root: string,
): { branch: string | null; sha: string | null } | null {
  const head = readText(join(root, ".git", "HEAD"))?.trim();
  if (!head) return null;
  const m = /^ref:\s*(.+)$/.exec(head);
  if (!m) return { branch: null, sha: head };
  const ref = m[1]!.trim();
  const branch = ref.replace(/^refs\/heads\//, "");
  const sha = readText(join(root, ".git", ref))?.trim() ?? null;
  return { branch, sha };
}

function dbObservation(
  db: DatabaseType.Database | null,
): RuntimeDbObservation | null {
  if (!db) return null;
  const count = (sql: string): number => {
    try {
      return Number(
        (db.prepare(sql).get() as { n?: number } | undefined)?.n ?? 0,
      );
    } catch {
      return 0;
    }
  };
  try {
    return {
      reachable: true,
      tables: count(
        `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'`,
      ),
      telemetry_events: count(`SELECT COUNT(*) AS n FROM telemetry_events`),
      tool_calls: count(`SELECT COUNT(*) AS n FROM tool_calls`),
      approvals_pending: count(
        `SELECT COUNT(*) AS n FROM approvals WHERE status = 'PENDING'`,
      ),
      environment_devices: count(
        `SELECT COUNT(*) AS n FROM environment_device`,
      ),
    };
  } catch {
    return {
      reachable: false,
      tables: 0,
      telemetry_events: 0,
      tool_calls: 0,
      approvals_pending: 0,
      environment_devices: 0,
    };
  }
}

export function createDefaultSelfModel(
  options: DefaultSelfModelOptions = {},
): SelfModel {
  const root = options.projectRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.probeTimeoutMs ?? 1500;
  const now = options.now ?? (() => new Date());
  const db = options.db ?? null;
  const nodeProbes = createNodeSelfRuntimeProbes({
    env,
    projectRoot: root,
    fetchImpl,
    timeoutMs,
  });
  const probes: SelfRuntimeProbes = { ...nodeProbes, ...options.probes };
  const tools = options.tools ?? [];

  const sources: SelfModelOptions["sources"] = {
    constitutional: () => {
      // Same file the chat route's loadSystemPrompt() reads; the loader
      // itself is `server-only` and cannot be imported here or in tests.
      const text = readText(join(root, "prompts", "jarvis_system.md"));
      return buildConstitutionalClaims({
        now: now().toISOString(),
        systemPromptText: text,
      });
    },
    capabilities: () => {
      let voice = null;
      try {
        const c = loadVoiceLiveConfig(env);
        voice = {
          mode: c.mode,
          privacy_local_only: c.privacy_local_only,
          local_stt: c.local_stt,
          local_tts: c.local_tts,
          local_voice_id: c.local_voice_id,
          local_brain_model: c.local_brain_model,
          openai_realtime_enabled: c.openai_realtime_enabled,
          wake_word_enabled: c.wake_word_enabled,
          wake_phrase: c.wake_phrase,
          fallback_order: c.fallback_order,
        };
      } catch {
        voice = null;
      }
      return buildCapabilityClaims({
        now: now().toISOString(),
        tools: tools.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          requiredSafetyTag: t.requiredSafetyTag,
          reversibilityClass: t.reversibilityClass,
        })),
        models: modelRegistry.list().map((m) => ({
          id: m.id,
          provider: m.provider,
          modelName: m.modelName,
          tier: m.tier,
          capabilities: m.capabilities,
          enabled: m.enabled,
        })),
        providerIds: providerRegistry.list(),
        voice,
        voiceFeatureFlags: createDefaultVoiceRuntimeFeatureFlags(),
      });
    },
    runtime: async () => {
      const [ollama, mlx] = await Promise.all([
        probes.ollama(),
        probes.mlxAudio(),
      ]);
      const storePath = resolveEventStorePath(env);
      return buildRuntimeClaims({
        now: now().toISOString(),
        package_version: readPackageVersion(root),
        git: readGit(root),
        host: {
          platform: platform(),
          arch: arch(),
          node_version: process.version,
          total_ram_gb: Math.round(totalmem() / 1024 ** 3),
          free_ram_gb: Math.round(freemem() / 1024 ** 3),
          process_uptime_s: process.uptime(),
        },
        ollama,
        mlx_audio: mlx,
        db: dbObservation(db),
        event_store: {
          enabled: storePath !== null,
          reachable: storePath !== null && getAppEventStore(env) !== null,
        },
        doctor: probes.doctor(),
        registry_ollama_models: modelRegistry
          .list((m) => m.provider === "ollama" && m.enabled)
          .map((m) => ({ id: m.id, modelName: m.modelName })),
      });
    },
    experience: () => {
      const nowDate = now();
      return buildExperienceClaims({
        now: nowDate.toISOString(),
        nowMs: nowDate.getTime(),
        toolCalls: db ? listToolCalls(db, { limit: 5000 }) : [],
        telemetry: db ? listTelemetryEvents(db, 20000) : [],
      });
    },
    repository: () => {
      let graph = null;
      try {
        const g = getStaticArchitectureGraph();
        graph = { nodes: g.nodes, edges: g.edges };
      } catch {
        graph = null;
      }
      return buildRepositoryClaims({
        now: now().toISOString(),
        graph,
        registryMarkdown: readText(
          join(root, "docs", "enhancements", "REGISTRY.md"),
        ),
      });
    },
  };

  const writer =
    options.persistSnapshots === false
      ? null
      : createSelfModelWriter(getAppEventStore(env));
  return new SelfModel({
    sources,
    now,
    cacheTtlMs: options.cacheTtlMs,
    onSnapshot: writer ? (s) => void writer.recordSnapshot(s) : undefined,
  });
}
