import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  RuntimeCommandSpec,
  RuntimeStreamEvent,
} from "@/lib/runtime-commands";
import type { RuntimeCommandCallRow } from "@/lib/db/node";
import {
  RuntimeCommandAuditPanel,
  RuntimeCommandPanel,
  filterRuntimeCommandAuditCalls,
} from "./RuntimeCommandPanel";

const commands: RuntimeCommandSpec[] = [
  {
    id: "git.status",
    command: "git",
    structuredArgSchema: { type: "argv", allowed: [["status", "--short"]] },
    description: "Show concise repository status metadata.",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    timeoutMs: 5_000,
    workingDirectoryPolicy: { type: "repo_root" },
    environmentPolicy: { inherit: false, allowedEnv: [] },
    enabled: true,
  },
  {
    id: "node.version",
    command: "node",
    structuredArgSchema: { type: "argv", allowed: [["--version"]] },
    description: "Show Node.js version metadata.",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    timeoutMs: 5_000,
    workingDirectoryPolicy: { type: "none" },
    environmentPolicy: { inherit: false, allowedEnv: [] },
    enabled: true,
  },
];

const hiddenWriteCommand = {
  ...commands[0],
  id: "fs.write",
  command: "write-file",
  requiredSafetyTag: "BLOCK",
  reversibilityClass: "DESTRUCTIVE",
} as unknown as RuntimeCommandSpec;

function call(
  id: string,
  status: RuntimeCommandCallRow["status"],
  overrides: Partial<RuntimeCommandCallRow> = {},
): RuntimeCommandCallRow {
  return {
    id,
    session_id: "session-1",
    command_id: "node.version",
    command: "node",
    argv_json: JSON.stringify(["--version"]),
    working_directory: ".",
    required_safety_tag: "ALLOW",
    reversibility_class: "PURE_READ",
    status,
    proposed_at: 1_000,
    approved_at: status === "pending" ? null : 2_000,
    started_at: status === "running" ? 3_000 : null,
    completed_at: null,
    stdout_ref: null,
    stderr_ref: null,
    exit_code: null,
    error_class: null,
    error_message: null,
    ...overrides,
  };
}

const events: RuntimeStreamEvent[] = [
  {
    type: "runtime_command_started",
    command_call_id: "runtime-call-1",
    command_id: "node.version",
    timestamp: 3_000,
  },
  {
    type: "runtime_stdout",
    command_call_id: "runtime-call-1",
    command_id: "node.version",
    timestamp: 3_001,
    chunk: "v22.0.0",
    bytes: 7,
  },
  {
    type: "runtime_output_truncated",
    command_call_id: "runtime-call-1",
    command_id: "node.version",
    timestamp: 3_002,
    stream: "stdout",
    limit_bytes: 3,
    observed_bytes: 7,
  },
];

