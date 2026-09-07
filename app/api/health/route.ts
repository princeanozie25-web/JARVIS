// Phase 25G (G1) — loopback health for the packaged shell.
//
// The Tauri shell starts the Node sidecar and polls this route until it
// answers 200 before opening the window. The body is the E-050 Self Model's
// runtime view, so "healthy" means what JARVIS itself can verify (Ollama,
// TTS server, database, doctor), not merely "the process is up".
// Loopback only: any non-local Host is refused, matching the bind posture.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLoopbackHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.trim().toLowerCase();
  const bare = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0]!;
  return LOCAL_HOSTS.has(bare);
}

export async function GET(req: Request): Promise<Response> {
  if (!isLoopbackHost(req.headers.get("host"))) {
    return new Response("Loopback only", { status: 403 });
  }
  const [
    { createDefaultSelfModel },
    { getDb },
    { tools },
    { getPackagedRuntime },
  ] = await Promise.all([
    import("@/lib/self-model/default"),
    import("@/lib/db/client-node"),
    import("@/lib/tools"),
    import("@/lib/packaging/node"),
  ]);
  // Phase 25G (G4): in the packaged app the first health call also asks the
  // supervisor to bring up the managed voice sidecar (idempotent, bounded).
  const packagedRuntime = getPackagedRuntime();
  if (packagedRuntime.packaged) void packagedRuntime.supervisor.ensure();
  const model = createDefaultSelfModel({
    db: getDb(),
    tools: tools.list(),
    persistSnapshots: false,
    probeTimeoutMs: 800,
  });
  const status = await model.status();
  const runtimeClaims = await model.claims({ category: "runtime" });
  const body = {
    ok: status.headline === "operational" || status.headline === "degraded",
    headline: status.headline,
    generated_at: status.generated_at,
    runtime: runtimeClaims.map((c) => ({
      subject: c.subject,
      status: c.status,
      statement: c.statement,
    })),
    warnings: status.warnings,
    bootstrap: await packagedRuntime.bootstrap(),
  };
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
