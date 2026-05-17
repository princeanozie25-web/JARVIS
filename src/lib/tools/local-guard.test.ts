import { describe, expect, it } from "vitest";
import { InProcessToolRuntime } from "./runtime";
import {
  checkToolsRuntimeGuard,
  isLoopbackHost,
  parseToolsEnabled,
} from "./local-guard";

describe("tools local runtime guard", () => {
  it("parses the tools-enabled env flag", () => {
    expect(parseToolsEnabled("true")).toBe(true);
    expect(parseToolsEnabled("1")).toBe(true);
    expect(parseToolsEnabled("yes")).toBe(true);
    expect(parseToolsEnabled("false")).toBe(false);
    expect(parseToolsEnabled(undefined)).toBe(false);
  });

  it("recognizes loopback hosts", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("api.localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.10.20.30")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
  });

  it("rejects non-loopback hosts only when tools are enabled", () => {
    expect(
      checkToolsRuntimeGuard({
        toolsEnabled: false,
        bindHost: "0.0.0.0",
      }),
    ).toMatchObject({ ok: true });

    expect(
      checkToolsRuntimeGuard({
        toolsEnabled: true,
        bindHost: "0.0.0.0",
      }),
    ).toMatchObject({ ok: false, reason: "non_loopback_bind" });
  });

  it("prevents in-process runtime creation on non-local tools-enabled binds", () => {
    expect(
      () =>
        new InProcessToolRuntime(undefined, {
          toolsEnabled: true,
          bindHost: "0.0.0.0",
        }),
    ).toThrow("JARVIS tools require a loopback/local-only bind");
  });
});
