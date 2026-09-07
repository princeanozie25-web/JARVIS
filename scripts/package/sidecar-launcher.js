// Phase 25G (E-054) — staged into the bundle as `sidecar.js`, next to the
// Next.js standalone `server.js`. The shell runs THIS instead of server.js so
// the server can never outlive the app: if the parent (the Tauri shell) is
// killed without running its exit handler (kill -9, crash, logout), the
// child's ppid becomes 1 and we exit — found live: an orphaned next-server
// kept 127.0.0.1:3117 and the next launch failed with EADDRINUSE.
// Loopback posture is pinned here as well; a config file cannot widen it.
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

process.env.HOSTNAME = "127.0.0.1";
process.env.JARVIS_BIND_HOST = "127.0.0.1";
process.env.JARVIS_REMOTE_DASHBOARD_ENABLED = "false";

const parentAtStart = process.ppid;
setInterval(() => {
  if (process.ppid === 1 || process.ppid !== parentAtStart) {
    process.exit(0);
  }
}, 2000).unref();

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => process.exit(0));
}

require("./server.js");
