"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RuntimeCommandSpec,
  RuntimeStreamEvent,
} from "@/lib/runtime-commands";
import type { RuntimeCommandCallRow } from "@/lib/db/node";

type RuntimeCallStatus = RuntimeCommandCallRow["status"];

export interface RuntimeCommandPanelProps {
  initialCommands?: RuntimeCommandSpec[];
  initialCalls?: RuntimeCommandCallRow[];
  initialEvents?: Record<string, RuntimeStreamEvent[]>;
}

function parseArgv(argvJson: string): string[] {
  try {
    const parsed = JSON.parse(argvJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function statusLabel(status: RuntimeCallStatus): string {
  return status.replaceAll("_", " ");
}

function allowedArgSets(command: RuntimeCommandSpec | undefined): string[][] {
  return command?.structuredArgSchema?.allowed ?? [[]];
}

function isReadOnlyRuntimeCommand(command: RuntimeCommandSpec): boolean {
  return (
    command.enabled &&
    command.requiredSafetyTag === "ALLOW" &&
    command.reversibilityClass === "PURE_READ"
  );
}

function formatArgs(args: string[]): string {
  return args.length > 0 ? args.join(" ") : "(no args)";
}

function updateCallStatus(
  calls: RuntimeCommandCallRow[],
  callId: string,
  status: RuntimeCallStatus,
): RuntimeCommandCallRow[] {
  return calls.map((call) => (call.id === callId ? { ...call, status } : call));
}

function RuntimeOutputEvents({ events }: { events: RuntimeStreamEvent[] }) {
  const hasTruncation = events.some(
    (event) => event.type === "runtime_output_truncated",
  );
  const outputEvents = events.filter(
    (event) =>
      event.type === "runtime_stdout" || event.type === "runtime_stderr",
  );

  if (events.length === 0) {
    return <p className="mt-3 text-xs text-gray-500">No output events yet.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {hasTruncation && (
        <p className="rounded-md border border-yellow-700 bg-yellow-950 px-3 py-2 text-xs text-yellow-200">
          Output truncated to the configured safe limit.
        </p>
      )}
      {outputEvents.length > 0 && (
        <div className="space-y-2">
          {outputEvents.map((event, index) => (
            <pre
              key={`${event.type}-${index}`}
              className="max-h-40 overflow-auto rounded-md border border-gray-800 bg-black p-3 text-xs text-gray-200"
            >
              <span className="text-gray-500">
                {event.type === "runtime_stdout" ? "stdout" : "stderr"}:{" "}
              </span>
              {event.chunk}
            </pre>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {events.map((event, index) => (
          <span key={`${event.type}-badge-${index}`}>{event.type}</span>
        ))}
      </div>
    </div>
  );
}

function RuntimeCommandCallCard({
  call,
  events,
  busy,
  onApprove,
  onDeny,
  onExecute,
  onCancel,
}: {
  call: RuntimeCommandCallRow;
  events: RuntimeStreamEvent[];
  busy: boolean;
  onApprove: (callId: string) => void;
  onDeny: (callId: string) => void;
  onExecute: (callId: string) => void;
  onCancel: (callId: string) => void;
}) {
  const argv = parseArgv(call.argv_json);
  return (
    <article className="rounded-md border border-gray-800 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">
            {call.command_id}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {call.id} - {statusLabel(call.status)}
          </p>
          <p className="mt-1 text-xs text-gray-500">argv: {formatArgs(argv)}</p>
          <p className="mt-1 text-xs text-gray-500">
            relative cwd: {call.working_directory}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {call.status === "pending" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onApprove(call.id)}
                className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeny(call.id)}
                className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Deny
              </button>
            </>
          )}
          {call.status === "approved" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onExecute(call.id)}
              className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Execute Approved Command
            </button>
          )}
          {call.status === "running" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(call.id)}
              className="rounded-md border border-red-700 px-3 py-1 text-xs text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel Command
            </button>
          )}
        </div>
      </div>
      <RuntimeOutputEvents events={events} />
    </article>
  );
}

export function RuntimeCommandPanel({
  initialCommands = [],
  initialCalls = [],
  initialEvents = {},
}: RuntimeCommandPanelProps) {
  const [commands, setCommands] =
    useState<RuntimeCommandSpec[]>(initialCommands);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [calls, setCalls] = useState<RuntimeCommandCallRow[]>(initialCalls);
  const [eventsByCallId, setEventsByCallId] =
    useState<Record<string, RuntimeStreamEvent[]>>(initialEvents);
  const [selectedCommandId, setSelectedCommandId] = useState(
    initialCommands[0]?.id ?? "",
  );
  const [selectedArgIndex, setSelectedArgIndex] = useState(0);
  const [busyCallId, setBusyCallId] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current ??= globalThis.crypto.randomUUID();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCommands() {
      try {
        const response = await fetch("/api/runtime-commands");
        if (!response.ok) return;
        const data = (await response.json()) as {
          commands: RuntimeCommandSpec[];
          workspaceRoot?: string;
        };
        if (cancelled) return;
        setCommands(data.commands);
        setWorkspaceRoot(data.workspaceRoot ?? null);
        setSelectedCommandId(
          (current) =>
            current || data.commands.find(isReadOnlyRuntimeCommand)?.id || "",
        );
      } catch {
        return;
      }
    }
    if (initialCommands.length === 0) void loadCommands();
    return () => {
      cancelled = true;
    };
  }, [initialCommands.length]);

  const readOnlyCommands = useMemo(
    () => commands.filter(isReadOnlyRuntimeCommand),
    [commands],
  );
  const selectedCommand = useMemo(
    () =>
      readOnlyCommands.find((command) => command.id === selectedCommandId) ??
      readOnlyCommands[0],
    [readOnlyCommands, selectedCommandId],
  );
  const selectedArgs = allowedArgSets(selectedCommand)[selectedArgIndex] ?? [];

  async function proposeCommand() {
    if (!selectedCommand) return;
    setProposing(true);
    try {
      const response = await fetch("/api/runtime-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current ?? globalThis.crypto.randomUUID(),
          commandId: selectedCommand.id,
          argv: selectedArgs,
        }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { call: RuntimeCommandCallRow };
      setCalls((current) => [data.call, ...current]);
    } catch {
      return;
    } finally {
      setProposing(false);
    }
  }

  async function updateCall(
    callId: string,
    endpoint: "approve" | "deny" | "cancel",
  ) {
    setBusyCallId(callId);
    try {
      const response = await fetch(
        `/api/runtime-commands/${encodeURIComponent(callId)}/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            endpoint === "deny" ? JSON.stringify({ reason: "Denied" }) : "{}",
        },
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        call?: RuntimeCommandCallRow;
      };
      if (data.call) {
        setCalls((current) =>
          current.map((call) => (call.id === callId ? data.call! : call)),
        );
      } else if (endpoint === "cancel") {
        setCalls((current) => updateCallStatus(current, callId, "cancelled"));
      }
    } catch {
      return;
    } finally {
      setBusyCallId(null);
    }
  }

  async function executeCall(callId: string) {
    setBusyCallId(callId);
    setCalls((current) => updateCallStatus(current, callId, "running"));
    setEventsByCallId((current) => ({ ...current, [callId]: [] }));
    try {
      const response = await fetch(
        `/api/runtime-commands/${encodeURIComponent(callId)}/stream`,
        { method: "POST" },
      );
      if (!response.ok || !response.body) {
        setCalls((current) => updateCallStatus(current, callId, "failed"));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = JSON.parse(trimmed) as RuntimeStreamEvent;
          setEventsByCallId((current) => ({
            ...current,
            [callId]: [...(current[callId] ?? []), event],
          }));
          if (event.type === "runtime_command_completed") {
            setCalls((current) =>
              updateCallStatus(current, callId, "completed"),
            );
          } else if (event.type === "runtime_command_failed") {
            setCalls((current) => updateCallStatus(current, callId, "failed"));
          } else if (event.type === "runtime_command_timeout") {
            setCalls((current) => updateCallStatus(current, callId, "timeout"));
          } else if (event.type === "runtime_command_cancelled") {
            setCalls((current) =>
              updateCallStatus(current, callId, "cancelled"),
            );
          }
        }
      }
    } catch {
      setCalls((current) => updateCallStatus(current, callId, "failed"));
    } finally {
      setBusyCallId(null);
    }
  }

  return (
    <section className="w-full max-w-3xl mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4 text-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Runtime Commands
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Manual read-only runtime command cards
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Workspace root: {workspaceRoot ?? "loading"}
          </p>
        </div>
        <span className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400">
          {readOnlyCommands.length} available
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-300">
        <span className="rounded border border-gray-700 px-2 py-1">
          Read-only command
        </span>
        <span className="rounded border border-gray-700 px-2 py-1">
          Manual execution only
        </span>
        <span className="rounded border border-gray-700 px-2 py-1">
          No shell access
        </span>
        <span className="rounded border border-gray-700 px-2 py-1">
          Requires approval before execution
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <select
          aria-label="Runtime command"
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none"
          value={selectedCommandId}
          onChange={(event) => {
            setSelectedCommandId(event.target.value);
            setSelectedArgIndex(0);
          }}
        >
          {readOnlyCommands.map((command) => (
            <option key={command.id} value={command.id}>
              {command.id}
            </option>
          ))}
        </select>
        <select
          aria-label="Allowed arguments"
          className="rounded-md border border-gray-800 bg-black px-3 py-2 text-sm outline-none"
          value={selectedArgIndex}
          onChange={(event) => setSelectedArgIndex(Number(event.target.value))}
        >
          {allowedArgSets(selectedCommand).map((args, index) => (
            <option key={`${selectedCommandId}-${index}`} value={index}>
              {formatArgs(args)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedCommand || proposing}
          onClick={proposeCommand}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {proposing ? "Proposing" : "Propose Command"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {calls.length === 0 ? (
          <p className="text-sm text-gray-500">
            No runtime command calls proposed yet.
          </p>
        ) : (
          calls.map((call) => (
            <RuntimeCommandCallCard
              key={call.id}
              call={call}
              events={eventsByCallId[call.id] ?? []}
              busy={busyCallId === call.id}
              onApprove={(callId) => updateCall(callId, "approve")}
              onDeny={(callId) => updateCall(callId, "deny")}
              onExecute={executeCall}
              onCancel={(callId) => updateCall(callId, "cancel")}
            />
          ))
        )}
      </div>
    </section>
  );
}
