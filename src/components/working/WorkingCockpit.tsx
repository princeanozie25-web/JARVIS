"use client";

import { useMemo, useState } from "react";

type WorkflowId = "project" | "research" | "build" | "brief";

type ProposalKind =
  | "room.action"
  | "note.create"
  | "project.task.create"
  | "reminder.create";

type ProposalDraft = Readonly<{
  id: string;
  kind: ProposalKind;
  title: string;
  dryRunDiff: string;
  tier: string;
  expiresIn: string;
}>;

type ActivityEvent = Readonly<{
  ts: string;
  kind: "exec" | "deny" | "prop" | "info";
  text: string;
}>;

type PanelBadge = "FAKE ADAPTER" | "ONLY PATH TO SIDE EFFECTS" | "HEALTHY";

type Workflow = Readonly<{
  id: WorkflowId;
  label: string;
  situation: string;
  grid: string;
  sidebarDetail: string;
}>;

type AgentStatus = "working" | "waiting" | "idle";

const WORKFLOWS: readonly Workflow[] = Object.freeze([
  {
    id: "project",
    label: "Project",
    situation: "Daily desktop assistant work",
    grid: "1.1fr 1.4fr 0.95fr",
    sidebarDetail: "Chat, room, cost, activity",
  },
  {
    id: "research",
    label: "Research",
    situation: "Knowledge compounding",
    grid: "1fr 1.2fr 1fr",
    sidebarDetail: "Agents, gate, vault",
  },
  {
    id: "build",
    label: "Build Monitor",
    situation: "Phase progress and test health",
    grid: "1.3fr 1.1fr 1fr",
    sidebarDetail: "Phases, alerts, deadlines",
  },
  {
    id: "brief",
    label: "Morning Brief",
    situation: "Daily scheduler digest",
    grid: "1fr 1.3fr 1fr",
    sidebarDetail: "Digest, suggestions, gate",
  },
]);

const INITIAL_PROPOSALS: Record<WorkflowId, readonly ProposalDraft[]> = {
  project: [
    {
      id: "prop-room-1842",
      kind: "room.action",
      title: "Dim desk strip for focused build session",
      dryRunDiff: "desk strip: on at 78% -> on at 32%",
      tier: "T1 - safe_mutate",
      expiresIn: "expires in 04:58",
    },
  ],
  research: [
    {
      id: "prop-note-0441",
      kind: "note.create",
      title: "Create vault note from sparse project registry findings",
      dryRunDiff: "vault note: absent -> drafted metadata-only summary",
      tier: "T1 - safe_mutate",
      expiresIn: "expires in 04:42",
    },
  ],
  build: [
    {
      id: "prop-task-2190",
      kind: "project.task.create",
      title: "Add follow-up task for Phase 12 gate property tests",
      dryRunDiff: "task queue: 18 open -> 19 open",
      tier: "T1 - safe_mutate",
      expiresIn: "expires in 04:35",
    },
  ],
  brief: [
    {
      id: "prop-reminder-5107",
      kind: "reminder.create",
      title: "Schedule evening review for build monitor closeout",
      dryRunDiff: "calendar reminder: absent -> today 18:30 local",
      tier: "T1 - safe_mutate",
      expiresIn: "expires in 04:21",
    },
  ],
};

const INITIAL_ACTIVITY: readonly ActivityEvent[] = Object.freeze([
  {
    ts: "09:28",
    kind: "prop",
    text: "Chat created room proposal prop-room-1842.",
  },
  {
    ts: "09:21",
    kind: "info",
    text: "Cost rollup refreshed from metadata projection.",
  },
  {
    ts: "09:14",
    kind: "info",
    text: "Build monitor observed Phase 12 UI realization active.",
  },
]);

