import type { EvalCase } from "./types";

export const DEFAULT_EVAL_CASES: EvalCase[] = [
  {
    id: "classify-domain",
    label: "Intent classification (single-word answer)",
    messages: [
      {
        role: "user",
        content:
          "Classify the domain of this sentence as exactly one word, lowercase: 'My engine won't turn over and the battery seems fine.' Answer with one word only.",
      },
    ],
  },
  {
    id: "paraphrase-short",
    label: "Short paraphrase",
    messages: [
      {
        role: "user",
        content:
          "Rewrite this in one short sentence, keeping the meaning: 'I was wondering whether you might happen to know what time the next train to Manchester leaves.'",
      },
    ],
  },
  {
    id: "reason-calendar",
    label: "Simple deterministic reasoning",
    messages: [
      {
        role: "user",
        content:
          "If today is Monday, what day of the week will it be in 100 days? Answer with the day name only.",
      },
    ],
  },
  {
    id: "structured-json",
    label: "Structured output (JSON only)",
    messages: [
      {
        role: "user",
        content:
          "Return a JSON object with keys 'city' and 'country' for the capital of France. Output JSON only, no prose.",
      },
    ],
  },
];
