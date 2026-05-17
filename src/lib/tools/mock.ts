import { z } from "zod";
import type { Tool } from "./types";

export interface StatusToolInput {
  echo?: string;
}

export const StatusToolInputSchema = z.object({
  echo: z.string().max(200).optional(),
});

export const statusTool: Tool<StatusToolInput> = {
  id: "mock.status",
  name: "Mock Status",
  description: "No-op mock tool used to prove the tool registry path.",
  requiredSafetyTag: "ALLOW",
  inputSchema: StatusToolInputSchema,
  scopeOf() {
    return "mock.status";
  },
  reversibilityClass: "NO_SIDE_EFFECT",
  timeoutMs: 1000,
  async execute(input, context) {
    return {
      ok: true,
      message: "Mock tool registry is online.",
      data: {
        echo: input.echo ?? null,
        executionId: context.executionId,
        sessionId: context.sessionId,
      },
    };
  },
};
