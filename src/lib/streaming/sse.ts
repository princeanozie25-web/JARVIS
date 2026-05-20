import type { StreamEvent } from "../providers";

export function encodeSseEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export interface ParsedSseEvents {
  events: StreamEvent[];
  remaining: string;
}

export function parseSseEvents(buffer: string): ParsedSseEvents {
  const events: StreamEvent[] = [];
  let remaining = buffer;
  let separatorIndex: number;

  while ((separatorIndex = remaining.indexOf("\n\n")) !== -1) {
    const block = remaining.slice(0, separatorIndex);
    remaining = remaining.slice(separatorIndex + 2);

    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    const eventType = block
      .split("\n")
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();

    if (!data) continue;

    try {
      const parsed = JSON.parse(data) as { type?: unknown };
      if (
        eventType &&
        (typeof parsed.type !== "string" || parsed.type !== eventType)
      ) {
        continue;
      }
      events.push(parsed as StreamEvent);
    } catch {
      continue;
    }
  }

  return { events, remaining };
}
