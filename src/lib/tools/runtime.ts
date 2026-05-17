import type { SafetyTag } from "../router";
import { ToolRegistry, tools } from "./registry";
import type { RunToolOptions, ToolResult, ToolRuntime } from "./types";

const safetyRank: Record<SafetyTag, number> = {
  ALLOW: 0,
  CONFIRM_ONCE: 1,
  CONFIRM_ALWAYS: 2,
  BLOCK: 3,
};

function hasSufficientSafety(actual: SafetyTag, required: SafetyTag): boolean {
  if (actual === "BLOCK") return false;
  return safetyRank[actual] >= safetyRank[required];
}

function denied(message: string, data?: unknown): ToolResult {
  return { ok: false, message, data };
}

function newExecutionId(): string {
  return globalThis.crypto.randomUUID();
}

export class InProcessToolRuntime implements ToolRuntime {
  constructor(private readonly registry: ToolRegistry = tools) {}

  async runTool(options: RunToolOptions): Promise<ToolResult> {
    const tool = this.registry.get(options.toolId);
    const parsed = tool.inputSchema.safeParse(options.input);

    if (!parsed.success) {
      return denied("Tool input failed validation.", {
        reason: "invalid_tool_input",
        issues: parsed.error.issues,
      });
    }

    if (
      !hasSufficientSafety(
        options.decision.safety.safetyTag,
        tool.requiredSafetyTag,
      )
    ) {
      return denied("Tool denied by safety policy.", {
        reason: "insufficient_safety",
        requiredSafetyTag: tool.requiredSafetyTag,
        actualSafetyTag: options.decision.safety.safetyTag,
      });
    }

    const controller = new AbortController();
    let abortReason: "aborted" | "timeout" = "aborted";

    const abortFromParent = () => {
      abortReason = "aborted";
      controller.abort(options.signal?.reason);
    };

    if (options.signal?.aborted) {
      return denied("Tool execution aborted.", { reason: "aborted" });
    } else {
      options.signal?.addEventListener("abort", abortFromParent, {
        once: true,
      });
    }

    const timeout = setTimeout(() => {
      abortReason = "timeout";
      controller.abort(new Error("Tool execution timed out."));
    }, tool.timeoutMs);

    const abortResult = new Promise<ToolResult>((resolve) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          resolve(
            denied(
              abortReason === "timeout"
                ? "Tool execution timed out."
                : "Tool execution aborted.",
              { reason: abortReason },
            ),
          );
        },
        { once: true },
      );
    });

    try {
      if (controller.signal.aborted) {
        return await abortResult;
      }

      return await Promise.race([
        tool.execute(parsed.data, {
          executionId: options.executionId ?? newExecutionId(),
          sessionId: options.sessionId,
          signal: controller.signal,
          timeoutMs: tool.timeoutMs,
          decision: options.decision,
        }),
        abortResult,
      ]);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromParent);
    }
  }
}

export const toolRuntime: ToolRuntime = new InProcessToolRuntime();
