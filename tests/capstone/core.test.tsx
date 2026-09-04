// E-030 — Program U.3 the Core. Invariants:
//  I-U3-1 amber law: only a live store read with count > 0 makes waiting;
//         demo/unreachable never do, whatever count they carry.
//  I-U3-2 six states, each reachable, each with a status line.
//  I-U3-3 the Core carries zero interactive affordances and no authority.
//  I-U3-4 the core tree imports no mutator (approvals module, runtime
//         commands, gateway, server actions); runtime.runTool still = 2.
//  I-U3-5 the TS palette mirror matches tokens.css byte-for-byte.
//  I-U3-6 the /cc page renders the Core from an injected store read.

import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Core } from "@/components/core/Core";
import {
  CORE_STATES,
  readPendingApprovalCount,
  resolveCoreState,
} from "@/lib/core";
import { loadCorePresence } from "@/app/cc/core-presence";
import {
  CAPSTONE_TOKEN_NAMES,
  capstonePalette,
} from "@/lib/design-tokens/capstone";
import { applyMigrations } from "@/lib/db/schema";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      out.push(full);
  }
  return out;
}

function coreSources() {
  return [
    ...walk(resolve(repoRoot, "src/lib/core")),
    ...walk(resolve(repoRoot, "src/components/core")),
    ...walk(resolve(repoRoot, "src/app/cc")),
    resolve(repoRoot, "app/cc/page.tsx"),
  ].map((file) => ({ file, text: readFileSync(file, "utf8") }));
}

describe("I-U3-1 amber law", () => {
  it("a live count > 0 is the ONLY way to waiting", () => {
    expect(
      resolveCoreState({ pendingCount: 1, provenance: "live" }),
    ).toMatchObject({
      state: "waiting",
      amber: true,
      count: 1,
      statusLine: "1 proposal waiting",
    });
    expect(
      resolveCoreState({ pendingCount: 3, provenance: "live" }).statusLine,
    ).toBe("3 proposals waiting");
  });

  it("demo and unreachable never turn amber, whatever count they carry", () => {
    const demo = resolveCoreState({ pendingCount: 99, provenance: "demo" });
    expect(demo.state).toBe("idle");
    expect(demo.amber).toBe(false);
    expect(demo.count).toBe(0);
    expect(demo.statusLine).toBe("Nothing waiting · demo");

    const down = resolveCoreState({
      pendingCount: 99,
      provenance: "unreachable",
    });
    expect(down.state).toBe("error");
    expect(down.amber).toBe(false);
    expect(down.count).toBe(0);
    expect(down.statusLine).toBe("Cannot reach the approval store");
  });

  it("frozen holds amber without a count; unreachable outranks frozen (fail closed, honestly)", () => {
    expect(
      resolveCoreState({ pendingCount: 0, provenance: "live", frozen: true }),
    ).toMatchObject({
      state: "blocked",
      amber: true,
      count: 0,
    });
    expect(
      resolveCoreState({
        pendingCount: 0,
        provenance: "unreachable",
        frozen: true,
      }).state,
    ).toBe("error");
  });

  it("garbage counts never leak: NaN, negatives and fractions resolve to 0", () => {
    for (const bad of [Number.NaN, -4, Number.POSITIVE_INFINITY]) {
      expect(
        resolveCoreState({ pendingCount: bad, provenance: "live" }).count,
      ).toBe(0);
    }
    expect(
      resolveCoreState({ pendingCount: 2.9, provenance: "live" }).count,
    ).toBe(2);
  });
});

describe("I-U3-2 six states", () => {
  it("every state is reachable and carries a status line", () => {
    const reached = new Set([
      resolveCoreState({ pendingCount: 0, provenance: "live" }).state,
      resolveCoreState({ pendingCount: 0, provenance: "live", listening: true })
        .state,
      resolveCoreState({ pendingCount: 0, provenance: "live", working: true })
        .state,
      resolveCoreState({ pendingCount: 1, provenance: "live" }).state,
      resolveCoreState({ pendingCount: 0, provenance: "live", frozen: true })
        .state,
      resolveCoreState({ pendingCount: 0, provenance: "unreachable" }).state,
    ]);
    expect([...reached].sort()).toEqual([...CORE_STATES].sort());
    for (const state of CORE_STATES) {
      const html = renderToStaticMarkup(
        <Core
          presence={{
            state,
            statusLine: "x",
            count: 0,
            provenance: "live",
            amber: false,
            metadata_only: true,
          }}
        />,
      );
      expect(html).toContain(`data-core-state="${state}"`);
      expect(html).toContain(`data-core-ring-state="${state}"`);
    }
  });

  it("listening and working yield to a live waiting count", () => {
    expect(
      resolveCoreState({
        pendingCount: 2,
        provenance: "live",
        listening: true,
        working: true,
      }).state,
    ).toBe("waiting");
  });
});

