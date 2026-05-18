export type TelemetryEventType =
  | "validation_failure"
  | "rate_limited"
  | "cost_denied"
  | "safety_blocked"
  | "confirmation_required"
  | "model_call"
  | "provider_error"
  | "client_disconnect"
  | "tool_proposed"
  | "tool_executed"
  | "tool_completed"
  | "tool_timeout"
  | "tool_cancelled"
  | "tool_denied"
  | "tool_approved"
  | "tool_rolled_back"
  | "memory_write"
  | "memory_read"
  | "memory_embedding_created"
  | "memory_vector_search"
  | "memory_surfaced"
  | "memory_forget"
  | "memory_distill_rejected"
  | "session_summary_saved"
  | "session_summary_generated"
  | "session_summary_triggered"
  | "session_summary_skipped"
  | "session_summary_failed"
  | "working_memory_assembled"
  | "context_budget_breach"
  | "project_state_saved"
  | "project_state_read"
  | "project_context_detected"
  | "memory_candidate_generated"
  | "memory_candidate_reviewed"
  | "memory_candidate_rejected";

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
  execution_id?: string;
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
