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
  session_id?: string;
  intent?: string;
  safety_tag?: string;
  tier?: string;
  model_id?: string;
  tool_name?: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  time_to_first_token_ms?: number;
  cost_usd?: number;
  error_class?: string;
  user_rating?: number;
  notes?: string;
}

export interface TelemetryStore {
  record(event: TelemetryEvent): void;
  list(limit?: number): TelemetryEvent[];
  reset(): void;
}
