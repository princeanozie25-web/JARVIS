import type { LongTermMemoryRow } from "@/lib/memory/types";

export interface MemoryInspectorPanelProps {
  memories: LongTermMemoryRow[];
  vaultRoot: string | null;
  loading?: boolean;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

export function MemoryInspectorPanel({
  memories,
  vaultRoot,
  loading = false,
}: MemoryInspectorPanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Memory Inspector
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only vault rows{vaultRoot ? ` at ${vaultRoot}` : ""}
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${memories.length} rows`}
        </span>
      </div>

      {memories.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No memories stored yet.</p>
      ) : (
        <div className="mt-4 max-h-72 overflow-y-auto space-y-3">
          {memories.map((memory) => {
            const tags = parseTags(memory.tags_json);
            return (
              <article
                key={memory.id}
                className="border border-gray-800 rounded-md p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>{memory.category}</span>
                  <span>{memory.sensitivity}</span>
                  <span>{memory.source}</span>
                  <span>{formatDate(memory.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-gray-100">{memory.content}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  {memory.project && <span>project: {memory.project}</span>}
                  {memory.obsidian_path && (
                    <span>vault: {memory.obsidian_path}</span>
                  )}
                  {tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
