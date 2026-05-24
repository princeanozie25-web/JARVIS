import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type {
  ModelCapability,
  ModelProviderKind,
} from "../../../../src/models/types";
import type {
  ModelProvider,
  ModelProviderFailureClass,
  ModelProviderRequest,
  ModelProviderStreamEvent,
} from "../../../../src/models/providers/contract";

type RequiredFailureClass = Extract<
  ModelProviderFailureClass,
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "invalid_request"
  | "model_missing"
  | "provider_error"
>;

interface ProviderConformanceCase {
  readonly provider: ModelProvider;
  readonly request: ModelProviderRequest;
}

export interface ModelProviderConformanceOptions {
  readonly suiteName: string;
  readonly expected: {
    readonly id: string;
    readonly kind: ModelProviderKind;
    readonly runtime_class: "local" | "cloud" | "mock";
    readonly capabilities: readonly ModelCapability[];
  };
  readonly createProvider: () => ModelProvider;
  readonly createRequest: (
    overrides?: Partial<ModelProviderRequest>,
  ) => ModelProviderRequest;
  readonly createFailureProvider: (
    failureClass: RequiredFailureClass,
  ) => ModelProvider;
  readonly createInvalidRequestCase: () => ProviderConformanceCase;
  readonly createModelMissingCase: () => ProviderConformanceCase;
  readonly createTimeoutCase: () => ProviderConformanceCase;
  readonly sourceFiles: readonly string[];
}

