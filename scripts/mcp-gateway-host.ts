// Phase 25B / E-045 — the stdio MCP gateway HOST.
//
// Runs the frozen Phase 24 gateway (`startStdioServer`) with the real seams
// injected from OUTSIDE its import graph: the provisioned client registry from
// env (hashes only), live pending counts from the app DB (read-only), a
// durable file-backed mute store and last-used recorder under
// data/mcp-gateway/, and admission limits from env. Loopback stdio only —
// no HTTP, no socket, no network (Phase 24 §7).
//
//   npx tsx scripts/mcp-gateway-host.ts            # serve JSON-RPC on stdin/stdout
//   npx tsx scripts/mcp-gateway-host.ts --probe    # print the injected seam values, exit
//
// The client presents its token out-of-band via JARVIS_MCP_TOKEN in ITS spawn
// env (the gateway reads process.env.JARVIS_MCP_TOKEN); the host never sees or
// logs a plaintext token. The registry is JARVIS_MCP_CLIENT_REGISTRY:
//   {"<sha256 of token>": {"client_id":"claude-desktop","enabled":true,"scope":{...}}}

import { join } from "node:path";

import { getDb } from "../src/lib/db/client-node";
import { startStdioServer } from "../src/lib/mcp-gateway";
import { parseClientRegistryFromEnv } from "../src/lib/mcp-gateway/client-registry";
import {
  admissionLimitsFromEnv,
  createApprovalsQueueSource,
  createFileLastUsedRecorder,
  createFileMuteStore,
  createPendingCountForClient,
} from "../src/lib/mcp-gateway-host/seams";

function main(): void {
  const env = process.env;
  const probe = process.argv.includes("--probe");
  const dataDir =
    env.JARVIS_MCP_HOST_DATA_DIR?.trim() ||
    join(process.cwd(), "data", "mcp-gateway");

  const registry = parseClientRegistryFromEnv(env);
  const db = getDb();
  const queueStatusSource = createApprovalsQueueSource(db);
  const pendingCountForClient = createPendingCountForClient(db);
  const muteStore = createFileMuteStore(join(dataDir, "mutes.json"));
  const lastUsed = createFileLastUsedRecorder(join(dataDir, "last-used.json"));
  const admissionLimits = admissionLimitsFromEnv(env);
  const cadence = Number(env.JARVIS_MCP_QUEUE_STATUS_CADENCE_MS ?? "");

  if (probe) {
    // Metadata only: counts and ids — never a token, never a row.
    console.log(
      JSON.stringify(
        {
          ok: true,
          registry_clients: [...registry.values()].map((c) => ({
            client_id: c.client_id,
            enabled: c.enabled,
            scoped: c.scope !== null && c.scope !== undefined,
          })),
          pending_total: queueStatusSource(),
          muted_clients: Object.keys(muteStore.list()),
          last_used: lastUsed.list(),
          admission_limits: admissionLimits,
          data_dir: dataDir,
          transport: "stdio (loopback only)",
        },
        null,
        2,
      ),
    );
    return;
  }

  const server = startStdioServer({
    clientRegistry: registry,
    recordLastUsed: lastUsed,
    queueStatusSource,
    ...(Number.isFinite(cadence) && cadence > 0
      ? { queueStatusCadenceMs: cadence }
      : {}),
    admissionLimits,
    clientMuteStore: muteStore,
    pendingCountForClient,
  });
  // stderr only: the stdout channel is the JSON-RPC wire.
  console.error(
    `[mcp-gateway-host] serving stdio; authenticated=${server.authenticated} client=${server.clientId ?? "none"} clients_provisioned=${registry.size}`,
  );
  const stop = () => {
    server.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.stdin.on("end", stop);
}

main();
