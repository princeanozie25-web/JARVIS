import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureVaultScaffold,
  VAULT_SCAFFOLD_DIRS,
  vaultRootFromEnv,
} from "./vault";

let vaultRoot: string | undefined;

afterEach(() => {
  if (vaultRoot) {
    rmSync(vaultRoot, { recursive: true, force: true });
    vaultRoot = undefined;
  }
});

describe("Obsidian vault foundation", () => {
  it("defaults to ~/jarvis-vault when JARVIS_OBSIDIAN_VAULT_ROOT is unset", () => {
    expect(vaultRootFromEnv({} as NodeJS.ProcessEnv)).toMatch(/jarvis-vault$/);
  });

  it("creates the Phase 3A scaffold safely", async () => {
    vaultRoot = mkdtempSync(join(tmpdir(), "jarvis-vault-test-"));

    await expect(ensureVaultScaffold(vaultRoot)).resolves.toBe(vaultRoot);

    for (const dir of VAULT_SCAFFOLD_DIRS) {
      expect(existsSync(join(vaultRoot, dir))).toBe(true);
    }
  });
});
