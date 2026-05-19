"use client";

import { useState, type FormEvent } from "react";
import type { PreferenceRow } from "@/lib/db/node";

export interface PreferenceLedgerPanelProps {
  current: PreferenceRow[];
  history: PreferenceRow[];
  loading?: boolean;
  consentEnabled?: boolean;
  adding?: boolean;
  onAdd: (input: {
    key: string;
    value: string;
    category: string;
  }) => void | Promise<void>;
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

function SupersedesBadge({ row }: { row: PreferenceRow }) {
  if (!row.supersedes_id) return null;
  return (
    <span className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-500">
      supersedes {row.supersedes_id}
    </span>
  );
}

export function PreferenceLedgerPanel({
  current,
  history,
  loading = false,
  consentEnabled = false,
  adding = false,
  onAdd,
}: PreferenceLedgerPanelProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    const trimmedCategory = category.trim();
    if (!trimmedKey || !trimmedValue || !trimmedCategory || !consentEnabled) {
      return;
    }
    await onAdd({
      key: trimmedKey,
      value: trimmedValue,
      category: trimmedCategory,
    });
    setKey("");
    setValue("");
    setCategory("");
  }

  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Preference Ledger
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            User-declared preferences, append-only
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Loading" : `${current.length} active`}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Preferences are disabled until consent is enabled.
        </p>
      )}

      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            aria-label="Preference key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Key"
            disabled={!consentEnabled || adding}
            className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <input
            aria-label="Preference category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category"
            disabled={!consentEnabled || adding}
            className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={
              !consentEnabled ||
              adding ||
              !key.trim() ||
              !value.trim() ||
              !category.trim()
            }
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? "Adding" : "Add Preference"}
          </button>
        </div>
        <textarea
          aria-label="Preference value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Value"
          rows={3}
          disabled={!consentEnabled || adding}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
      </form>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Current Effective Preferences
        </h3>
        {current.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No effective preferences stored.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {current.map((row) => (
              <article
                key={row.id}
                className="rounded-md border border-gray-800 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-100">
                    {row.key}
                  </span>
                  <span className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">
                    {row.category}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-300">{row.value}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Preference History
        </h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No preference history stored.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((row) => (
              <article
                key={row.id}
                className="rounded-md border border-gray-800 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-100">{row.key}</span>
                  <span className="text-gray-500">{row.category}</span>
                  <SupersedesBadge row={row} />
                </div>
                <p className="mt-2 text-gray-300">{row.value}</p>
                <p className="mt-2 text-xs text-gray-500">
                  effective {formatTimestamp(row.effective_from)} - created{" "}
                  {formatTimestamp(row.created_at)}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
