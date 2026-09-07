// Self Model (E-050) — the OPERATIONAL self (runtime snapshot).
//
// The only source with CURRENT_VERIFIED_RUNTIME trust. Everything here is
// a probe result with a TTL: what is answering on the loopback ports, what
// the doctor sees, what the database holds, which build I am. Probes are
// injected so tests never touch the network and the smoke uses the real
// machine.
import { claim, evidence, type SelfClaim } from "../contracts";

export interface RuntimeHostObservation {
  platform: string;
  arch: string;
  node_version: string;
  total_ram_gb: number;
  free_ram_gb: number;
  process_uptime_s: number;
}

export interface RuntimeOllamaObservation {
  reachable: boolean;
  models: readonly string[];
  latency_ms: number | null;
}

export interface RuntimeMlxAudioObservation {
  reachable: boolean;
  latency_ms: number | null;
}

export interface RuntimeDbObservation {
  reachable: boolean;
  tables: number;
  telemetry_events: number;
  tool_calls: number;
  approvals_pending: number;
  environment_devices: number;
}

export interface RuntimeDoctorObservation {
  verdict: string;
  blocking_failures: number;
  warnings: number;
  skipped: number;
  pending: number;
  hardware: {
    total_ram_gb: number;
    unified_memory: boolean;
    metal: boolean;
    platform: string;
    arch: string;
  } | null;
}

export interface RuntimeObservations {
  now: string;
  package_version: string | null;
  git: { branch: string | null; sha: string | null } | null;
  host: RuntimeHostObservation | null;
  ollama: RuntimeOllamaObservation | null;
  mlx_audio: RuntimeMlxAudioObservation | null;
  db: RuntimeDbObservation | null;
  event_store: { enabled: boolean; reachable: boolean } | null;
  doctor: RuntimeDoctorObservation | null;
  // Registry models whose provider is ollama: id -> modelName. Used to say
  // "the registry lists X; Ollama actually serves it / does not".
  registry_ollama_models: ReadonlyArray<{ id: string; modelName: string }>;
}

export const RUNTIME_PROBE_TTL_MS = 60_000;
export const RUNTIME_DOCTOR_TTL_MS = 5 * 60_000;
export const RUNTIME_DB_TTL_MS = 2 * 60_000;

