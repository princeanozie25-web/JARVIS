import type { EventStore } from "../store/event-store";
import {
  ModelCallEventError,
  ModelCallEventSchema,
  type ModelCallEvent,
} from "./model-call-event";

export class ModelCallStoreBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelCallStoreBridgeError";
  }
}

export interface ModelCallEventPersistenceResult {
  readonly appended: true;
  readonly event_id: string;
  readonly model_call_id: string;
  readonly request_id: string;
  readonly execution_id: string;
  readonly selected_model_id: string | null;
  readonly selected_provider: string | null;
  readonly metadata_only: true;
  readonly raw_payload_written: false;
  readonly prompt_payload_retained: false;
  readonly cloud_call: false;
  readonly local_only: true;
}

export function appendModelCallEvent(
  store: Pick<EventStore, "appendModelCall">,
  event: unknown,
): ModelCallEventPersistenceResult {
  const parsed = ModelCallEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ModelCallStoreBridgeError(
      "Model call store bridge rejected malformed event metadata.",
    );
  }

  const safeEvent = clone(parsed.data);
  validateBridgeEvent(safeEvent);
  const metadataJson = JSON.stringify(safeEvent);
  assertSafeMetadataJson(metadataJson);

  try {
    store.appendModelCall({
      eventId: safeEvent.event_id,
      eventType: "model.call",
      occurredAtMs: safeEvent.created_at,
      source: "model_call_event_bridge",
      aggregateId: safeEvent.execution_id,
      metadataJson,
      modelCallId: modelCallIdFor(safeEvent),
      providerId: safeEvent.selected_provider ?? "unresolved-provider",
      modelId: safeEvent.selected_model_id ?? "unresolved-model",
    });
  } catch (error) {
    if (error instanceof ModelCallEventError) throw error;
    throw new ModelCallStoreBridgeError(
      error instanceof Error
        ? `Model call store bridge append failed closed: ${error.message}`
        : "Model call store bridge append failed closed.",
    );
  }

  return clone({
    appended: true,
    event_id: safeEvent.event_id,
    model_call_id: modelCallIdFor(safeEvent),
    request_id: safeEvent.request_id,
    execution_id: safeEvent.execution_id,
    selected_model_id: safeEvent.selected_model_id,
    selected_provider: safeEvent.selected_provider,
    metadata_only: true,
    raw_payload_written: false,
    prompt_payload_retained: false,
    cloud_call: false,
    local_only: true,
  });
}

function validateBridgeEvent(event: ModelCallEvent) {
  if (event.redaction_status !== "metadata_only") {
    throw new ModelCallStoreBridgeError(
      "Model call store bridge requires metadata-only events.",
    );
  }

  if (event.runtime_class === "cloud") {
    throw new ModelCallStoreBridgeError(
      "Model call store bridge rejected cloud runtime event metadata.",
    );
  }
}

function assertSafeMetadataJson(metadataJson: string) {
  if (UNSAFE_METADATA_PATTERN.test(metadataJson)) {
    throw new ModelCallStoreBridgeError(
      "Model call store bridge rejected unsafe event metadata.",
    );
  }
}

function modelCallIdFor(event: ModelCallEvent): string {
  return `model-call:${event.event_id}`;
}

const UNSAFE_METADATA_PATTERN =
  /raw[_-]?(?:prompt|response|output|stream|payload)|stream[_-]?tokens|provider[_-]?payload|http[_-]?(?:request|response)[_-]?body|request[_-]?body|response[_-]?body|sk-[a-z0-9_-]+|api[_-]?key|secret|password|process\.env|import\.meta\.env/i;

function clone<T>(value: T): T {
  return structuredClone(value);
}
