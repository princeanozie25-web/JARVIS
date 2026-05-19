"use client";

import type {
  ReflectionPrompt,
  ReflectionPromptTemplateType,
} from "@/lib/reflection-prompts";

export interface ReflectionPromptPanelProps {
  prompt: ReflectionPrompt | null;
  selectedTemplate: ReflectionPromptTemplateType;
  loading?: boolean;
  consentEnabled?: boolean;
  onTemplateChange: (template: ReflectionPromptTemplateType) => void;
  onGenerate: () => void | Promise<void>;
}

const TEMPLATE_LABELS: Record<ReflectionPromptTemplateType, string> = {
  project_reflection: "Project Reflection",
  goal_reflection: "Goal Reflection",
  timeline_reflection: "Timeline Reflection",
  preference_review: "Preference Review",
};

const TEMPLATE_TYPES = Object.keys(
  TEMPLATE_LABELS,
) as ReflectionPromptTemplateType[];

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

export function ReflectionPromptPanel({
  prompt,
  selectedTemplate,
  loading = false,
  consentEnabled = false,
  onTemplateChange,
  onGenerate,
}: ReflectionPromptPanelProps) {
  return (
    <section className="w-full max-w-3xl mt-4 border border-gray-800 bg-gray-950 text-gray-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Reflection Prompts
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Optional manual questions; no scheduling or saved reflections
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {loading ? "Generating" : "Manual"}
        </span>
      </div>

      {!consentEnabled && (
        <p className="mt-4 rounded-md border border-gray-800 bg-black p-3 text-sm text-gray-500">
          Reflection prompts are disabled until consent is enabled.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <select
          aria-label="Reflection prompt template"
          value={selectedTemplate}
          onChange={(event) =>
            onTemplateChange(event.target.value as ReflectionPromptTemplateType)
          }
          disabled={!consentEnabled || loading}
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
        >
          {TEMPLATE_TYPES.map((type) => (
            <option key={type} value={type}>
              {TEMPLATE_LABELS[type]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!consentEnabled || loading}
          onClick={onGenerate}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate Prompt
        </button>
      </div>

      {prompt ? (
        <article className="mt-4 rounded-md border border-gray-800 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{TEMPLATE_LABELS[prompt.template_type]}</span>
            <span>{formatTimestamp(prompt.generated_at)}</span>
            <span>{prompt.timeline_entry_count} timeline items</span>
            <span>{prompt.preference_count} preferences</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">
            {prompt.question}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Optional/manual only. Not injected into prompts and not written to
            memory.
          </p>
        </article>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          No reflection prompt generated in this view.
        </p>
      )}
    </section>
  );
}
