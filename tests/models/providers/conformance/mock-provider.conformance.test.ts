import { join } from "node:path";

import type { ModelProviderRequest } from "../../../../src/models/providers/contract";
import {
  MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
  createMockModelProvider,
  type MockModelProviderFailureMode,
} from "../../../../src/models/providers/mock-provider";
import { describeModelProviderConformance } from "./provider-conformance";

function request(
  overrides: Partial<ModelProviderRequest> = {},
): ModelProviderRequest {
  return {
    request_id: "conformance-request-1",
    model_id: "mock-local-model",
    capability: "chat",
    input: {
      kind: "messages",
      messages: [{ role: "user", content: "Conformance check" }],
    },
    options: {
      temperature: 0,
      max_output_tokens: 64,
    },
    timeout_ms: 5_000,
    provenance: {
      request_origin: "model_runtime",
      source_phase: "13A.2",
      metadata_only: true,
      correlation_id: "conformance-correlation-1",
      requested_at_ms: 0,
      caller: "test_harness",
    },
    ...overrides,
  };
}

describeModelProviderConformance({
  suiteName: "mock",
  expected: {
    id: "mock",
    kind: "mock",
    runtime_class: "mock",
    capabilities: MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
  },
  createProvider: () => createMockModelProvider(),
  createRequest: request,
  createFailureProvider: (failureClass) =>
    createMockModelProvider({
      failureMode: failureClass as MockModelProviderFailureMode,
    }),
  createInvalidRequestCase: () => ({
    provider: createMockModelProvider(),
    request: request({ capability: "vision" }),
  }),
  createModelMissingCase: () => ({
    provider: createMockModelProvider(),
    request: request({ model_id: "missing-model" }),
  }),
  createTimeoutCase: () => ({
    provider: createMockModelProvider({ latencyMs: 50 }),
    request: request({ timeout_ms: 10 }),
  }),
  sourceFiles: [join(process.cwd(), "src/models/providers/mock-provider.ts")],
});
