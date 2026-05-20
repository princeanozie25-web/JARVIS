import type { StreamEvent } from "../providers";
import {
  evaluateSpeechSafetyPolicy,
  type SpeechSafetyPolicyDecision,
} from "./safety-policy";
import type { SpeechChunk, SpeechSynthesisInputSource } from "./types";

export interface SpeechChunkerOptions {
  minChunkChars?: number;
  now?: () => number;
  idPrefix?: string;
  source?: SpeechSynthesisInputSource;
  contentTags?: readonly string[];
}

export interface SpeechChunkerBlockedResult {
  blocked: true;
  decision: SpeechSafetyPolicyDecision;
}

export interface SpeechChunkerAllowedResult {
  blocked: false;
  chunks: SpeechChunk[];
}

export type SpeechChunkerResult =
  | SpeechChunkerBlockedResult
  | SpeechChunkerAllowedResult;

export class TtsSentenceChunker {
  private readonly minChunkChars: number;
  private readonly now: () => number;
  private readonly idPrefix: string;
  private readonly source: SpeechSynthesisInputSource;
  private readonly contentTags: readonly string[];
  private buffer = "";
  private nextIndex = 0;
  private blockedDecision: SpeechSafetyPolicyDecision | null = null;

  constructor(opts: SpeechChunkerOptions = {}) {
    this.minChunkChars = Math.max(1, opts.minChunkChars ?? 1);
    this.now = opts.now ?? (() => Date.now());
    this.idPrefix = opts.idPrefix ?? "speech-chunk";
    this.source = opts.source ?? "assistant_prose";
    this.contentTags = opts.contentTags ?? [];
  }

  pushText(text: string): SpeechChunkerResult {
    if (this.blockedDecision) {
      return { blocked: true, decision: this.blockedDecision };
    }
    if (!text) return { blocked: false, chunks: [] };

    this.buffer += text;
    const decision = evaluateSpeechSafetyPolicy({
      text: this.buffer,
      source: this.source,
      contentTags: this.contentTags,
    });
    if (!decision.allowed) {
      this.buffer = "";
      this.blockedDecision = decision;
      return { blocked: true, decision };
    }

    return { blocked: false, chunks: this.flushCompleteSentences() };
  }

  pushStreamEvent(event: StreamEvent): SpeechChunkerResult {
    if (event.type !== "text") {
      return this.blockedDecision
        ? { blocked: true, decision: this.blockedDecision }
        : { blocked: false, chunks: [] };
    }
    return this.pushText(event.value);
  }

  finish(): SpeechChunkerResult {
    if (this.blockedDecision) {
      return { blocked: true, decision: this.blockedDecision };
    }
    const text = normalizeChunkText(this.buffer);
    this.buffer = "";
    if (!text) return { blocked: false, chunks: [] };

    const decision = evaluateSpeechSafetyPolicy({
      text,
      source: this.source,
      contentTags: this.contentTags,
    });
    if (!decision.allowed) {
      this.blockedDecision = decision;
      return { blocked: true, decision };
    }

    return { blocked: false, chunks: [this.createChunk(text)] };
  }

  getBlockedDecision(): SpeechSafetyPolicyDecision | null {
    return this.blockedDecision;
  }

  private flushCompleteSentences(): SpeechChunk[] {
    const chunks: SpeechChunk[] = [];
    let boundary = findFlushBoundary(this.buffer, this.minChunkChars);

    while (boundary !== null) {
      const candidate = normalizeChunkText(this.buffer.slice(0, boundary));
      const remainder = this.buffer.slice(boundary);
      chunks.push(this.createChunk(candidate));
      this.buffer = remainder;
      boundary = findFlushBoundary(this.buffer, this.minChunkChars);
    }

    return chunks;
  }

  private createChunk(text: string): SpeechChunk {
    const index = this.nextIndex++;
    return {
      id: `${this.idPrefix}-${index}`,
      text,
      index,
      createdAt: this.now(),
      source: "assistant_prose",
    };
  }
}

export function chunkAssistantProseText(
  text: string,
  opts: Omit<SpeechChunkerOptions, "source"> = {},
): SpeechChunkerResult {
  const chunker = new TtsSentenceChunker({
    ...opts,
    source: "assistant_prose",
  });
  const pushed = chunker.pushText(text);
  if (pushed.blocked) return pushed;
  const finished = chunker.finish();
  if (finished.blocked) return finished;
  return { blocked: false, chunks: [...pushed.chunks, ...finished.chunks] };
}

function normalizeChunkText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function findFlushBoundary(text: string, minChunkChars: number): number | null {
  const terminalPattern = /[.!?](?:["')\]]+)?(?:\s+|$)/g;
  let match = terminalPattern.exec(text);

  while (match) {
    const boundary = match.index + match[0].length;
    if (normalizeChunkText(text.slice(0, boundary)).length >= minChunkChars) {
      return boundary;
    }
    match = terminalPattern.exec(text);
  }

  return null;
}
