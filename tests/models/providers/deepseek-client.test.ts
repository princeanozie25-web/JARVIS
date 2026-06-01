import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createDeepSeekClientError,
  createDeepSeekHttpClient,
  type DeepSeekFetchImpl,
} from "../../../src/models";

function completeRequest() {
  return {
    request_id: "deepseek-client-complete-1",
    model: "deepseek-v4-flash",
    messages: [{ role: "user" as const, content: "Do not print me" }],
    options: {
      temperature: 0,
      max_output_tokens: 16,
    },
    timeout_ms: 5_000,
    metadata_only: true as const,
  };
}

describe("DeepSeek OpenAI-compatible client", () => {
  it("constructs without fetch and posts exact configured V4 model ids when invoked", async () => {
    const calls: Array<{
      input: string;
      headers?: Record<string, string>;
      body: unknown;
    }> = [];
    const fetchImpl: DeepSeekFetchImpl = async (input, init) => {
      calls.push({
        input,
        headers: init?.headers,
        body: init?.body ? JSON.parse(init.body) : null,
      });
      return textResponse(
        JSON.stringify({
          model: "provider-side-name",
          choices: [{ message: { content: "OK" } }],
          usage: {
            prompt_tokens: 2,
            completion_tokens: 1,
            total_tokens: 3,
          },
        }),
      );
    };
    const client = createDeepSeekHttpClient({
      api_key: "test-deepseek-key",
      fetch_impl: fetchImpl,
      now: createClock(10, 25),
    });

    expect(calls).toEqual([]);
    await expect(client.complete(completeRequest())).resolves.toEqual({
      request_id: "deepseek-client-complete-1",
      model: "deepseek-v4-flash",
      output: "OK",
      latency_ms: 15,
      token_usage: {
        input_tokens: 2,
        output_tokens: 1,
        total_tokens: 3,
      },
      done: true,
      redaction_status: "metadata_only",
    });
    expect(calls).toEqual([
      {
        input: "https://api.deepseek.com/chat/completions",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-deepseek-key",
        },
        body: expect.objectContaining({
          model: "deepseek-v4-flash",
          stream: false,
          max_tokens: 16,
        }),
      },
    ]);
  });

  it("fails closed for missing keys, insecure base URLs, HTTP failures, aborts, and malformed JSON", async () => {
    expect(() => createDeepSeekHttpClient({ api_key: " " })).toThrow(
      "DEEPSEEK_API_KEY",
    );
    expect(() =>
      createDeepSeekHttpClient({
        api_key: "test-key",
        base_url: "http://api.deepseek.com",
      }),
    ).toThrow("https");

    await expect(
      createDeepSeekHttpClient({
        api_key: "test-key",
        fetch_impl: async () => textResponse("missing", 404),
      }).complete(completeRequest()),
    ).rejects.toMatchObject({
      failure_class: "model_missing",
      redaction_status: "metadata_only",
    });

    const abortController = new AbortController();
    abortController.abort();
    await expect(
      createDeepSeekHttpClient({
        api_key: "test-key",
        fetch_impl: async () => textResponse("{}"),
      }).complete({
        ...completeRequest(),
        abort_signal: abortController.signal,
      }),
    ).rejects.toMatchObject({ failure_class: "cancelled" });

    await expect(
      createDeepSeekHttpClient({
        api_key: "test-key",
        fetch_impl: async () => textResponse("{bad json"),
      }).complete(completeRequest()),
    ).rejects.toMatchObject({ failure_class: "provider_error" });
  });

  it("client errors are metadata-only and never include secrets", () => {
    const error = createDeepSeekClientError({
      request_id: "deepseek-error-1",
      model: "deepseek-v4-pro",
      failure_class: "timeout",
      message: "Timed out.",
    });

    expect(error).toEqual({
      request_id: "deepseek-error-1",
      model: "deepseek-v4-pro",
      failure_class: "timeout",
      message: "Timed out.",
      retryable: true,
      redaction_status: "metadata_only",
    });
    expect(JSON.stringify(error)).not.toContain("test-deepseek-key");
  });

  it("keeps network and env authority isolated to explicit transport inputs", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/providers/deepseek-client.ts"),
      "utf8",
    );

    expect(source).toContain("globalThis.fetch");
    expect(source).not.toMatch(/process\.env|import\.meta\.env/);
    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|node:http|node:https)["']/,
    );
    expect(source).not.toMatch(
      /writeFile|appendFile|createWriteStream|router\.|event-store|eventStore/i,
    );
  });
});

function textResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    text: async () => body,
  };
}

function createClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