export function buildRuntimeClaims(o: RuntimeObservations): SelfClaim[] {
  const now = o.now;
  const claims: SelfClaim[] = [];

  claims.push(
    claim({
      claim_id: "self:runtime.build",
      category: "runtime",
      subject: "runtime.build",
      statement: o.package_version
        ? `I am JARVIS ${o.package_version}${o.git?.branch ? `, branch ${o.git.branch}` : ""}${o.git?.sha ? ` @ ${o.git.sha.slice(0, 7)}` : ""}.`
        : "My build version could not be read.",
      status: o.package_version ? "operational" : "unknown",
      trust_class: "current_verified_runtime",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        o.package_version
          ? evidence("runtime_probe", "package.json#version", now)
          : evidence("unavailable", "package.json#version", now),
        ...(o.git?.sha ? [evidence("runtime_probe", ".git/HEAD", now)] : []),
      ],
    }),
  );

  if (o.host) {
    claims.push(
      claim({
        claim_id: "self:runtime.host",
        category: "node",
        subject: "node:local",
        statement: `I am running as a single node on ${o.host.platform}/${o.host.arch}, Node ${o.host.node_version}, ${o.host.total_ram_gb} GB RAM (${o.host.free_ram_gb} GB free), process up ${Math.round(o.host.process_uptime_s)} s.`,
        status: "operational",
        trust_class: "current_verified_runtime",
        observed_at: now,
        ttl_ms: RUNTIME_PROBE_TTL_MS,
        evidence: [evidence("runtime_probe", "node:os", now)],
      }),
    );
  }
  claims.push(
    claim({
      claim_id: "self:node.topology",
      category: "node",
      subject: "node:topology",
      statement:
        "No compute-node registry exists: I know only the node I am running on. Remote nodes (e.g. a Windows box) are a roadmap item, not something I can see or reach.",
      status: "planned",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        evidence(
          "registry",
          "src/lib (no node registry module)",
          now,
          "audited 2026-09-07: none found",
        ),
      ],
    }),
  );

  if (o.ollama) {
    const registered = new Set(
      o.registry_ollama_models.map((m) => m.modelName),
    );
    const unregistered = o.ollama.models.filter(
      (x) =>
        !registered.has(x) &&
        ![...registered].some((r) => x.startsWith(`${r}:`) || r.startsWith(x)),
    );
    claims.push(
      claim({
        claim_id: "self:runtime.ollama",
        category: "runtime",
        subject: "provider:ollama",
        statement: o.ollama.reachable
          ? `Ollama is answering on loopback (${o.ollama.latency_ms ?? "?"} ms) and serves ${o.ollama.models.length} models${o.ollama.models.length ? `: ${o.ollama.models.slice(0, 8).join(", ")}` : ""}.${unregistered.length ? ` ${unregistered.length} of them (${unregistered.slice(0, 4).join(", ")}) are served but not in my model registry, so I will not route to them.` : ""}`
          : "Ollama is not answering on loopback; local chat inference is offline right now.",
        status: o.ollama.reachable ? "operational" : "offline",
        trust_class: "current_verified_runtime",
        observed_at: now,
        ttl_ms: RUNTIME_PROBE_TTL_MS,
        evidence: [
          evidence("runtime_probe", "http://127.0.0.1:11434/api/tags", now),
        ],
      }),
    );
    for (const m of o.registry_ollama_models) {
      const served =
        o.ollama.reachable &&
        o.ollama.models.some(
          (x) =>
            x === m.modelName ||
            x.startsWith(`${m.modelName}:`) ||
            m.modelName.startsWith(x),
        );
      claims.push(
        claim({
          claim_id: `self:runtime.model.${m.id.replace(/[^a-z0-9._-]/gi, "-").toLowerCase()}`,
          category: "runtime",
          subject: `model:${m.id}`,
          statement: !o.ollama.reachable
            ? `${m.id}: Ollama is down, so this model is offline right now.`
            : served
              ? `${m.id}: served by the running Ollama (${m.modelName}).`
              : `${m.id}: registered but the running Ollama does not list ${m.modelName}; offline until pulled.`,
          status: served ? "operational" : "offline",
          trust_class: "current_verified_runtime",
          observed_at: now,
          ttl_ms: RUNTIME_PROBE_TTL_MS,
          evidence: [
            evidence("runtime_probe", "http://127.0.0.1:11434/api/tags", now),
          ],
        }),
      );
    }
  }

  if (o.mlx_audio) {
    claims.push(
      claim({
        claim_id: "self:runtime.mlx-audio",
        category: "runtime",
        subject: "voice:tts-server",
        statement: o.mlx_audio.reachable
          ? `The mlx-audio TTS server is answering on loopback (${o.mlx_audio.latency_ms ?? "?"} ms); I can speak with the local engines.`
          : "The mlx-audio TTS server is not answering; spoken output falls back down the E-011 chain (Piper → captions).",
        status: o.mlx_audio.reachable ? "operational" : "degraded",
        trust_class: "current_verified_runtime",
        observed_at: now,
        ttl_ms: RUNTIME_PROBE_TTL_MS,
        evidence: [evidence("runtime_probe", "http://127.0.0.1:8004", now)],
      }),
    );
  }

  if (o.db) {
    claims.push(
      claim({
        claim_id: "self:runtime.db",
        category: "runtime",
        subject: "runtime.db",
        statement: o.db.reachable
          ? `My SQLite store is open: ${o.db.tables} tables, ${o.db.telemetry_events} telemetry events, ${o.db.tool_calls} tool calls, ${o.db.approvals_pending} pending approvals, ${o.db.environment_devices} environment devices.`
          : "My SQLite store could not be opened.",
        status: o.db.reachable ? "operational" : "offline",
        trust_class: "current_verified_runtime",
        observed_at: now,
        ttl_ms: RUNTIME_DB_TTL_MS,
        evidence: [evidence("runtime_probe", "data/jarvis.db", now)],
      }),
    );
  }

  if (o.event_store) {
    claims.push(
      claim({
        claim_id: "self:runtime.event-store",
        category: "runtime",
        subject: "runtime.event-store",
        statement: !o.event_store.enabled
          ? "The event store is disabled by configuration; self-snapshots are not persisted."
          : o.event_store.reachable
            ? "The event store is open; self-snapshots and observations are persisted there (typed events only)."
            : "The event store is enabled but could not be opened.",
        status: !o.event_store.enabled
          ? "offline"
          : o.event_store.reachable
            ? "operational"
            : "degraded",
        trust_class: "current_verified_runtime",
        observed_at: now,
        ttl_ms: RUNTIME_DB_TTL_MS,
        evidence: [evidence("runtime_probe", "data/event-store.db", now)],
      }),
    );
  }

  if (o.doctor) {
    const d = o.doctor;
    const ok = d.verdict === "ready" && d.blocking_failures === 0;
    claims.push(
      claim({
        claim_id: "self:runtime.doctor",
        category: "runtime",
        subject: "runtime.doctor",
        statement: `Doctor (safe local runtime) verdict: ${d.verdict}; ${d.blocking_failures} blocking failures, ${d.warnings} warnings, ${d.skipped} by-design skips, ${d.pending} pending.${d.hardware ? ` Hardware profile: ${d.hardware.total_ram_gb} GB${d.hardware.unified_memory ? " unified" : ""}${d.hardware.metal ? ", Metal" : ""} (${d.hardware.platform}/${d.hardware.arch}).` : ""}`,
        status: ok
          ? "operational"
          : d.blocking_failures > 0
            ? "degraded"
            : "unknown",
        trust_class: "current_verified_runtime",
        observed_at: now,
        ttl_ms: RUNTIME_DOCTOR_TTL_MS,
        evidence: [
          evidence(
            "runtime_probe",
            "src/lib/bootstrap-readiness/doctor-runtime.ts#runSafeLocalDoctorRuntime",
            now,
          ),
        ],
      }),
    );
  }

  return claims;
}
