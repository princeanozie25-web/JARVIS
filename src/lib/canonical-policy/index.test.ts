// Shared canonical-policy leaf — unit invariants (24D-2b, closes E-016).
//
// The leaf is the neutral home BOTH the gateway and the executor depend DOWN
// onto. These tests pin: (1) I-24D2b-1 PURITY — it imports nothing, so adding it
// to the gateway's transitive-import allowlist cannot widen the graph; (2) the
// moved derivation behaves identically to the gateway's prior local copy
// (extract-and-delegate, not a rewrite); (3) the EoP-13 classification stays
// default-deny; (4) I-24D2b-2 recheckFrozenEffectPolicy catches registry/policy
// drift fail-closed — the load-bearing decision-point control.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAPABILITY_CLASSIFICATION,
  approvalTierOf,
  classifyCapability,
  findUnclassifiedMutatingCapabilities,
  isCapabilityExposable,
  mutationTypeOf,
  recheckFrozenEffectPolicy,
  riskClassOf,
  summarizeTarget,
  type ClassificationLookup,
} from "./index";

const SELF = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "index.ts"),
  "utf8",
);
const codeOnly = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");

// ===========================================================================
// I-24D2b-1 — PURITY: the leaf imports nothing (safest possible allowlist leaf)
// ===========================================================================
describe("I-24D2b-1 (purity): the canonical-policy leaf imports nothing", () => {
  it("has zero module import edges", () => {
    const froms = [
      ...codeOnly(SELF).matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);
    expect(froms).toEqual([]);
  });

  it("names no mutator tree / gateway / executor in code (only in the doc header)", () => {
    const code = codeOnly(SELF);
    for (const denied of [
      "lib/db",
      "lib/tools",
      "lib/chat",
      "approval-runtime",
      "lib/router",
      "lib/mcp-gateway",
      "mcp-gateway",
    ]) {
      expect(code.includes(denied), `must not reference ${denied}`).toBe(false);
    }
  });
});

// ===========================================================================
// Moved derivation — behavior preserved verbatim from the gateway
// ===========================================================================
describe("derivation (moved from the gateway, behavior unchanged)", () => {
  it("mutationTypeOf maps each reversibility class", () => {
    expect(mutationTypeOf("NO_SIDE_EFFECT")).toBe("none");
    expect(mutationTypeOf("PURE_READ")).toBe("read");
    expect(mutationTypeOf("REVERSIBLE_WRITE")).toBe("reversible_write");
    expect(mutationTypeOf("IRREVERSIBLE")).toBe("irreversible_write");
  });

  it("riskClassOf escalates CONFIRM_ALWAYS and pins BLOCK to critical", () => {
    expect(riskClassOf("PURE_READ", "ALLOW")).toBe("low");
    expect(riskClassOf("REVERSIBLE_WRITE", "ALLOW")).toBe("medium");
    expect(riskClassOf("REVERSIBLE_WRITE", "CONFIRM_ALWAYS")).toBe("high");
    expect(riskClassOf("IRREVERSIBLE", "ALLOW")).toBe("high");
    expect(riskClassOf("REVERSIBLE_WRITE", "BLOCK")).toBe("critical");
  });

  it("approvalTierOf never weakens writes or irreversible actions", () => {
    expect(approvalTierOf("NO_SIDE_EFFECT", "ALLOW")).toBe("auto");
    expect(approvalTierOf("REVERSIBLE_WRITE", "ALLOW")).toBe("confirm_once");
    expect(approvalTierOf("REVERSIBLE_WRITE", "CONFIRM_ALWAYS")).toBe(
      "confirm_always",
    );
    expect(approvalTierOf("IRREVERSIBLE", "ALLOW")).toBe("confirm_always");
    expect(approvalTierOf("IRREVERSIBLE", "CONFIRM_ALWAYS")).toBe("elevated");
  });

  it("summarizeTarget masks paths and keeps only the scheme", () => {
    expect(summarizeTarget("/home/x/y.md")).toEqual({
      target: "filesystem:*.md",
      scopeCategory: "filesystem",
    });
    expect(summarizeTarget("C:\\a\\b.txt")).toEqual({
      target: "filesystem:*.txt",
      scopeCategory: "filesystem",
    });
    expect(summarizeTarget("memory:note:secret")).toEqual({
      target: "memory:<target>",
      scopeCategory: "memory",
    });
    expect(summarizeTarget("plainthing")).toEqual({
      target: "opaque:<target>",
      scopeCategory: "opaque",
    });
  });
});

// ===========================================================================
// EoP-13 classification — default-deny
// ===========================================================================
describe("EoP-13 classification (default-deny)", () => {
  it("memory.note + fs.create_file are the only exposable capabilities", () => {
    const exposable = Object.keys(CAPABILITY_CLASSIFICATION).filter((cap) =>
      isCapabilityExposable(cap),
    );
    expect(exposable.sort()).toEqual(["fs.create_file", "memory.note"]);
  });

  it("an unclassified capability is null + not exposable", () => {
    expect(classifyCapability("totally.unknown")).toBeNull();
    expect(isCapabilityExposable("totally.unknown")).toBe(false);
  });

  it("a classified-but-hidden capability is not exposable (fs.delete_file)", () => {
    expect(classifyCapability("fs.delete_file")).not.toBeNull();
    expect(isCapabilityExposable("fs.delete_file")).toBe(false);
  });

  it("findUnclassifiedMutatingCapabilities flags only the unknown ones", () => {
    expect(
      findUnclassifiedMutatingCapabilities(["memory.note", "x.unknown"]),
    ).toEqual(["x.unknown"]);
  });
});

// ===========================================================================
// I-24D2b-2 — recheckFrozenEffectPolicy: the decision-point drift re-check
// ===========================================================================
describe("I-24D2b-2 (recheckFrozenEffectPolicy): registry-drift re-check", () => {
  it("ok when the frozen capability is still exposable at the same tier", () => {
    expect(
      recheckFrozenEffectPolicy({
        capability: "memory.note",
        approval_tier: "confirm_once",
      }),
    ).toEqual({ ok: true });
    expect(
      recheckFrozenEffectPolicy({
        capability: "fs.create_file",
        approval_tier: "confirm_once",
      }),
    ).toEqual({ ok: true });
  });

  it("tool_declassified when the capability is unknown or not exposable", () => {
    expect(
      recheckFrozenEffectPolicy({
        capability: "mock.confirm",
        approval_tier: "confirm_once",
      }),
    ).toEqual({ ok: false, reason: "tool_declassified" });
    // fs.delete_file is classified but mcp_exposable:false — declassified for MCP
    expect(
      recheckFrozenEffectPolicy({
        capability: "fs.delete_file",
        approval_tier: "confirm_always",
      }),
    ).toEqual({ ok: false, reason: "tool_declassified" });
  });

  it("approval_policy_changed when the frozen tier no longer matches policy", () => {
    expect(
      recheckFrozenEffectPolicy({
        capability: "memory.note",
        approval_tier: "confirm_always", // policy requires confirm_once
      }),
    ).toEqual({ ok: false, reason: "approval_policy_changed" });
  });

  it("consults the INJECTED classify (drift simulation), not only the live map", () => {
    const classifyDrift: ClassificationLookup = () => null;
    expect(
      recheckFrozenEffectPolicy(
        { capability: "memory.note", approval_tier: "confirm_once" },
        classifyDrift,
      ),
    ).toEqual({ ok: false, reason: "tool_declassified" });
  });
});
