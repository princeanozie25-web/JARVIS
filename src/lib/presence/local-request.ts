// Presence routes are for the person at this machine: loopback host, and a
// same-origin fetch from the page (or a direct navigation). Nothing else.
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLocalPresenceRequest(req: Request): boolean {
  try {
    const url = new URL(req.url);
    if (!LOOPBACK.has(url.hostname)) return false;
    const host = req.headers.get("host") ?? "";
    const hostName = host.startsWith("[")
      ? host.slice(0, host.indexOf("]") + 1)
      : host.split(":")[0];
    if (!LOOPBACK.has(hostName ?? "")) return false;
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = req.headers.get("origin");
    if (origin) {
      const o = new URL(origin);
      if (!LOOPBACK.has(o.hostname)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
