import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    // E-018 (Phase 24E): raise the GLOBAL timeout ceilings to clear the chronic
    // LOAD-INDUCED flakes the E-013/E-015 family characterized — whole-repo-scan
    // governance/closeout audits and sqlite ":memory:" beforeEach hooks time out
    // at vitest's stock 5s/10s defaults ONLY under machine load (e.g. the
    // pre-commit hook's eslint->vitest back-to-back), never on assertion. The
    // budgets, not the assertions, were wrong — set for quieter hardware. A
    // generous global ceiling makes the suite load-tolerant in-hook; a genuinely
    // hung test still fails (just later). Per-test/file vi.setConfig overrides
    // from E-013/E-015 still apply where set. Assertions are unchanged.
    testTimeout: 120_000,
    // E-022 (R.2a): extend E-018's load-tolerance doctrine to the setup-HOOK ceiling.
    // E-018 raised testTimeout to 120s + single-worker but left hookTimeout at a
    // comparatively tight 30s. The sqlite ":memory:" beforeEach + whole-repo-scan setup
    // hooks are exactly what a cold-cache fresh clone (Phase 25D, the Mac's first run)
    // and the pre-commit eslint->vitest memory pressure stress hardest. 60s gives ~2x
    // headroom; a genuinely hung hook still fails, just later. Test budget only —
    // assertions, behavior, and the mutation-path count are unchanged.
    hookTimeout: 60_000,
    // E-018 (concurrency cap): the timeout ceilings alone did not make the suite
    // load-tolerant IN-HOOK. The pre-commit machine is MEMORY-STARVED (observed
    // ~0.7 GB free of 16 GB; 8 cores) — at the stock fork count a worker OOM-
    // CRASHED ("Worker exited unexpectedly"), and even half the cores left the
    // heavy whole-repo-scan audits + the big-PDF tool parse paging to swap until
    // they blew their (already generous) per-test budgets. The fix that holds
    // under memory pressure is MINIMUM FOOTPRINT: run the suite single-worker so
    // each test gets the full RAM/disk and finishes in ~its standalone time. The
    // gate is reliable (slower wall-clock, fine for a background pre-commit run);
    // a developer can override locally with `vitest --maxWorkers=N`. Test budgets
    // + concurrency only; assertions unchanged. (Vitest 4: maxWorkers is the
    // top-level option; poolOptions.forks was removed.)
    maxWorkers: 1,
  },
});