const AGENTS = Object.freeze([
  {
    id: "orchestrator",
    name: "Research Orchestrator",
    role: "routes specialist lanes",
    status: "working" as AgentStatus,
    description: "Frames the knowledge task and fans out metadata-safe work.",
    runs: 23,
    model: "local-primary",
  },
  {
    id: "vault",
    name: "Vault Enricher",
    role: "obsidian compounding",
    status: "waiting" as AgentStatus,
    description: "Waits for gate approval before adding durable notes.",
    runs: 12,
    model: "local-small",
  },
  {
    id: "critic",
    name: "Source Critic",
    role: "confidence review",
    status: "idle" as AgentStatus,
    description: "Scores coverage and flags sparse source clusters.",
    runs: 8,
    model: "cloud-review",
  },
]);

const PHASES = Object.freeze([
  { name: "Phase 12", status: "active", pct: 68, sub: "UI realization" },
  { name: "Phase 16D", status: "queued", pct: 24, sub: "projection wiring" },
  { name: "Phase 18", status: "queued", pct: 12, sub: "approval lifecycle" },
]);

const TEST_SUITES = Object.freeze([
  { name: "working gate invariant", status: "pass" },
  { name: "redaction fixtures", status: "pass" },
  { name: "expiry enforcement", status: "pending" },
]);

const SUGGESTIONS = Object.freeze([
  {
    label: "Scheduler",
    title: "Review open build alerts",
    body: "Three warnings are stale enough to become a task proposal.",
    canPropose: true,
  },
  {
    label: "Cost",
    title: "Local-first window looks healthy",
    body: "Local usage is above target and cloud spend remains under cap.",
    canPropose: false,
  },
  {
    label: "Vault",
    title: "Sparse concepts need enrichment",
    body: "Two project-registry concepts have low recall density.",
    canPropose: true,
  },
]);

const ROOM_DEVICES = Object.freeze([
  {
    name: "Desk strip",
    zone: "office",
    state: "on - 78%",
    trust: "safe_mutate",
  },
  {
    name: "Nanoleaf wall",
    zone: "office",
    state: "scene - focus",
    trust: "safe_mutate",
  },
  {
    name: "Door sensor",
    zone: "hall",
    state: "closed",
    trust: "observe_only",
  },
]);

const SYSTEM_LINKS = Object.freeze(["Inbox", "Audit", "Cost", "Room"] as const);

function workflowById(id: WorkflowId): Workflow {
  return WORKFLOWS.find((workflow) => workflow.id === id) ?? WORKFLOWS[0]!;
}

function badgeClass(badge: PanelBadge): string {
  if (badge === "ONLY PATH TO SIDE EFFECTS") {
    return "border-amber-300/55 bg-amber-300/12 text-amber-100";
  }
  if (badge === "FAKE ADAPTER") {
    return "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";
  }
  return "border-emerald-300/35 bg-emerald-300/10 text-emerald-100";
}

function statusPill(status: AgentStatus): string {
  switch (status) {
    case "working":
      return "border-emerald-300/35 bg-emerald-300/10 text-emerald-100";
    case "waiting":
      return "border-amber-300/35 bg-amber-300/10 text-amber-100";
    case "idle":
      return "border-slate-300/20 bg-white/[0.035] text-slate-300";
  }
}

function eventClass(kind: ActivityEvent["kind"]): string {
  switch (kind) {
    case "exec":
      return "text-emerald-200";
    case "deny":
      return "text-rose-200";
    case "prop":
      return "text-amber-200";
    case "info":
      return "text-cyan-100";
  }
}

