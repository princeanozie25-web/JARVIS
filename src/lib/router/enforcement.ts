import type { TelemetryEventType } from "../telemetry";
import type { RouterDecision } from "./types";

export interface RouterSafetyResponse {
  status: number;
  eventType: TelemetryEventType;
  body: {
    message: string;
    reason: "safety_blocked" | "confirmation_required";
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

  if (
    decision.safety.safetyTag === "CONFIRM_ONCE" ||
    decision.safety.safetyTag === "CONFIRM_ALWAYS"
  ) {
    return {
      status: 409,
      eventType: "confirmation_required",
      body: {
        ...base,
        message: "Confirmation is required before this request can continue.",
        reason: "confirmation_required",
      },
    };
  }

  return null;
}
