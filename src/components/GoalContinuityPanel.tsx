"use client";

import { useState, type FormEvent } from "react";
import type { GoalRow, GoalStatus } from "@/lib/db/node";

const CLOSED_STATUSES: GoalStatus[] = ["met", "missed", "abandoned"];
const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  met: "Met",
  missed: "Missed",
  abandoned: "Abandoned",
};

export interface GoalContinuityPanelProps {
  goals: GoalRow[];
  loading?: boolean;
  consentEnabled?: boolean;
  creating?: boolean;
  updatingGoalId?: string | null;
  onCreate: (input: {
    title: string;
    parentId?: string | null;
  }) => void | Promise<void>;
  onUpdateStatus: (id: string, status: GoalStatus) => void | Promise<void>;
  onTouch: (id: string) => void | Promise<void>;
}

function formatTimestamp(value: number | null): string {
  if (value === null) return "Not completed";
  return new Date(value).toLocaleString();
}

function GoalCard({
  goal,
  disabled,
  onUpdateStatus,
  onTouch,
}: {
  goal: GoalRow;
  disabled: boolean;
  onUpdateStatus: (id: string, status: GoalStatus) => void | Promise<void>;
  onTouch: (id: string) => void | Promise<void>;
}) {
  return (
    <article className="rounded-md border border-gray-800 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-100">{goal.title}</h4>
          <p className="mt-1 text-xs text-gray-500">
            {STATUS_LABELS[goal.status]} - touched{" "}
            {formatTimestamp(goal.last_touched)}
          </p>
          {goal.parent_id && (
            <p className="mt-1 text-xs text-gray-500">
              parent {goal.parent_id}
            </p>
          )}
          {goal.completed_at !== null && (
            <p className="mt-1 text-xs text-gray-500">
              completed {formatTimestamp(goal.completed_at)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={`Status for ${goal.title}`}
            value={goal.status}
            disabled={disabled}
            onChange={(event) =>
              onUpdateStatus(goal.id, event.target.value as GoalStatus)
            }
            className="rounded-md border border-gray-700 bg-black px-2 py-1 text-xs text-gray-100 outline-none disabled:opacity-50"
          >
            {(["active", ...CLOSED_STATUSES] as GoalStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTouch(goal.id)}
            className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Touch
          </button>
        </div>
      </div>
    </article>
  );
}

export function GoalContinuityPanel({
  goals,
  loading = false,
  consentEnabled = false,
  creating = false,
  updatingGoalId = null,
  onCreate,
  onUpdateStatus,
  onTouch,
}: GoalContinuityPanelProps) {
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const closedGoals = goals.filter((goal) => goal.status !== "active");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedParentId = parentId.trim();
    if (!trimmedTitle || !consentEnabled) return;
    await onCreate({
      title: trimmedTitle,
      parentId: trimmedParentId || null,
    });
    setTitle("");
    setParentId("");
  }

  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Goal Continuity
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            User-declared goals with manual status
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${activeGoals.length} active`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Goals are disabled until consent is enabled.
        </p>
      )}

      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3">
        <input
          aria-label="Goal title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Goal title"
          disabled={!consentEnabled || creating}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <input
            aria-label="Parent goal id"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            placeholder="Parent goal id"
            disabled={!consentEnabled || creating}
            className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!consentEnabled || creating || !title.trim()}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating" : "Create Goal"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Active Goals
        </h3>
        {activeGoals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No active goals stored.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                disabled={!consentEnabled || updatingGoalId === goal.id}
                onUpdateStatus={onUpdateStatus}
                onTouch={onTouch}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Closed Goals
        </h3>
        {closedGoals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No met, missed, or abandoned goals stored.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {closedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                disabled={!consentEnabled || updatingGoalId === goal.id}
                onUpdateStatus={onUpdateStatus}
                onTouch={onTouch}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