describe("RuntimeCommandPanel", () => {
  it("renders command list and safety labels", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel initialCommands={commands} />,
    );

    expect(html).toContain("Runtime Commands");
    expect(html).toContain("git.status");
    expect(html).toContain("node.version");
    expect(html).toContain("Read-only command");
    expect(html).toContain("Manual execution only");
    expect(html).toContain("No shell access");
    expect(html).toContain("Requires approval before execution");
    expect(html).toContain("Workspace root:");
  });

  it("does not render arbitrary shell input", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel initialCommands={commands} />,
    );

    expect(html).not.toContain("<input");
    expect(html).not.toContain("Shell command");
    expect(html).not.toContain("Command text");
  });

  it("does not expose write-capable command specs", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel
        initialCommands={[...commands, hiddenWriteCommand]}
      />,
    );

    expect(html).not.toContain("fs.write");
    expect(html).not.toContain("write-file");
  });

  it("renders propose command controls with allowed structured args", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel initialCommands={commands} />,
    );

    expect(html).toContain("Runtime command");
    expect(html).toContain("Allowed arguments");
    expect(html).toContain("status --short");
    expect(html).toContain("Propose Command");
  });

  it("renders approve and deny buttons for pending calls", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel
        initialCommands={commands}
        initialCalls={[call("runtime-call-1", "pending")]}
      />,
    );

    expect(html).toContain("Approve");
    expect(html).toContain("Deny");
    expect(html).not.toContain("Execute Approved Command");
  });

  it("renders execute only after approval", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel
        initialCommands={commands}
        initialCalls={[call("runtime-call-1", "approved")]}
      />,
    );

    expect(html).toContain("Execute Approved Command");
    expect(html).toContain("relative cwd: .");
    expect(html).not.toContain("Cancel Command");
  });

  it("renders cancel control for running calls", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel
        initialCommands={commands}
        initialCalls={[call("runtime-call-1", "running")]}
      />,
    );

    expect(html).toContain("Cancel Command");
    expect(html).not.toContain("Execute Approved Command");
  });

  it("renders output events and truncation warnings", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandPanel
        initialCommands={commands}
        initialCalls={[call("runtime-call-1", "running")]}
        initialEvents={{ "runtime-call-1": events }}
      />,
    );

    expect(html).toContain("stdout");
    expect(html).toContain("v22.0.0");
    expect(html).toContain("runtime_command_started");
    expect(html).toContain("runtime_output_truncated");
    expect(html).toContain("Output truncated to the configured safe limit.");
  });

  it("renders read-only audit rows with command details", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandAuditPanel
        calls={[
          call("runtime-call-1", "completed", {
            working_directory: "packages/app",
            proposed_at: 1_000,
            approved_at: 2_000,
            started_at: 3_000,
            completed_at: 4_000,
            exit_code: 0,
            stdout_ref: "runtime-inline://runtime-call-1/stdout",
            stderr_ref: "runtime-inline://runtime-call-1/stderr",
          }),
        ]}
      />,
    );

    expect(html).toContain("Runtime Command Audit");
    expect(html).toContain("node.version");
    expect(html).toContain("argv");
    expect(html).toContain("--version");
    expect(html).toContain("normalized workspace cwd");
    expect(html).toContain("packages/app");
    expect(html).toContain("status: completed");
    expect(html).toContain("exit_code");
    expect(html).toContain("runtime-inline://runtime-call-1/stdout");
  });

  it("filters audit rows by status", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandAuditPanel
        calls={[
          call("runtime-call-pending", "pending"),
          call("runtime-call-completed", "completed"),
        ]}
        initialStatusFilter="completed"
      />,
    );

    expect(html).toContain("runtime-call-completed");
    expect(html).not.toContain("runtime-call-pending");
  });

  it("filters audit rows by command", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandAuditPanel
        calls={[
          call("runtime-call-node", "completed"),
          call("runtime-call-git", "completed", {
            command_id: "git.status",
            command: "git",
            argv_json: JSON.stringify(["status", "--short"]),
          }),
        ]}
        initialCommandFilter="git.status"
      />,
    );

    expect(html).toContain("runtime-call-git");
    expect(html).toContain("git.status");
    expect(html).not.toContain("runtime-call-node");
  });

  it("sorts audit rows latest first", () => {
    const rows = filterRuntimeCommandAuditCalls(
      [
        call("runtime-call-old", "completed", { proposed_at: 1_000 }),
        call("runtime-call-new", "completed", { proposed_at: 2_000 }),
      ],
      { statusFilter: "all", commandFilter: "all" },
    );

    expect(rows.map((row) => row.id)).toEqual([
      "runtime-call-new",
      "runtime-call-old",
    ]);
  });

  it("shows audit safety copy without execution controls", () => {
    const html = renderToStaticMarkup(
      <RuntimeCommandAuditPanel calls={[call("runtime-call-1", "approved")]} />,
    );

    expect(html).toContain("Manual-only");
    expect(html).toContain("read-only commands only");
    expect(html).toContain("workspace-bounded");
    expect(html).toContain("no shell access");
    expect(html).not.toContain("Execute Approved Command");
    expect(html).not.toContain("Approve");
    expect(html).not.toContain("Deny");
  });
});