export function WorkingCockpit() {
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowId>("project");
  const [proposals, setProposals] =
    useState<Record<WorkflowId, readonly ProposalDraft[]>>(INITIAL_PROPOSALS);
  const [activity, setActivity] =
    useState<readonly ActivityEvent[]>(INITIAL_ACTIVITY);
  const active = workflowById(activeWorkflow);
  const pendingCount = proposals[activeWorkflow].length;

  function resolveProposal(proposal: ProposalDraft, approved: boolean) {
    setProposals((current) => ({
      ...current,
      [activeWorkflow]: current[activeWorkflow].filter(
        (item) => item.id !== proposal.id,
      ),
    }));
    setActivity((current) => [
      {
        ts: "now",
        kind: approved ? "exec" : "deny",
        text: `${approved ? "Approved" : "Denied"} ${proposal.id}: ${proposal.title}`,
      },
      ...current,
    ]);
  }

  const statusText = useMemo(
    () =>
      pendingCount === 1
        ? "1 proposal pending"
        : `${pendingCount} proposals pending`,
    [pendingCount],
  );

  return (
    <section
      aria-label="JARVIS Working Cockpit"
      className="working-cockpit grid h-[calc(100vh-3.75rem)] min-h-[620px] overflow-hidden border border-border-subtle bg-panel/78 text-ink shadow-cockpit-depth"
      data-working-cockpit="working-cockpit"
      data-working-shell="approval-gated"
      data-working-phase="12-ui-realization"
      data-authority-source="architecture-operationalization"
      data-only-mutator="human-gate"
    >
      <TopBar
        activeWorkflow={activeWorkflow}
        onSelectWorkflow={setActiveWorkflow}
        statusText={statusText}
      />

      <div className="grid min-h-0 grid-cols-[196px_minmax(0,1fr)] border-y border-border-subtle">
        <Sidebar
          activeWorkflow={activeWorkflow}
          onSelectWorkflow={setActiveWorkflow}
        />
        <div className="relative min-h-0 overflow-hidden bg-[radial-gradient(circle_at_48%_42%,rgba(56,189,248,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]">
          {WORKFLOWS.map((workflow) => (
            <WorkflowPage
              key={workflow.id}
              workflow={workflow}
              active={workflow.id === activeWorkflow}
              proposals={proposals[workflow.id]}
              activity={activity}
              onResolve={resolveProposal}
            />
          ))}
        </div>
      </div>

      <StatusBar active={active} pendingCount={pendingCount} />
    </section>
  );
}

function TopBar({
  activeWorkflow,
  onSelectWorkflow,
  statusText,
}: Readonly<{
  activeWorkflow: WorkflowId;
  onSelectWorkflow: (workflow: WorkflowId) => void;
  statusText: string;
}>) {
  return (
    <header className="grid h-16 grid-cols-[150px_200px_minmax(330px,1fr)_420px] items-center gap-3 border-b border-border-subtle bg-void/55 px-4">
      <div>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-signal">
          Jarvis
        </p>
        <h1 className="font-display text-lg font-semibold text-ink">
          Working Cockpit
        </h1>
      </div>

      <nav aria-label="Screen tabs" className="flex items-center gap-1">
        <a
          className="wc-screen-tab border border-border-subtle bg-panel-soft px-2.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink/62 transition-colors hover:border-signal/40 hover:text-ink"
          href="/rest"
        >
          Rest
        </a>
        <a
          className="wc-screen-tab wc-screen-tab-active border border-signal/45 bg-signal/12 px-2.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink"
          href="/working"
        >
          Working
        </a>
        <a
          className="wc-screen-tab border border-border-subtle bg-panel-soft px-2.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink/62 transition-colors hover:border-signal/40 hover:text-ink"
          href="/audit"
        >
          Audit
        </a>
      </nav>

      <nav
        aria-label="Workflow tabs"
        className="flex min-w-0 items-center gap-1 overflow-hidden"
        data-workflow-tabs="true"
      >
        {WORKFLOWS.map((workflow) => (
          <button
            key={workflow.id}
            type="button"
            className="wc-workflow-tab shrink-0 border border-border-subtle bg-panel-soft px-2.5 py-2 font-mono text-[0.6rem] uppercase tracking-[0.09em] text-ink/62 transition-colors hover:border-signal/45 hover:text-ink data-[active=true]:border-signal/55 data-[active=true]:bg-signal/12 data-[active=true]:text-ink"
            data-workflow-tab={workflow.id}
            data-active={workflow.id === activeWorkflow}
            aria-pressed={workflow.id === activeWorkflow}
            onClick={() => onSelectWorkflow(workflow.id)}
          >
            {workflow.label}
          </button>
        ))}
      </nav>

      <dl className="grid min-w-0 grid-cols-4 gap-2 font-mono text-[0.6rem]">
        <Readout label="Pipeline" value="nominal" />
        <Readout label="Gate" value={statusText} />
        <Readout label="Model" value="local-primary" />
        <Readout label="Clock" value="09:42" />
      </dl>
    </header>
  );
}

