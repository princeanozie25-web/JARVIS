// Phase 25B / E-046 — the OPERATOR TOKEN STORE.
//
// The approvals table stores only token HASHES (frozen Phase 18). The plaintext
// approval token exists exactly once, at mint time, inside the server process
// that created the pending row, and today is handed only to the originating
// chat stream. To let the operator decide from ANY loopback surface (the
// cockpit's Gate rail) without touching the frozen lifecycle, the minting
// process remembers the token here — process-local memory, TTL-bound to the
// approval's own expiry, forgotten on decision. Nothing is written to disk;
// a restart simply makes still-pending rows undecidable from the operator
// surface until they expire (fail-closed, and equivalent to the chat client
// losing its browser state). No imports, so it can never form a cycle.

interface Remembered {
  readonly token: string;
  readonly expiresAt: number;
}

const remembered = new Map<string, Remembered>();

export function rememberOperatorToken(
  executionId: string,
  approvalToken: string,
  expiresAt: number,
): void {
  if (!executionId || !approvalToken) return;
  remembered.set(executionId, { token: approvalToken, expiresAt });
}

export function forgetOperatorToken(executionId: string): void {
  remembered.delete(executionId);
}

/** The minted token if still held and unexpired; null otherwise (and the
 *  expired entry is dropped). Read-only — deciding is what forgets it. */
export function peekOperatorToken(
  executionId: string,
  now: number = Date.now(),
): string | null {
  const entry = remembered.get(executionId);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    remembered.delete(executionId);
    return null;
  }
  return entry.token;
}

export function hasOperatorToken(
  executionId: string,
  now: number = Date.now(),
): boolean {
  return peekOperatorToken(executionId, now) !== null;
}

export function operatorTokenStoreSize(): number {
  return remembered.size;
}

/** Tests / restart simulation only. */
export function resetOperatorTokenStoreForTests(): void {
  remembered.clear();
}
