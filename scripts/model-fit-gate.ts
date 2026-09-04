// Phase 25D fit gate (E-035): measures ONE local Ollama model on THIS machine
// and prints a metadata-only table. Not the 28A benchmark — a go/no-go:
// load time, resident RAM, decode tok/s, first-token latency at a ~2K-token
// prompt, one structured tool call, one JSON-mode reply.
// Usage: tsx scripts/model-fit-gate.ts <model-tag> [base-url]
// Reads nothing from the repo, writes nothing, touches only the loopback
// Ollama endpoint. No prompts/bodies are persisted.

const model = process.argv[2];
const base =
  process.argv[3] ??
  process.env.JARVIS_OLLAMA_BASE_URL ??
  "http://127.0.0.1:11434";
if (!model) {
  console.error("usage: tsx scripts/model-fit-gate.ts <model-tag> [base-url]");
  process.exit(2);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

function ms(n: number): string {
  return `${Math.round(n)} ms`;
}

async function main(): Promise<void> {
  const out: Record<string, string> = { model };

  // 1 — load time. Unload EVERY resident model first (Ollama keeps the last
  //     one warm for minutes; two resident models on a 32 GB machine measure
  //     memory pressure, not the model), then a 1-token generate.
  const resident = (await (await fetch(`${base}/api/ps`)).json()) as {
    models?: { name: string }[];
  };
  for (const m of resident.models ?? []) {
    await post("/api/generate", {
      model: m.name,
      keep_alive: 0,
      prompt: "",
    }).catch(() => undefined);
  }
  await new Promise((r) => setTimeout(r, 1500));
  const t0 = performance.now();
  await post("/api/generate", {
    model,
    prompt: "hi",
    stream: false,
    options: { num_predict: 1 },
  });
  out.load_ms = ms(performance.now() - t0);

  // 2 — resident RAM
  const ps = (await (await fetch(`${base}/api/ps`)).json()) as {
    models?: { name: string; size: number; size_vram: number }[];
  };
  const running = ps.models?.find(
    (m) => m.name === model || m.name.startsWith(model),
  );
  out.resident_gb = running ? (running.size / 1024 ** 3).toFixed(2) : "n/a";
  out.vram_gb = running ? (running.size_vram / 1024 ** 3).toFixed(2) : "n/a";

  // 3 — decode tok/s on a short prompt
  const gen = await post<{
    eval_count: number;
    eval_duration: number;
    prompt_eval_duration: number;
  }>("/api/generate", {
    model,
    prompt: "Write 120 words about tidal power.",
    stream: false,
    options: { num_predict: 160 },
  });
  out.decode_tok_s = (gen.eval_count / (gen.eval_duration / 1e9)).toFixed(1);

  // 4 — first token at a ~2K-token prompt (streamed)
  const filler = Array.from(
    { length: 125 },
    (_, i) => `Line ${i}: the quick brown fox jumps over the lazy dog.`,
  ).join("\n");
  const t1 = performance.now();
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `${filler}\n\nSummarise the above in one sentence.`,
      stream: true,
      think: false,
      options: { num_predict: 24 },
    }),
  });
  const reader = res.body!.getReader();
  let ttft = -1;
  let promptTokens = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n").filter(Boolean)) {
      const parsed = JSON.parse(line) as {
        response?: string;
        thinking?: string;
        prompt_eval_count?: number;
        done?: boolean;
      };
      if (
        ttft < 0 &&
        ((parsed.response && parsed.response.length > 0) ||
          (parsed.thinking && parsed.thinking.length > 0))
      )
        ttft = performance.now() - t1;
      if (parsed.prompt_eval_count) promptTokens = parsed.prompt_eval_count;
    }
  }
  out.prompt_tokens = String(promptTokens);
  out.ttft_2k_ms = ttft < 0 ? "n/a" : ms(ttft);

  // 5 — tool-calling smoke: one structured call
  const tools = [
    {
      type: "function",
      function: {
        name: "get_room_temperature",
        description: "Read the current temperature of a named room.",
        parameters: {
          type: "object",
          properties: { room: { type: "string" } },
          required: ["room"],
        },
      },
    },
  ];
  const chat = await post<{
    message: {
      tool_calls?: { function: { name: string; arguments: unknown } }[];
    };
  }>("/api/chat", {
    model,
    stream: false,
    tools,
    messages: [
      { role: "user", content: "What is the temperature in the studio?" },
    ],
  });
  const call = chat.message.tool_calls?.[0];
  out.tool_call = call
    ? `${call.function.name}(${JSON.stringify(call.function.arguments)})`
    : "NONE";

  // 6 — JSON-mode smoke (Ollama's MLX runner may answer 501 "structured
  //     output is unavailable" — recorded, not fatal)
  let jsonOk = "invalid";
  try {
    const json = await post<{ response: string }>("/api/generate", {
      model,
      prompt:
        'Return a JSON object with keys "city" (string) and "population_millions" (number) for Lagos.',
      format: "json",
      stream: false,
      options: { num_predict: 80 },
    });
    try {
      const parsed = JSON.parse(json.response) as Record<string, unknown>;
      jsonOk =
        typeof parsed.city === "string" &&
        typeof parsed.population_millions === "number"
          ? "ok"
          : "shape-mismatch";
    } catch {
      /* invalid */
    }
  } catch (error) {
    jsonOk = `unavailable (${error instanceof Error ? error.message.slice(0, 80) : "error"})`;
  }
  out.json_mode = jsonOk;

  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(
    `[fit-gate] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