function Sidebar({
  activeWorkflow,
  onSelectWorkflow,
}: Readonly<{
  activeWorkflow: WorkflowId;
  onSelectWorkflow: (workflow: WorkflowId) => void;
}>) {
  return (
    <aside className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-5 border-r border-border-subtle bg-void/44 p-4">
      <SidebarSection title="Workflows">
        {WORKFLOWS.map((workflow) => (
          <button
            key={workflow.id}
            type="button"
            className="wc-sidebar-button grid gap-1 border border-border-subtle bg-panel-soft p-3 text-left transition-colors hover:border-signal/40 data-[active=true]:border-signal/55 data-[active=true]:bg-signal/10"
            data-sidebar-workflow={workflow.id}
            data-active={workflow.id === activeWorkflow}
            aria-pressed={workflow.id === activeWorkflow}
            onClick={() => onSelectWorkflow(workflow.id)}
          >
            <span>{workflow.label}</span>
            <small className="text-xs leading-4 text-ink/48">
              {workflow.sidebarDetail}
            </small>
          </button>
        ))}
      </SidebarSection>

      <SidebarSection title="System">
        <div className="grid gap-2">
          {SYSTEM_LINKS.map((label) => (
            <span
              key={label}
              className="wc-sidebar-link border border-border-subtle bg-panel-soft px-3 py-2 text-xs text-ink/58"
            >
              {label}
            </span>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="Phase">
        <div className="border border-border-subtle bg-panel-soft p-3">
          <p className="font-display text-sm text-ink">Phase 12 active</p>
          <p className="mt-1 text-xs leading-5 text-ink/60">
            UI realization, gate invariant visible, production swaps pending.
          </p>
          <div className="mt-3 h-1.5 bg-white/8">
            <span className="block h-full w-[68%] bg-signal" />
          </div>
        </div>
      </SidebarSection>
    </aside>
  );
}

function WorkflowPage({
  workflow,
  active,
  proposals,
  activity,
  onResolve,
}: Readonly<{
  workflow: Workflow;
  active: boolean;
  proposals: readonly ProposalDraft[];
  activity: readonly ActivityEvent[];
  onResolve: (proposal: ProposalDraft, approved: boolean) => void;
}>) {
  return (
    <div
      className="absolute inset-0 min-h-0 gap-4 p-4"
      data-workflow-page={workflow.id}
      data-active-workflow-page={String(active)}
      data-grid-template={workflow.grid}
      style={{
        display: active ? "grid" : "none",
        gridTemplateColumns: workflow.grid,
      }}
    >
      {workflow.id === "research" ? <ResearchOrchestrator /> : null}
      <WorkflowSurface workflow={workflow.id} />
      <HumanGatePanel proposals={proposals} onResolve={onResolve} />
      <ContextColumn workflow={workflow.id} activity={activity} />
    </div>
  );
}

function Panel({
  title,
  badge,
  children,
  className = "",
  readOnly = false,
}: Readonly<{
  title: string;
  badge?: PanelBadge;
  children: React.ReactNode;
  className?: string;
  readOnly?: boolean;
}>) {
  return (
    <article
      className={`grid min-h-0 grid-rows-[44px_minmax(0,1fr)] border border-border-subtle bg-panel-soft/92 shadow-cockpit-depth ${className}`}
      data-read-only-context-panel={readOnly ? "true" : undefined}
    >
      <header className="ph flex min-h-0 items-center justify-between gap-3 border-b border-border-subtle px-4">
        <h2 className="truncate font-mono text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/70">
          {title}
        </h2>
        {badge ? (
          <span
            className={`shrink-0 border px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] ${badgeClass(
              badge,
            )}`}
          >
            {badge}
          </span>
        ) : null}
      </header>
      <div className="pb min-h-0 overflow-auto p-4">{children}</div>
    </article>
  );
}

function WorkflowSurface({ workflow }: { workflow: WorkflowId }) {
  if (workflow === "research") return <ResearchSurface />;
  if (workflow === "build") return <BuildSurface />;
  if (workflow === "brief") return <BriefSurface />;
  return <ProjectSurface />;
}

function ProjectSurface() {
  return (
    <Panel title="Chat" badge="FAKE ADAPTER">
      <div className="grid h-full grid-rows-[1fr_auto] gap-4">
        <div className="space-y-3">
          <Message
            who="Operator"
            text="Can you set the office for deep work?"
          />
          <Message
            who="JARVIS"
            text="I cannot act directly. I prepared a room proposal in the Human Gate."
          />
          <span className="inline-flex border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-amber-100">
            proposal chip - prop-room-1842
          </span>
        </div>
        <label className="grid gap-2">
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-ink/48">
            Propose-only input
          </span>
          <input
            readOnly
            value="Ask, draft, or prepare a proposal..."
            className="h-10 border border-border-subtle bg-void/50 px-3 text-sm text-ink/58 outline-none"
            aria-label="Project chat propose-only input"
          />
        </label>
      </div>
    </Panel>
  );
}

function ResearchSurface() {
  return (
    <Panel title="Specialist agents" badge="FAKE ADAPTER">
      <div className="grid gap-3">
        {AGENTS.map((agent) => (
          <article
            key={agent.id}
            className="grid gap-3 border border-border-subtle bg-void/35 p-3"
            data-agent-card={agent.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center border border-signal/30 bg-signal/10 font-mono text-xs text-signal">
                  {agent.name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")}
                </span>
                <div>
                  <h3 className="font-display text-sm text-ink">
                    {agent.name}
                  </h3>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink/48">
                    {agent.role}
                  </p>
                </div>
              </div>
              <span
                className={`border px-2 py-0.5 font-mono text-[0.58rem] uppercase ${statusPill(
                  agent.status,
                )}`}
              >
                {agent.status}
              </span>
            </div>
            <p className="text-xs leading-5 text-ink/65">{agent.description}</p>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-ink/48">
              <span>{agent.runs} runs</span>
              <span>{agent.model}</span>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function BuildSurface() {
  return (
    <Panel title="Phase and test status" badge="FAKE ADAPTER">
      <div className="grid gap-4">
        {PHASES.map((phase) => (
          <div key={phase.name} className="border border-border-subtle p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-display text-ink">{phase.name}</span>
              <span className="font-mono text-xs text-signal">
                {phase.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink/58">{phase.sub}</p>
            <div className="mt-3 h-1.5 bg-white/8">
              <span
                className="block h-full bg-signal"
                style={{ width: `${phase.pct}%` }}
              />
            </div>
          </div>
        ))}
        <div className="grid gap-2">
          {TEST_SUITES.map((suite) => (
            <div
              key={suite.name}
              className="flex items-center justify-between border border-border-subtle bg-void/30 px-3 py-2 text-xs"
            >
              <span>{suite.name}</span>
              <span className="font-mono uppercase text-ink/58">
                {suite.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function BriefSurface() {
  return (
    <Panel title="Digest cards" badge="FAKE ADAPTER">
      <div className="grid gap-3">
        <DigestCard
          label="Schedule"
          title="Two protected build blocks"
          body="Morning focus is clear until 11:30. One meeting needs prep context."
        />
        <DigestCard
          label="JARVIS"
          title="Phase 12 cockpit is active"
          body="Gate-only mutation tests are the closeout condition for this UI slice."
        />
        <DigestCard
          label="Finance"
          title="Cloud spend remains low"
          body="Local-first routing is holding; no budget proposal is needed."
        />
      </div>
    </Panel>
  );
}

function ResearchOrchestrator() {
  return (
    <Panel
      title="Research orchestrator"
      badge="FAKE ADAPTER"
      className="col-span-3 min-h-[140px]"
    >
      <div className="grid h-full gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
        <Metric label="active question" value="project registry density" />
        <Metric label="specialists" value="3 display-only agents" />
        <Metric label="routing posture" value="proposal-only" />
      </div>
    </Panel>
  );
}

function HumanGatePanel({
  proposals,
  onResolve,
}: Readonly<{
  proposals: readonly ProposalDraft[];
  onResolve: (proposal: ProposalDraft, approved: boolean) => void;
}>) {
  return (
    <article
      className="grid min-h-0 grid-rows-[52px_minmax(0,1fr)] border border-amber-300/58 bg-[linear-gradient(180deg,rgba(245,158,11,0.18),rgba(15,9,2,0.54))] shadow-[inset_0_0_52px_rgba(245,158,11,0.16),0_20px_90px_rgba(0,0,0,0.36)]"
      data-human-gate-panel="true"
      data-mutator-entrypoint="resolveProposal"
      data-only-path-to-side-effects="true"
    >
      <header className="ph flex items-center justify-between border-b border-amber-300/34 px-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-amber-50">
            Human Gate
          </h2>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-amber-100/62">
            approve, deny, verify, audit
          </p>
        </div>
        <span
          className={`border px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.12em] ${badgeClass("ONLY PATH TO SIDE EFFECTS")}`}
        >
          only path to side effects
        </span>
      </header>
      <div className="pb min-h-0 overflow-auto p-4">
        {proposals.length === 0 ? (
          <div className="grid h-full place-items-center border border-amber-200/18 bg-void/30 p-6 text-center">
            <p className="max-w-xs text-sm leading-6 text-amber-50/72">
              No pending proposals. Workflow surfaces may prepare intent, but
              nothing reaches a side effect until it appears here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {proposals.map((proposal) => (
              <article
                key={proposal.id}
                className="grid gap-3 border border-amber-200/28 bg-void/45 p-4"
                data-proposal-card={proposal.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-amber-100/62">
                      {proposal.id} - {proposal.kind} - {proposal.tier}
                    </p>
                    <h3 className="mt-2 font-display text-base text-amber-50">
                      {proposal.title}
                    </h3>
                  </div>
                </div>
                <div className="border border-amber-200/18 bg-amber-950/22 p-3">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-amber-100/54">
                    dry-run diff
                  </p>
                  <p className="mt-1 text-sm text-amber-50/82">
                    {proposal.dryRunDiff}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-amber-100/54">
                    {proposal.expiresIn}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="wc-gate-button wc-gate-deny border border-rose-300/28 bg-rose-300/10 px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-rose-100 transition-colors hover:border-rose-200/50 hover:bg-rose-300/16"
                      onClick={() => onResolve(proposal, false)}
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      className="wc-gate-button wc-gate-approve border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-emerald-100 transition-colors hover:border-emerald-200/55 hover:bg-emerald-300/16"
                      onClick={() => onResolve(proposal, true)}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function ContextColumn({
  workflow,
  activity,
}: Readonly<{ workflow: WorkflowId; activity: readonly ActivityEvent[] }>) {
  if (workflow === "research") {
    return (
      <div className="grid min-h-0 gap-4">
        <VaultState />
        <RecentActivity activity={activity} />
      </div>
    );
  }
  if (workflow === "build") {
    return (
      <div className="grid min-h-0 gap-4">
        <AlertsPanel />
        <RecentActivity activity={activity} />
      </div>
    );
  }
  if (workflow === "brief") {
    return (
      <div className="grid min-h-0 gap-4">
        <SuggestionInbox />
        <RecentActivity activity={activity} />
      </div>
    );
  }
  return (
    <div className="grid min-h-0 gap-4">
      <RoomPanel />
      <CostPanel />
      <RecentActivity activity={activity} />
    </div>
  );
}

function RoomPanel() {
  return (
    <Panel title="Room" badge="FAKE ADAPTER" readOnly>
      <div className="grid gap-2">
        {ROOM_DEVICES.map((device) => (
          <div
            key={device.name}
            className="grid grid-cols-[1fr_auto] gap-2 border border-border-subtle bg-void/30 p-3 text-xs"
          >
            <div>
              <p className="font-display text-sm text-ink">{device.name}</p>
              <p className="mt-1 text-ink/50">{device.zone}</p>
            </div>
            <div className="text-right font-mono text-[0.62rem] uppercase text-ink/58">
              <p>{device.state}</p>
              <p>{device.trust}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CostPanel() {
  return (
    <Panel title="Cost" badge="FAKE ADAPTER" readOnly>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="today" value="$1.82 / $8.00" />
        <Metric label="week" value="$11.40 / $40.00" />
        <Metric label="local" value="76%" />
        <Metric label="cloud" value="24%" />
      </div>
    </Panel>
  );
}

function RecentActivity({
  activity,
}: Readonly<{ activity: readonly ActivityEvent[] }>) {
  return (
    <Panel title="Activity" badge="FAKE ADAPTER" readOnly>
      <div className="grid gap-2">
        {activity.map((event) => (
          <div
            key={`${event.ts}-${event.text}`}
            className="border border-border-subtle bg-void/30 p-3 text-xs"
          >
            <p className={`font-mono uppercase ${eventClass(event.kind)}`}>
              {event.ts} - {event.kind}
            </p>
            <p className="mt-1 leading-5 text-ink/68">{event.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function VaultState() {
  return (
    <Panel title="Vault state" badge="FAKE ADAPTER" readOnly>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="total" value="1,284" />
        <Metric label="indexed" value="1,244" />
        <Metric label="sparse" value="18" />
        <Metric label="last run" value="09:12" />
      </div>
    </Panel>
  );
}

function AlertsPanel() {
  return (
    <Panel title="Alerts and deadlines" badge="FAKE ADAPTER" readOnly>
      <div className="grid gap-2">
        <DigestCard
          label="Deadline"
          title="Phase 12 closeout"
          body="Gate invariant tests must remain green before production wiring."
        />
        <DigestCard
          label="Test health"
          title="Expiry enforcement pending"
          body="Prototype display is present; service enforcement belongs to Phase 18."
        />
      </div>
    </Panel>
  );
}

function SuggestionInbox() {
  return (
    <Panel title="Suggestion inbox" badge="FAKE ADAPTER" readOnly>
      <div className="grid gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <DigestCard
            key={suggestion.title}
            label={suggestion.label}
            title={suggestion.title}
            body={
              suggestion.canPropose
                ? `${suggestion.body} Proposal available through the gate.`
                : suggestion.body
            }
          />
        ))}
      </div>
    </Panel>
  );
}

function StatusBar({
  active,
  pendingCount,
}: Readonly<{ active: Workflow; pendingCount: number }>) {
  return (
    <footer className="grid h-11 grid-cols-6 items-center border-t border-border-subtle bg-void/68 px-5 font-mono text-[0.64rem] uppercase tracking-[0.13em] text-ink/58">
      <span>Status: nominal</span>
      <span>Tests: 907 pass</span>
      <span>Gate: {pendingCount} pending</span>
      <span>Runtime: local first</span>
      <span>{active.label}</span>
      <span>Build: phase 12</span>
    </footer>
  );
}

function SidebarSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="grid gap-2">
      <h2 className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink/42">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Readout({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 border border-border-subtle bg-panel-soft px-2 py-1">
      <dt className="text-ink/38">{label}</dt>
      <dd className="mt-0.5 truncate text-ink/78">{value}</dd>
    </div>
  );
}

function Message({ who, text }: Readonly<{ who: string; text: string }>) {
  return (
    <div className="border border-border-subtle bg-void/30 p-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-signal">
        {who}
      </p>
      <p className="mt-1 text-sm leading-6 text-ink/72">{text}</p>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border border-border-subtle bg-void/30 p-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink/45">
        {label}
      </p>
      <p className="mt-2 font-display text-base text-ink">{value}</p>
    </div>
  );
}

function DigestCard({
  label,
  title,
  body,
}: Readonly<{ label: string; title: string; body: string }>) {
  return (
    <article className="border border-border-subtle bg-void/30 p-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-signal">
        {label}
      </p>
      <h3 className="mt-1 font-display text-sm text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-ink/62">{body}</p>
    </article>
  );
}
