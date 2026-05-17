import type { RollbackSummary } from "@/lib/rollbacks/visibility";

export interface RollbackStatusPanelProps {
  latest: RollbackSummary | null;
  disabled?: boolean;
  onUndo: () => void;
}

function actionLabel(kind: RollbackSummary["kind"]): string {
  if (kind === "fs_unlink_created") return "Undo last file create";
  if (kind === "fs_restore_content") return "Undo last file overwrite";
  return "Undo last file change";
}

export function RollbackStatusPanel({
  latest,
  disabled = false,
  onUndo,
}: RollbackStatusPanelProps) {
  if (!latest?.available) return null;

  return (
    <div className="w-full max-w-3xl mt-4 border border-gray-700 bg-gray-950 text-gray-100 rounded-lg p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase text-gray-400">Undo available</p>
        <p className="text-sm">
          {actionLabel(latest.kind)}: {latest.path_summary}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onUndo}
        className="rounded-lg border border-gray-500 px-3 py-2 text-sm font-semibold disabled:opacity-50"
      >
        Ask JARVIS to undo
      </button>
    </div>
  );
}