export function describeModelProviderConformance(
  options: ModelProviderConformanceOptions,
) {
  describe(`${options.suiteName} model provider conformance`, () => {
    describe("provider metadata", () => {
      it("exposes stable id, kind, runtime class, and capabilities", () => {
        const provider = options.createProvider();

        expect(provider.id).toBe(options.expected.id);
        expect(provider.kind).toBe(options.expected.kind);
        expect(provider.runtime_class).toBe(options.expected.runtime_class);
        expect(provider.capabilities).toEqual(options.expected.capabilities);
      });

      it("exposes metadata-only provider metadata", () => {
        const provider = options.createProvider();

        expect(provider.metadata).toMatchObject({
          provider_id: options.expected.id,
          runtime_class: options.expected.runtime_class,
          supported_capabilities: options.expected.capabilities,
          implementation_enabled: false,
          network_access_enabled: false,
          telemetry_persistence_enabled: false,
        });
        expect(containsForbiddenTelemetryKey(provider.metadata)).toBe(false);
      });
    });

    describe("health", () => {
      it("returns metadata-only status", async () => {
        const provider = options.createProvider();
        const health = await provider.health();

        expect(health).toMatchObject({
          provider_id: options.expected.id,
          runtime_class: options.expected.runtime_class,
          ok: expect.any(Boolean),
          available_models: expect.any(Array),
          checked_at: expect.any(Number),
          degraded: expect.any(Boolean),
        });
        expect(containsForbiddenTelemetryKey(health)).toBe(false);
      });

      it("returns defensive-copy safe available_models", async () => {
        const provider = options.createProvider();
        const firstHealth = await provider.health();
        (firstHealth.available_models as string[]).push(
          "conformance-mutated-model",
        );

        expect((await provider.health()).available_models).not.toContain(
          "conformance-mutated-model",
        );
      });

      it("represents degraded error states without throwing unless configured", async () => {
        const provider = options.createFailureProvider("unavailable");
        const health = await provider.health();

        expect(health).toMatchObject({
          provider_id: options.expected.id,
          ok: false,
          degraded: true,
          error_class: "unavailable",
        });
        expect(containsForbiddenTelemetryKey(health)).toBe(false);
      });
    });

    describe("complete", () => {
      it("returns request, model, and provider identifiers", async () => {
        const provider = options.createProvider();
        const request = options.createRequest();
        const response = await provider.complete(request);

        expect(response).toMatchObject({
          request_id: request.request_id,
          model_id: request.model_id,
          provider_id: provider.id,
        });
      });

      it("returns numeric token usage, finish reason, and redaction status", async () => {
        const provider = options.createProvider();
        const response = await provider.complete(options.createRequest());

        expect(response.token_usage).toEqual({
          input_tokens: expect.any(Number),
          output_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        });
        expect(response.finish_reason).toEqual(expect.any(String));
        expect(response.redaction_status).toEqual(expect.any(String));
        expect(containsForbiddenTelemetryKey(response.token_usage)).toBe(false);
      });

      it("honors invalid_request failure", async () => {
        await expectFailure(
          options.createInvalidRequestCase(),
          "invalid_request",
        );
      });

      it("honors model_missing failure", async () => {
        await expectFailure(options.createModelMissingCase(), "model_missing");
      });

      it("honors provider unavailable failure", async () => {
        await expectFailure(
          {
            provider: options.createFailureProvider("unavailable"),
            request: options.createRequest(),
          },
          "unavailable",
        );
      });

      it("honors timeout_ms", async () => {
        await expectFailure(options.createTimeoutCase(), "timeout");
      });

      it("honors abort_signal cancellation", async () => {
        const abortController = new AbortController();
        abortController.abort();
        await expectFailure(
          {
            provider: options.createProvider(),
            request: options.createRequest({
              abort_signal: abortController.signal,
            }),
          },
          "cancelled",
        );
      });
    });

    describe("stream", () => {
      it("returns an AsyncIterable of ModelProviderStreamEvent", () => {
        const provider = options.createProvider();
        const events = provider.stream(options.createRequest());

        expect(typeof events[Symbol.asyncIterator]).toBe("function");
      });

      it("emits deterministic token events and a final done event", async () => {
        const provider = options.createProvider();
        const first = await collect(provider.stream(options.createRequest()));
        const second = await collect(provider.stream(options.createRequest()));

        expect(first).toEqual(second);
        expect(first.some((event) => event.type === "token")).toBe(true);
        expect(first.at(-1)).toMatchObject({
          type: "done",
          response: {
            provider_id: provider.id,
            redaction_status: expect.any(String),
          },
        });
      });

      it("supports error events", async () => {
        const events = await collect(
          options
            .createFailureProvider("provider_error")
            .stream(options.createRequest()),
        );

        expect(events).toEqual([
          expect.objectContaining({
            type: "error",
            error: expect.objectContaining({
              failure_class: "provider_error",
              redaction_status: expect.any(String),
            }),
          }),
        ]);
      });

      it("supports cancelled events", async () => {
        const timeoutCase = options.createTimeoutCase();
        const events = await collect(
          timeoutCase.provider.stream(timeoutCase.request),
        );

        expect(events).toEqual([
          expect.objectContaining({
            type: "cancelled",
            error_class: "timeout",
          }),
        ]);
      });

      it("honors abort_signal cancellation", async () => {
        const abortController = new AbortController();
        abortController.abort();
        const events = await collect(
          options.createProvider().stream(
            options.createRequest({
              abort_signal: abortController.signal,
            }),
          ),
        );

        expect(events).toEqual([
          expect.objectContaining({
            type: "cancelled",
            reason: "abort_signal",
            error_class: "cancelled",
          }),
        ]);
      });

      it("does not emit raw telemetry fields", async () => {
        const events = await collect(
          options.createProvider().stream(options.createRequest()),
        );

        expect(
          events.some((event) => containsForbiddenTelemetryKey(event)),
        ).toBe(false);
      });
    });

    describe("governance", () => {
      it("does not require network, filesystem, telemetry writes, router mutation, or runtime orchestration", () => {
        const source = options.sourceFiles
          .map((path) => readFileSync(path, "utf8"))
          .join("\n");

        expect(source).not.toMatch(
          /from\s+["'](?:openai|@anthropic-ai\/sdk|ollama|node:http|node:https|node:fs|node:fs\/promises)["']/,
        );
        expect(source).not.toMatch(
          /fetch\(|WebSocket|EventSource|process\.env/,
        );
        expect(source).not.toMatch(/router|event-store|eventStore/i);
        expect(source).not.toMatch(
          /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
        );
        expect(source).not.toMatch(/document\.|window\.|React|tsx/i);
        expect(source).not.toMatch(
          /orchestrat|install|download|probe|healthCheck/i,
        );
      });
    });
  });
}

async function expectFailure(
  testCase: ProviderConformanceCase,
  failureClass: RequiredFailureClass,
) {
  await expect(
    testCase.provider.complete(testCase.request),
  ).rejects.toMatchObject({
    failure_class: failureClass,
    degraded: true,
    redaction_status: expect.any(String),
  });
}

async function collect(
  events: AsyncIterable<ModelProviderStreamEvent>,
): Promise<ModelProviderStreamEvent[]> {
  const collected: ModelProviderStreamEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

function containsForbiddenTelemetryKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    if (
      /raw|raw_prompt|prompt_telemetry|raw_payload|telemetry_payload|stored_prompt|transcript/i.test(
        key,
      )
    ) {
      return true;
    }
    return containsForbiddenTelemetryKey(child);
  });
}
