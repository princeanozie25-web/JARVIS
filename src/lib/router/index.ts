import type { ProviderId } from "../providers";
import type { Message } from "../types";
import { matchCapability } from "./capability";
import { classifyIntent } from "./intent";
import { classifySafety } from "./safety";
import { selectModel } from "./selection";
import type { RouterDecision } from "./types";

export interface RouteMessagesOptions {
  requestedProvider?: ProviderId;
}

export function routeMessages(
  messages: Message[],
  opts: RouteMessagesOptions = {},
): RouterDecision {
  const intent = classifyIntent(messages);
  const safety = classifySafety(messages);
  const capability = matchCapability(intent, safety);
  const selection = selectModel(capability, {
    requestedProvider: opts.requestedProvider,
  });

  return { intent, safety, capability, selection };
}

export { matchCapability } from "./capability";
export { classifyIntent } from "./intent";
export { classifySafety } from "./safety";
export { selectModel } from "./selection";
export type {
  CapabilityResult,
  IntentClass,
  IntentResult,
  ModelSelectionResult,
  RouterDecision,
  SafetyResult,
  SafetyTag,
} from "./types";
