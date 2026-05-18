"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LongTermMemoryCategory,
  MemorySensitivity,
} from "../lib/memory/types";
import type {
  MemoryRetrievalMode,
  MemoryRetrievalScore,
} from "../lib/memory/retriever";

export interface SurfacedMemory {
  id: string;
  category: LongTermMemoryCategory;
  content: string;
  project: string | null;
  tags: string[];
  sensitivity: MemorySensitivity;
  retrievalMode: MemoryRetrievalMode;
  score?: MemoryRetrievalScore;
}

export interface ResurfacedIdeasPanelProps {
  memories: SurfacedMemory[];
  onShown?: (memories: SurfacedMemory[]) => void;
}

export function visibleSurfacedMemories(
  memories: SurfacedMemory[],
  dismissedIds: ReadonlySet<string>,
): SurfacedMemory[] {
  return memories.filter((memory) => !dismissedIds.has(memory.id));
}

export function dismissSurfacedMemory(
  dismissedIds: ReadonlySet<string>,
  memoryId: string,
): Set<string> {
  return new Set([...dismissedIds, memoryId]);
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "none";
  return Number.isInteger(value) ? String(value) : value.toFixed(6);
}

function memorySetKey(memories: SurfacedMemory[]): string {
  return memories
    .map((memory) => `${memory.id}:${memory.retrievalMode}`)
    .join("|");
}

export function ResurfacedIdeasPanel({
  memories,
  onShown,
}: ResurfacedIdeasPanelProps) {
  const [dismissedState, setDismissedState] = useState<{
    sourceKey: string;
    ids: Set<string>;
  }>({ sourceKey: "", ids: new Set() });
  const shownKeys = useRef<Set<string>>(new Set());
  const sourceKey = memorySetKey(memories);

  const visibleMemories = useMemo(
    () =>
      visibleSurfacedMemories(
        memories,
        dismissedState.sourceKey === sourceKey
          ? dismissedState.ids
          : new Set<string>(),
      ),
    [memories, dismissedState, sourceKey],
  );

  useEffect(() => {
    if (memories.length === 0 || shownKeys.current.has(sourceKey)) return;
    shownKeys.current.add(sourceKey);
    onShown?.(visibleSurfacedMemories(memories, new Set()));
  }, [memories, onShown, sourceKey]);

  if (visibleMemories.length === 0) return null;

  return (
    <section
      aria-label="Resurfaced Ideas"
      className="mt-3 border border-cyan-900 bg-gray-950 p-4 text-gray-100 rounded-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">
          Resurfaced Ideas
        </h3>
        <span className="rounded border border-cyan-900 px-2 py-1 text-xs text-cyan-300">
          {visibleMemories.length}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {visibleMemories.map((memory) => (
          <article key={memory.id} className="border border-gray-800 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>{memory.category}</span>
              <span>{memory.sensitivity}</span>
              <span>mode: {memory.retrievalMode}</span>
              {memory.project && <span>project: {memory.project}</span>}
            </div>

            <p className="mt-2 text-sm text-gray-100">{memory.content}</p>

            {memory.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                {memory.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}

            {memory.score && (
              <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-4">
                <span>keyword: {formatScore(memory.score.keywordRank)}</span>
                <span>vector: {formatScore(memory.score.vectorRank)}</span>
                <span>fused: {formatScore(memory.score.fusedScore)}</span>
                <span>source: {memory.score.sourceType}</span>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-gray-500"
                onClick={() =>
                  setDismissedState((current) => ({
                    sourceKey,
                    ids: dismissSurfacedMemory(
                      current.sourceKey === sourceKey ? current.ids : new Set(),
                      memory.id,
                    ),
                  }))
                }
              >
                Dismiss
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-800 px-3 py-1 text-xs text-gray-600"
                disabled
                title="Memory weighting will come later."
              >
                Promote
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
