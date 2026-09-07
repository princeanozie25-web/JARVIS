// Self Model (E-050) — REPOSITORY self-knowledge.
//
// Composes the Phase 19 architecture graph (what my subsystems are and how
// they connect) and the Enhancement Registry (which changes are APPLIED /
// PROPOSED / RETIRED). Both are documents: ARCHITECTURE_DOCS trust, below
// anything a probe or a registry object says.
import type {
  ArchitectureGraphEdge,
  ArchitectureGraphNode,
} from "../../architecture-graph/contracts";
import {
  claim,
  clip,
  evidence,
  type SelfClaim,
  type SelfClaimStatus,
} from "../contracts";
import { scrubText } from "../redaction";

export interface RepositorySourceInput {
  now: string;
  graph: {
    nodes: readonly ArchitectureGraphNode[];
    edges: readonly ArchitectureGraphEdge[];
  } | null;
  // Raw text of docs/enhancements/REGISTRY.md, or null when unavailable.
  registryMarkdown: string | null;
  registryRef?: string;
}

export interface EnhancementRow {
  id: string;
  title: string;
  status_label: string;
  status: SelfClaimStatus;
}

const APPLIED =
  /^(APPLIED|COMPLETE|COMPLETED|VERIFIED|APPROVED|CLOSED|CLOSED-PROVEN-BY-DRILL|RESOLVED|RESOLVED-NO-CHANGE|DONE)$/;
const PLANNED = /^(PROPOSED|PLANNED|OPEN|DEFERRED|PENDING)$/;
const RETIRED = /^(RETIRED|WITHDRAWN|REJECTED|SUPERSEDED|NON-CHANGE)$/;

export function mapEnhancementStatus(label: string): SelfClaimStatus {
  const head = label.trim().split(/[\s(]/)[0]?.toUpperCase() ?? "";
  if (APPLIED.test(head)) return "operational";
  if (PLANNED.test(head)) return "planned";
  if (RETIRED.test(head)) return "unsupported";
  if (/^EXPERIMENTAL|SPIKE|PROTOTYPE$/.test(head)) return "experimental";
  return "unknown";
}

/** Rows are `E-nnn | title | surface | justification | STATUS (...)`. */
export function parseEnhancementRows(markdown: string): EnhancementRow[] {
  const rows: EnhancementRow[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^(E-\d{3})\s*\|\s*([^|]+)\|/.exec(line);
    if (!m) continue;
    const cells = line.split("|").map((c) => c.trim());
    const last = cells[cells.length - 1] ?? "";
    const label = last.split(/[—-]\s/)[0]?.trim() || last;
    rows.push({
      id: m[1]!,
      title: clip(scrubText(m[2]!.trim()), 160),
      status_label: clip(label, 80),
      status: mapEnhancementStatus(label),
    });
  }
  return rows;
}

export function buildRepositoryClaims(
  input: RepositorySourceInput,
): SelfClaim[] {
  const now = input.now;
  const claims: SelfClaim[] = [];
  const registryRef = input.registryRef ?? "docs/enhancements/REGISTRY.md";

  if (input.graph) {
    const layers = new Map<string, number>();
    for (const n of input.graph.nodes)
      layers.set(n.layer, (layers.get(n.layer) ?? 0) + 1);
    const layerText = [...layers.entries()]
      .map(([l, c]) => `${l} ${c}`)
      .join(", ");
    claims.push(
      claim({
        claim_id: "self:repository.architecture",
        category: "repository",
        subject: "repository.architecture",
        statement: `My architecture graph (19A) records ${input.graph.nodes.length} subsystems across layers (${layerText}) and ${input.graph.edges.length} dependency edges. It is a static, read-only map; it does not observe the running process.`,
        status: "operational",
        trust_class: "architecture_docs",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence(
            "architecture_graph",
            "src/lib/architecture-graph/static-registry.ts",
            now,
          ),
        ],
      }),
    );
  } else {
    claims.push(
      claim({
        claim_id: "self:repository.architecture",
        category: "repository",
        subject: "repository.architecture",
        statement: "My architecture graph could not be loaded.",
        status: "unknown",
        trust_class: "architecture_docs",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence(
            "unavailable",
            "src/lib/architecture-graph/static-registry.ts",
            now,
          ),
        ],
      }),
    );
  }

  // No machine-readable record of the last test run exists (the pre-commit
  // hook runs vitest but writes no artifact) — say so rather than quote the
  // registry header's counts as if they were live.
  claims.push(
    claim({
      claim_id: "self:repository.test-suite",
      category: "repository",
      subject: "repository.test-suite",
      statement:
        "I have no machine-readable record of my last test run; the pre-commit hook runs the suite but persists no result. Test health is known to my operator, not to me.",
      status: "unknown",
      trust_class: "architecture_docs",
      observed_at: now,
      ttl_ms: null,
      evidence: [
        evidence(
          "unavailable",
          ".husky/pre-commit",
          now,
          "no test artifact is written",
        ),
      ],
    }),
  );

  if (input.registryMarkdown) {
    const rows = parseEnhancementRows(input.registryMarkdown);
    const counts = { operational: 0, planned: 0, unsupported: 0, other: 0 };
    for (const r of rows) {
      if (r.status === "operational") counts.operational += 1;
      else if (r.status === "planned") counts.planned += 1;
      else if (r.status === "unsupported") counts.unsupported += 1;
      else counts.other += 1;
    }
    claims.push(
      claim({
        claim_id: "self:repository.enhancements",
        category: "repository",
        subject: "repository.enhancements",
        statement: `The Enhancement Registry lists ${rows.length} entries: ${counts.operational} applied/complete, ${counts.planned} proposed/open, ${counts.unsupported} retired, ${counts.other} other. Every post-freeze change enters there before code.`,
        status: "operational",
        trust_class: "architecture_docs",
        observed_at: now,
        ttl_ms: null,
        evidence: [evidence("enhancement_registry", registryRef, now)],
      }),
    );
    for (const r of rows) {
      claims.push(
        claim({
          claim_id: `self:enhancement.${r.id.toLowerCase()}`,
          category: "enhancement",
          subject: `enhancement:${r.id}`,
          statement: `${r.id} — ${r.title} [${r.status_label}]`,
          status: r.status,
          trust_class: "architecture_docs",
          observed_at: now,
          ttl_ms: null,
          evidence: [
            evidence("enhancement_registry", `${registryRef}#${r.id}`, now),
          ],
        }),
      );
    }
  } else {
    claims.push(
      claim({
        claim_id: "self:repository.enhancements",
        category: "repository",
        subject: "repository.enhancements",
        statement: "The Enhancement Registry could not be read.",
        status: "unknown",
        trust_class: "architecture_docs",
        observed_at: now,
        ttl_ms: null,
        evidence: [evidence("unavailable", registryRef, now)],
      }),
    );
  }

  return claims;
}
