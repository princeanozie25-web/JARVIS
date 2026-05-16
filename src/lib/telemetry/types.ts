export type TelemetryEventType =
  | "validation_failure"
  | "rate_limited"
  | "cost_denied"
  | "model_call"
  | "provider_error"
  | "client_disconnect";

export interface TelemetryEvent {
  timestamp: number;
  event_type: TelemetryEventType;
  success: boolean;
  model_id?: string;
  latency_ms?: number;
  time_to_first_token_ms?: number;
  cost_usd?: number;
  error_class?: string;
  notes?: string;
}

export interface TelemetryStore {
  record(event: TelemetryEvent): void;
  list(limit?: number): TelemetryEvent[];
  reset(): void;
}
