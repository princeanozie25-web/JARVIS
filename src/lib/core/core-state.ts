// Program U.3 (E-030) — the Core's six states, resolved by a PURE mapper.
//
// The Core is the Human Gate's face. Its one hard rule (brief A3): only a
// REAL row in the approval store may make it amber. Every input that is not
// a live, reachable read of that store resolves to a non-amber state, no
// matter what count it carries. Nothing here reads, writes, or executes.

export const CORE_STATES = [
  "idle",
  "listening",
  "working",
  "waiting",
  "blocked",
  "error",
] as const;

export type CoreState = (typeof CORE_STATES)[number];

/** Where the pending count came from. Only `live` may turn the Core amber. */
export type CorePresenceProvenance = "live" | "unreachable" | "demo";

export interface CorePresenceInput {
  /** Pending approvals as counted from the store (ignored unless live). */
  readonly pendingCount: number;
  readonly provenance: CorePresenceProvenance;
  /** `/freeze` (brief A6): every agent blocked, the Core holds amber, no pulse. */
  readonly frozen?: boolean;
  /** Push-to-talk is open and the E-011 layer is capturing. */
  readonly listening?: boolean;
  /** At least one agent reports a working state. */
  readonly working?: boolean;
}

export interface CorePresence {
  readonly state: CoreState;
  /** The one line under the ring. Never a raw count from a non-live source. */
  readonly statusLine: string;
  /** Live pending count; 0 unless provenance is live. */
  readonly count: number;
  readonly provenance: CorePresenceProvenance;
  /** True only for the two amber states (waiting, blocked). */
  readonly amber: boolean;
  readonly metadata_only: true;
}

const AMBER_STATES: ReadonlySet<CoreState> = new Set(["waiting", "blocked"]);

export function resolveCoreState(input: CorePresenceInput): CorePresence {
  const liveCount =
    input.provenance === "live" &&
    Number.isFinite(input.pendingCount) &&
    input.pendingCount > 0
      ? Math.floor(input.pendingCount)
      : 0;

  let state: CoreState;
  if (input.provenance === "unreachable") {
    state = "error";
  } else if (input.frozen) {
    state = "blocked";
  } else if (liveCount > 0) {
    state = "waiting";
  } else if (input.listening) {
    state = "listening";
  } else if (input.working) {
    state = "working";
  } else {
    state = "idle";
  }

  return {
    state,
    statusLine: statusLineFor(state, liveCount, input.provenance),
    count: liveCount,
    provenance: input.provenance,
    amber: AMBER_STATES.has(state),
    metadata_only: true,
  };
}

function statusLineFor(
  state: CoreState,
  count: number,
  provenance: CorePresenceProvenance,
): string {
  switch (state) {
    case "waiting":
      return count === 1 ? "1 proposal waiting" : `${count} proposals waiting`;
    case "blocked":
      return "Frozen — every agent is held";
    case "error":
      return "Cannot reach the approval store";
    case "listening":
      return "Listening";
    case "working":
      return "Agents working";
    case "idle":
      return provenance === "demo"
        ? "Nothing waiting · demo"
        : "Nothing waiting";
  }
}

export function isCoreState(value: unknown): value is CoreState {
  return (
    typeof value === "string" &&
    (CORE_STATES as readonly string[]).includes(value)
  );
}