describe("I-U3-3 zero affordances, zero authority", () => {
  it("renders the reactor, the status line and no controls — and no wordmark", () => {
    const html = renderToStaticMarkup(
      <Core
        presence={resolveCoreState({ pendingCount: 1, provenance: "live" })}
      />,
    );
    expect(html).toContain('data-capstone-theme="night"');
    // v3.2 amendment: no wordmark behind the Core
    expect(html).not.toContain("data-core-wordmark");
    expect(html).toContain('data-core-status-line="true"');
    expect(html).toContain('data-core-count-badge="true"');
    expect(html).toContain('data-core-authority="none"');
    expect(html).toContain('data-core-amber="true"');
    expect(html).not.toMatch(
      /<button\b|<form\b|<input\b|<a\b|onClick|onSubmit/i,
    );
    expect(html).not.toMatch(/\brole="button"/i);
    // reduced-motion / SSR path renders the static SVG ring, never blank
    expect(html).toContain(
      'data-core-ring-fallback="reduced-motion-or-webgl-unavailable"',
    );
  });

  it("never names a model on the home surface", () => {
    const html = renderToStaticMarkup(
      <Core
        presence={resolveCoreState({ pendingCount: 0, provenance: "live" })}
      />,
    );
    expect(html).not.toMatch(/gpt|claude|gemini|deepseek|llama|qwen/i);
  });
});

describe("I-U3-4 no mutator path", () => {
  it("runtime.runTool production call-site count is UNCHANGED at exactly 2", () => {
    const files = walk(resolve(repoRoot, "src", "lib"));
    const sites: string[] = [];
    for (const file of files) {
      const matches = readFileSync(file, "utf8").match(/\.runTool\s*\(/g);
      if (matches) for (let i = 0; i < matches.length; i++) sites.push(file);
    }
    expect(sites.length, sites.join(", ")).toBe(2);
    expect(sites.every((s) => s.split(/[\\/]/).includes("chat"))).toBe(true);
  });

  it("the core tree imports no approvals module, runtime commands, gateway or server actions", () => {
    for (const { file, text } of coreSources()) {
      expect(text, file).not.toMatch(/\.runTool\s*\(/);
      expect(text, file).not.toContain('"use server"');
      expect(text, file).not.toMatch(/from "[^"]*\/approvals"/);
      expect(text, file).not.toMatch(/from "[^"]*mcp-gateway/);
      expect(text, file).not.toMatch(/from "[^"]*runtime-commands/);
      expect(text, file).not.toMatch(/from "[^"]*workflowbox-actions/);
      expect(text, file).not.toMatch(
        /approveApproval|denyApproval|consumeApproval|expirePendingApprovals|resumeApproval/,
      );
      expect(text, file).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    }
  });

  it("the pending read is a single unexpired COUNT and cannot mutate", () => {
    const db = new Database(":memory:");
    applyMigrations(db);
    expect(readPendingApprovalCount(db, 10_000)).toEqual({
      pendingCount: 0,
      provenance: "live",
    });
    db.prepare(
      `INSERT INTO approvals (id, execution_id, session_id, tool_id, scope_hash, state, decision, decided_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("a1", "e1", "s1", "fs.write", "h", "pending", "PENDING", 0, 20_000);
    db.prepare(
      `INSERT INTO approvals (id, execution_id, session_id, tool_id, scope_hash, state, decision, decided_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("a2", "e2", "s1", "fs.write", "h", "pending", "PENDING", 0, 5_000);
    expect(readPendingApprovalCount(db, 10_000).pendingCount).toBe(1);
    // the read left the expired row untouched — no silent expiry from a read surface
    expect(
      (
        db.prepare("SELECT state FROM approvals WHERE id = 'a2'").get() as {
          state: string;
        }
      ).state,
    ).toBe("pending");
    db.close();
  });

  it("an unreachable store is reported, never guessed", () => {
    const db = new Database(":memory:"); // no migrations: no approvals table
    expect(readPendingApprovalCount(db)).toEqual({
      pendingCount: 0,
      provenance: "unreachable",
    });
    expect(loadCorePresence(db).state).toBe("error");
    db.close();
  });
});

describe("I-U3-5 palette mirror", () => {
  it("capstone.ts matches tokens.css for every capstone colour", () => {
    const tokens = read("src/lib/design-tokens/tokens.css");
    for (const key of Object.keys(
      capstonePalette,
    ) as (keyof typeof capstonePalette)[]) {
      const name = CAPSTONE_TOKEN_NAMES[key];
      expect(tokens, name).toMatch(
        new RegExp(`${name}:\\s*${capstonePalette[key]};`),
      );
    }
  });
});

describe("I-U3-6 the /cc route", () => {
  it("renders the Core from an injected live store and turns amber only on a real pending row", () => {
    const db = new Database(":memory:");
    applyMigrations(db);
    expect(loadCorePresence(db)).toMatchObject({
      state: "idle",
      amber: false,
      provenance: "live",
    });
    db.prepare(
      `INSERT INTO approvals (id, execution_id, session_id, tool_id, scope_hash, state, decision, decided_at, expires_at)
       VALUES ('p1', 'x1', 's', 'fs.write', 'h', 'pending', 'PENDING', 0, NULL)`,
    ).run();
    const presence = loadCorePresence(db);
    expect(presence).toMatchObject({ state: "waiting", amber: true, count: 1 });
    const html = renderToStaticMarkup(<Core presence={presence} />);
    expect(html).toContain('data-core-amber="true"');
    expect(html).toContain("1 proposal waiting");
    db.close();
  });

  it("declares force-dynamic in the route file", () => {
    expect(read("app/cc/page.tsx")).toContain(
      'export const dynamic = "force-dynamic"',
    );
  });
});
