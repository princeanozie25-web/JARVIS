import type { TelemetryEventType } from "../telemetry";
import type { RouterDecision } from "./types";

export interface RouterSafetyResponse {
  status: number;
  eventType: TelemetryEventType;
  body: {
    message: string;
    reason: "safety_blocked";
    intent: string;
    safetyTag: string;
    tier: string;
  };
}

export function enforceRouterSafety(
  decision: RouterDecision,
): RouterSafetyResponse | null {
  const base = {
    intent: decision.intent.intent,
    safetyTag: decision.safety.safetyTag,
    tier: decision.capability.tier,
  };

  if (decision.safety.safetyTag === "BLOCK") {
    return {
      status: 403,
      eventType: "safety_blocked",
      body: {
        ...base,
        message: "Request blocked by safety policy.",
        reason: "safety_blocked",
      },
    };
  }

  return null;
}
