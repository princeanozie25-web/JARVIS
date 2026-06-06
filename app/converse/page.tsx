"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApprovalCard,
  type ApprovalCardDetails,
} from "@/components/ApprovalCard";
import { ConsentManifestPanel } from "@/components/ConsentManifestPanel";
import {
  ConversationCuratorPanel,
  type CuratorActionRequest,
} from "@/components/ConversationCuratorPanel";
import { GoalContinuityPanel } from "@/components/GoalContinuityPanel";
import { HumanReviewQueuePanel } from "@/components/HumanReviewQueuePanel";
import { KeeperInterfacePanel } from "@/components/KeeperInterfacePanel";
import { MemoryCandidateReviewPanel } from "@/components/MemoryCandidateReviewPanel";
import { MemoryInspectorPanel } from "@/components/MemoryInspectorPanel";
import { MemoryWeightingPreviewPanel } from "@/components/MemoryWeightingPreviewPanel";
import { PreferenceLedgerPanel } from "@/components/PreferenceLedgerPanel";
import { ProjectContinuityPanel } from "@/components/ProjectContinuityPanel";
import { ReflectionPromptPanel } from "@/components/ReflectionPromptPanel";
import {
  ResurfacedIdeasPanel,
  type SurfacedMemory,
} from "@/components/ResurfacedIdeasPanel";
import { RollbackStatusPanel } from "@/components/RollbackStatusPanel";
import { RuntimeCommandPanel } from "@/components/RuntimeCommandPanel";
import { TimelineIndexPanel } from "@/components/TimelineIndexPanel";
import { VoiceControlPanel } from "@/components/VoiceControlPanel";
import { SUPPORTED_PROVIDERS, type SupportedProvider } from "@/lib/chat/schema";
import type { VoiceTranscriptChatPayload } from "@/lib/stt";
import type {
  ApiApprovalDecision,
  CuratorAuditRow,
  CuratorRecordRow,
  GoalRow,
  GoalStatus,
  MemoryCandidateRow,
  PreferenceRow,
  ProjectStateRow,
  SessionSummaryRow,
} from "@/lib/db/node";
import type {
  LongTermMemoryCategory,
  LongTermMemoryRow,
  SearchableMemorySensitivity,
} from "@/lib/memory/types";
import type { ConsentFeatureId, ConsentManifest } from "@/lib/consent/types";
import type { HumanReviewItem, HumanReviewStatus } from "@/lib/human-review";
import type { KeeperMetadata } from "@/lib/keepers";
import type {
  ReflectionPrompt,
  ReflectionPromptTemplateType,
} from "@/lib/reflection-prompts";
import type { RollbackSummary } from "@/lib/rollbacks/visibility";
import { parseSseEvents } from "@/lib/streaming/sse";
import type { TimelineEntry, TimelineEntryType } from "@/lib/timeline";
import type {
  MemoryWeightingItemType,
  MemoryWeightingProjection,
} from "@/lib/memory-weighting";
import type { Message } from "@/lib/types";

import {
  canSendTypedChatInput,
  type VoiceDraftInputMarker,
  voiceDraftMarkerAfterInputChange,
  voiceDraftPayloadToChatInputState,
} from "./voice-draft-input";

const MAX_MESSAGES_TO_SEND = 50;

type UiMessage = Message & {
  id: string;
  approval?: ApprovalCardDetails;
  surfacedMemories?: SurfacedMemory[];
  surfacedMemoryExecutionId?: string;
};

type ApiMessage = Message & {
  id: string;
};

function createMessage(role: Message["role"], content: string): UiMessage {
  return {
    id: globalThis.crypto.randomUUID(),
    role,
    content,
  };
}

function toApiMessage(message: UiMessage): ApiMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
  };
}

function surfacedMemoriesFromToolData(data: unknown): SurfacedMemory[] {
  if (!data || typeof data !== "object") return [];
  const payload = data as {
    retrievalMode?: unknown;
    results?: unknown;
  };
  const retrievalMode =
    payload.retrievalMode === "vector_only" ||
    payload.retrievalMode === "hybrid"
      ? payload.retrievalMode
      : "keyword_only";
  if (!Array.isArray(payload.results)) return [];

  return payload.results.flatMap((item): SurfacedMemory[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.content !== "string" ||
      !["fact", "preference", "event", "decision"].includes(
        String(row.category),
      ) ||
      !["public", "personal", "sensitive", "restricted"].includes(
        String(row.sensitivity),
      )
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        category: row.category as SurfacedMemory["category"],
        content: row.content,
        project: typeof row.project === "string" ? row.project : null,
        tags: Array.isArray(row.tags)
          ? row.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        sensitivity: row.sensitivity as SurfacedMemory["sensitivity"],
        retrievalMode,
        score:
          row.score && typeof row.score === "object"
            ? (row.score as SurfacedMemory["score"])
            : undefined,
      },
    ];
  });
}

export default function Home() {
  const [messages, setMessages] = useState<UiMessage[]>([
    createMessage("assistant", "JARVIS online. How can I help?"),
  ]);

  const [input, setInput] = useState("");
  const [voiceDraftInput, setVoiceDraftInput] =
    useState<VoiceDraftInputMarker | null>(null);
  const [provider, setProvider] = useState<SupportedProvider>("openai");
  const [loading, setLoading] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRollback, setLatestRollback] = useState<RollbackSummary | null>(
    null,
  );
  const [projectStates, setProjectStates] = useState<ProjectStateRow[]>([]);
  const [projectStatesLoading, setProjectStatesLoading] = useState(false);
  const [memoryCandidates, setMemoryCandidates] = useState<
    MemoryCandidateRow[]
  >([]);
  const [memoryCandidatesLoading, setMemoryCandidatesLoading] = useState(false);
  const [consentManifest, setConsentManifest] =
    useState<ConsentManifest | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentUpdatingFeatureId, setConsentUpdatingFeatureId] =
    useState<ConsentFeatureId | null>(null);
  const [preferences, setPreferences] = useState<PreferenceRow[]>([]);
  const [effectivePreferences, setEffectivePreferences] = useState<
    PreferenceRow[]
  >([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferenceAdding, setPreferenceAdding] = useState(false);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalCreating, setGoalCreating] = useState(false);
  const [goalUpdatingId, setGoalUpdatingId] = useState<string | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineType, setTimelineType] = useState<TimelineEntryType | "">("");
  const [memoryWeights, setMemoryWeights] = useState<
    MemoryWeightingProjection[]
  >([]);
  const [memoryWeightsLoading, setMemoryWeightsLoading] = useState(false);
  const [memoryWeightingItemType, setMemoryWeightingItemType] = useState<
    MemoryWeightingItemType | ""
  >("");
  const [curatorSummaries, setCuratorSummaries] = useState<SessionSummaryRow[]>(
    [],
  );
  const [curatorCandidates, setCuratorCandidates] = useState<
    MemoryCandidateRow[]
  >([]);
  const [curatorRecords, setCuratorRecords] = useState<CuratorRecordRow[]>([]);
  const [curatorAudit, setCuratorAudit] = useState<CuratorAuditRow[]>([]);
  const [curatorLoading, setCuratorLoading] = useState(false);
  const [curatorSubmitting, setCuratorSubmitting] = useState(false);
  const [reviewItems, setReviewItems] = useState<HumanReviewItem[]>([]);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [reviewQueueUpdatingId, setReviewQueueUpdatingId] = useState<
    string | null
  >(null);
  const [reflectionPrompt, setReflectionPrompt] =
    useState<ReflectionPrompt | null>(null);
  const [reflectionPromptLoading, setReflectionPromptLoading] = useState(false);
  const [reflectionPromptTemplate, setReflectionPromptTemplate] =
    useState<ReflectionPromptTemplateType>("timeline_reflection");
  const [keepers, setKeepers] = useState<KeeperMetadata[]>([]);
  const [keepersLoading, setKeepersLoading] = useState(false);
  const [memories, setMemories] = useState<LongTermMemoryRow[]>([]);
  const [memoryVaultRoot, setMemoryVaultRoot] = useState<string | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<
    LongTermMemoryCategory | ""
  >("");
  const [memoryProject, setMemoryProject] = useState("");
  const [memoryTag, setMemoryTag] = useState("");
  const [memorySensitivityCeiling, setMemorySensitivityCeiling] =
    useState<SearchableMemorySensitivity>("personal");
  const [memoryMaxResults, setMemoryMaxResults] = useState(20);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(globalThis.crypto.randomUUID());
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const preferencesConsentEnabled =
    consentManifest?.records.find(
      (record) => record.feature_id === "preferences",
    )?.enabled ?? false;
  const goalsConsentEnabled =
    consentManifest?.records.find((record) => record.feature_id === "goals")
      ?.enabled ?? false;
  const timelineConsentEnabled =
    consentManifest?.records.find((record) => record.feature_id === "timeline")
      ?.enabled ?? false;
  const memoryWeightingConsentEnabled =
    consentManifest?.records.find(
      (record) => record.feature_id === "memory_weighting",
    )?.enabled ?? false;
  const conversationCuratorConsentEnabled =
    consentManifest?.records.find(
      (record) => record.feature_id === "conversation_curator",
    )?.enabled ?? false;
  const humanReviewQueueConsentEnabled =
    consentManifest?.records.find(
      (record) => record.feature_id === "human_review_queue",
    )?.enabled ?? false;
  const reflectionPromptsConsentEnabled =
    consentManifest?.records.find(
      (record) => record.feature_id === "reflection_prompts",
    )?.enabled ?? false;
  const keeperInterfaceConsentEnabled =
    consentManifest?.records.find(
      (record) => record.feature_id === "keeper_interface",
    )?.enabled ?? false;

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, error]);

  useEffect(() => {
    let cancelled = false;
    async function loadLatestRollback() {
      try {
        const res = await fetch(
          `/api/rollbacks/latest?sessionId=${encodeURIComponent(
            sessionIdRef.current,
          )}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          latest: RollbackSummary | null;
        };
        if (!cancelled) {
          setLatestRollback(data.latest);
        }
      } catch {
        if (!cancelled) {
          setLatestRollback(null);
        }
      }
    }
    void loadLatestRollback();
    return () => {
      cancelled = true;
    };
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemories() {
      setMemoryLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(memoryMaxResults),
          sensitivityCeiling: memorySensitivityCeiling,
        });
        if (memoryQuery.trim()) params.set("q", memoryQuery.trim());
        if (memoryCategory) params.set("category", memoryCategory);
        if (memoryProject.trim()) params.set("project", memoryProject.trim());
        if (memoryTag.trim()) params.set("tag", memoryTag.trim());
        const res = await fetch(`/api/memory?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          vaultRoot: string;
          memories: LongTermMemoryRow[];
        };
        if (!cancelled) {
          setMemoryVaultRoot(data.vaultRoot);
          setMemories(data.memories);
        }
      } catch {
        if (!cancelled) {
          setMemories([]);
        }
      } finally {
        if (!cancelled) {
          setMemoryLoading(false);
        }
      }
    }
    void loadMemories();
    return () => {
      cancelled = true;
    };
  }, [
    messages,
    loading,
    memoryQuery,
    memoryCategory,
    memoryProject,
    memoryTag,
    memorySensitivityCeiling,
    memoryMaxResults,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadProjectStates() {
      setProjectStatesLoading(true);
      try {
        const res = await fetch("/api/projects?limit=20");
        if (!res.ok) return;
        const data = (await res.json()) as {
          projects: ProjectStateRow[];
        };
        if (!cancelled) {
          setProjectStates(data.projects);
        }
      } catch {
        if (!cancelled) {
          setProjectStates([]);
        }
      } finally {
        if (!cancelled) {
          setProjectStatesLoading(false);
        }
      }
    }
    void loadProjectStates();
    return () => {
      cancelled = true;
    };
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemoryCandidates() {
      setMemoryCandidatesLoading(true);
      try {
        const res = await fetch(
          `/api/memory/candidates?sessionId=${encodeURIComponent(
            sessionIdRef.current,
          )}&limit=20`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          candidates: MemoryCandidateRow[];
        };
        if (!cancelled) {
          setMemoryCandidates(data.candidates);
        }
      } catch {
        if (!cancelled) {
          setMemoryCandidates([]);
        }
      } finally {
        if (!cancelled) {
          setMemoryCandidatesLoading(false);
        }
      }
    }
    void loadMemoryCandidates();
    return () => {
      cancelled = true;
    };
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;
    async function loadConsentManifest() {
      setConsentLoading(true);
      try {
        const res = await fetch("/api/consent");
        if (!res.ok) return;
        const data = (await res.json()) as {
          manifest: ConsentManifest;
        };
        if (!cancelled) {
          setConsentManifest(data.manifest);
        }
      } catch {
        if (!cancelled) {
          setConsentManifest(null);
        }
      } finally {
        if (!cancelled) {
          setConsentLoading(false);
        }
      }
    }
    void loadConsentManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPreferences() {
      if (!preferencesConsentEnabled) {
        setPreferences([]);
        setEffectivePreferences([]);
        setPreferencesLoading(false);
        return;
      }
      setPreferencesLoading(true);
      try {
        const res = await fetch("/api/preferences?limit=100");
        if (!res.ok) return;
        const data = (await res.json()) as {
          preferences: PreferenceRow[];
          current: PreferenceRow[];
        };
        if (!cancelled) {
          setPreferences(data.preferences);
          setEffectivePreferences(data.current);
        }
      } catch {
        if (!cancelled) {
          setPreferences([]);
          setEffectivePreferences([]);
        }
      } finally {
        if (!cancelled) {
          setPreferencesLoading(false);
        }
      }
    }
    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [preferencesConsentEnabled]);

  useEffect(() => {
    let cancelled = false;
    async function loadGoals() {
      if (!goalsConsentEnabled) {
        setGoals([]);
        setGoalsLoading(false);
        return;
      }
      setGoalsLoading(true);
      try {
        const res = await fetch("/api/goals?limit=100");
        if (!res.ok) return;
        const data = (await res.json()) as {
          goals: GoalRow[];
        };
        if (!cancelled) {
          setGoals(data.goals);
        }
      } catch {
        if (!cancelled) {
          setGoals([]);
        }
      } finally {
        if (!cancelled) {
          setGoalsLoading(false);
        }
      }
    }
    void loadGoals();
    return () => {
      cancelled = true;
    };
  }, [goalsConsentEnabled]);

  useEffect(() => {
    let cancelled = false;
    async function loadTimeline() {
      if (!timelineConsentEnabled) {
        setTimelineEntries([]);
        setTimelineLoading(false);
        return;
      }
      setTimelineLoading(true);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (timelineType) params.set("type", timelineType);
        const res = await fetch(`/api/timeline?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          entries: TimelineEntry[];
        };
        if (!cancelled) {
          setTimelineEntries(data.entries);
        }
      } catch {
        if (!cancelled) {
          setTimelineEntries([]);
        }
      } finally {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      }
    }
    void loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [timelineConsentEnabled, timelineType, goals, preferences]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemoryWeights() {
      if (!memoryWeightingConsentEnabled) {
        setMemoryWeights([]);
        setMemoryWeightsLoading(false);
        return;
      }
      setMemoryWeightsLoading(true);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (memoryWeightingItemType) {
          params.set("itemType", memoryWeightingItemType);
        }
        const res = await fetch(`/api/memory/weighting?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          weights: MemoryWeightingProjection[];
        };
        if (!cancelled) {
          setMemoryWeights(data.weights);
        }
      } catch {
        if (!cancelled) {
          setMemoryWeights([]);
        }
      } finally {
        if (!cancelled) {
          setMemoryWeightsLoading(false);
        }
      }
    }
    void loadMemoryWeights();
    return () => {
      cancelled = true;
    };
  }, [
    memoryWeightingConsentEnabled,
    memoryWeightingItemType,
    memories,
    memoryCandidates,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadCuratorWorkspace() {
      if (!conversationCuratorConsentEnabled) {
        setCuratorSummaries([]);
        setCuratorCandidates([]);
        setCuratorRecords([]);
        setCuratorAudit([]);
        setCuratorLoading(false);
        return;
      }
      setCuratorLoading(true);
      try {
        const res = await fetch("/api/curator?limit=50");
        if (!res.ok) return;
        const data = (await res.json()) as {
          summaries: SessionSummaryRow[];
          candidates: MemoryCandidateRow[];
          records: CuratorRecordRow[];
          audit: CuratorAuditRow[];
        };
        if (!cancelled) {
          setCuratorSummaries(data.summaries);
          setCuratorCandidates(data.candidates);
          setCuratorRecords(data.records);
          setCuratorAudit(data.audit);
        }
      } catch {
        if (!cancelled) {
          setCuratorSummaries([]);
          setCuratorCandidates([]);
          setCuratorRecords([]);
          setCuratorAudit([]);
        }
      } finally {
        if (!cancelled) {
          setCuratorLoading(false);
        }
      }
    }
    void loadCuratorWorkspace();
    return () => {
      cancelled = true;
    };
  }, [conversationCuratorConsentEnabled, memoryCandidates]);

  useEffect(() => {
    let cancelled = false;
    async function loadReviewQueue() {
      if (!humanReviewQueueConsentEnabled) {
        setReviewItems([]);
        setReviewQueueLoading(false);
        return;
      }
      setReviewQueueLoading(true);
      try {
        const res = await fetch("/api/review-queue?limit=100");
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: HumanReviewItem[];
        };
        if (!cancelled) {
          setReviewItems(data.items);
        }
      } catch {
        if (!cancelled) {
          setReviewItems([]);
        }
      } finally {
        if (!cancelled) {
          setReviewQueueLoading(false);
        }
      }
    }
    void loadReviewQueue();
    return () => {
      cancelled = true;
    };
  }, [
    humanReviewQueueConsentEnabled,
    memoryCandidates,
    curatorAudit,
    memoryWeights,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadKeepers() {
      if (!keeperInterfaceConsentEnabled) {
        setKeepers([]);
        setKeepersLoading(false);
        return;
      }
      setKeepersLoading(true);
      try {
        const res = await fetch("/api/keepers");
        if (!res.ok) return;
        const data = (await res.json()) as {
          keepers: KeeperMetadata[];
        };
        if (!cancelled) {
          setKeepers(data.keepers);
        }
      } catch {
        if (!cancelled) {
          setKeepers([]);
        }
      } finally {
        if (!cancelled) {
          setKeepersLoading(false);
        }
      }
    }
    void loadKeepers();
    return () => {
      cancelled = true;
    };
  }, [keeperInterfaceConsentEnabled]);

  function stop() {
    abortRef.current?.abort();
  }

  function applyVoiceDraftToInput(payload: VoiceTranscriptChatPayload) {
    const next = voiceDraftPayloadToChatInputState(payload);
    if (!next) return;
    setInput(next.input);
    setVoiceDraftInput(next.marker);
  }

  function updateInput(value: string) {
    setInput(value);
    setVoiceDraftInput((current) =>
      voiceDraftMarkerAfterInputChange(value, current),
    );
  }

  async function sendMessage() {
    if (!canSendTypedChatInput(input, loading)) return;

    const assistantMessageId = globalThis.crypto.randomUUID();
    const newMessages: UiMessage[] = [
      ...messages,
      createMessage("user", input),
    ];

    setMessages(newMessages);
    setInput("");
    setVoiceDraftInput(null);
    setLoading(true);
    setStreamingStarted(false);
    setError(null);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          assistantMessageId,
          messages: newMessages.slice(-MAX_MESSAGES_TO_SEND).map(toApiMessage),
          provider,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        setError(`Request failed (${res.status}). Please try again.`);
        return;
      }

      if (!res.body) {
        setError("Empty response from server.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      setMessages([
        ...newMessages,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parsed = parseSseEvents(buffer);
        buffer = parsed.remaining;
        for (const event of parsed.events) {
          if (event.type === "text") {
            setStreamingStarted(true);
            assistantContent += event.value;
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: assistantContent }
                  : message,
              ),
            );
          } else if (event.type === "tool_pending") {
            setStreamingStarted(true);
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content: "Approval required before this tool can run.",
                      approval: {
                        executionId: event.executionId,
                        toolId: event.toolId,
                        toolName: event.toolName,
                        scopeHash: event.scopeHash,
                        requiredSafetyTag: event.requiredSafetyTag,
                        safetyTag: event.safetyTag,
                        summary: event.summary,
                        approvalExpiresAt: event.approvalExpiresAt,
                        approvalToken: event.approvalToken,
                        status: "pending",
                      },
                    }
                  : message,
              ),
            );
          } else if (
            event.type === "tool_completed" &&
            event.toolId === "memory.recall"
          ) {
            const surfacedMemories = surfacedMemoriesFromToolData(event.data);
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      surfacedMemories,
                      surfacedMemoryExecutionId: event.executionId,
                    }
                  : message,
              ),
            );
          } else if (event.type === "error") {
            if (!event.recoverable) {
              setError(event.message);
            }
            return;
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      setError("Network error. Please check your connection and try again.");
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreamingStarted(false);
    }
  }

  function askUndo() {
    if (loading) return;
    setInput("Undo the last file change");
  }

  async function submitApproval(
    messageId: string,
    executionId: string,
    approvalToken: string,
    decision: ApiApprovalDecision,
  ) {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId && message.approval
          ? {
              ...message,
              approval: { ...message.approval, status: "submitting" },
            }
          : message,
      ),
    );

    try {
      const res = await fetch(`/api/chat/approvals/${executionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, approvalToken }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        status?: string;
      };

      if (!res.ok) {
        const expired = res.status === 410;
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === messageId && message.approval
              ? {
                  ...message,
                  approval: {
                    ...message.approval,
                    status: expired ? "expired" : "denied",
                  },
                }
              : message,
          ),
        );
        setError(data.message ?? "Approval request failed.");
        return;
      }

      const approved = decision !== "DENIED" && data.ok === true;
      const nextStatus: ApprovalCardDetails["status"] = approved
        ? "approved"
        : "denied";
      setMessages((currentMessages) => [
        ...currentMessages.map((message) =>
          message.id === messageId && message.approval
            ? {
                ...message,
                approval: {
                  ...message.approval,
                  status: nextStatus,
                },
              }
            : message,
        ),
        createMessage(
          "assistant",
          data.message ??
            (approved ? "Tool completed." : "Tool execution denied."),
        ),
      ]);
    } catch {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId && message.approval
            ? {
                ...message,
                approval: { ...message.approval, status: "pending" },
              }
            : message,
        ),
      );
      setError("Approval request failed. Please try again.");
    }
  }

  function reportSurfacedMemories(
    memories: SurfacedMemory[],
    executionId?: string,
  ) {
    if (memories.length === 0) return;
    void fetch("/api/memory/surfaced", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        executionId,
        retrievalMode: memories[0]?.retrievalMode ?? "keyword_only",
        memoryIds: memories.map((memory) => memory.id),
      }),
    }).catch(() => undefined);
  }

  async function rejectMemoryCandidate(candidateId: string) {
    setMemoryCandidates((current) =>
      current.map((candidate) =>
        candidate.id === candidateId
          ? {
              ...candidate,
              status: "rejected",
              reviewed_at: Date.now(),
            }
          : candidate,
      ),
    );
    try {
      const res = await fetch(`/api/memory/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { candidate: MemoryCandidateRow };
      setMemoryCandidates((current) =>
        current.map((candidate) =>
          candidate.id === candidateId ? data.candidate : candidate,
        ),
      );
    } catch {
      return;
    }
  }

  async function toggleConsent(featureId: ConsentFeatureId, enabled: boolean) {
    setConsentUpdatingFeatureId(featureId);
    try {
      const res = await fetch("/api/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId, enabled }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        manifest: ConsentManifest;
      };
      setConsentManifest(data.manifest);
      if (!enabled && featureId === "reflection_prompts") {
        setReflectionPrompt(null);
        setReflectionPromptLoading(false);
      }
    } catch {
      return;
    } finally {
      setConsentUpdatingFeatureId(null);
    }
  }

  async function addPreference(input: {
    key: string;
    value: string;
    category: string;
  }) {
    setPreferenceAdding(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return;

      const refresh = await fetch("/api/preferences?limit=100");
      if (!refresh.ok) return;
      const data = (await refresh.json()) as {
        preferences: PreferenceRow[];
        current: PreferenceRow[];
      };
      setPreferences(data.preferences);
      setEffectivePreferences(data.current);
    } catch {
      return;
    } finally {
      setPreferenceAdding(false);
    }
  }

  async function refreshGoals() {
    const res = await fetch("/api/goals?limit=100");
    if (!res.ok) return;
    const data = (await res.json()) as {
      goals: GoalRow[];
    };
    setGoals(data.goals);
  }

  async function createGoal(input: {
    title: string;
    parentId?: string | null;
  }) {
    setGoalCreating(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return;
      await refreshGoals();
    } catch {
      return;
    } finally {
      setGoalCreating(false);
    }
  }

  async function updateGoalStatus(id: string, status: GoalStatus) {
    setGoalUpdatingId(id);
    try {
      const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status }),
      });
      if (!res.ok) return;
      await refreshGoals();
    } catch {
      return;
    } finally {
      setGoalUpdatingId(null);
    }
  }

  async function touchGoal(id: string) {
    setGoalUpdatingId(id);
    try {
      const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "touch" }),
      });
      if (!res.ok) return;
      await refreshGoals();
    } catch {
      return;
    } finally {
      setGoalUpdatingId(null);
    }
  }

  async function refreshCuratorWorkspace() {
    const res = await fetch("/api/curator?limit=50");
    if (!res.ok) return;
    const data = (await res.json()) as {
      summaries: SessionSummaryRow[];
      candidates: MemoryCandidateRow[];
      records: CuratorRecordRow[];
      audit: CuratorAuditRow[];
    };
    setCuratorSummaries(data.summaries);
    setCuratorCandidates(data.candidates);
    setCuratorRecords(data.records);
    setCuratorAudit(data.audit);
  }

  async function runCuratorAction(input: CuratorActionRequest) {
    setCuratorSubmitting(true);
    try {
      const res = await fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return;
      await refreshCuratorWorkspace();
    } catch {
      return;
    } finally {
      setCuratorSubmitting(false);
    }
  }

  async function refreshReviewQueue() {
    const res = await fetch("/api/review-queue?limit=100");
    if (!res.ok) return;
    const data = (await res.json()) as {
      items: HumanReviewItem[];
    };
    setReviewItems(data.items);
  }

  async function updateReviewItemStatus(
    id: string,
    status: Exclude<HumanReviewStatus, "dismissed">,
  ) {
    setReviewQueueUpdatingId(id);
    try {
      const res = await fetch("/api/review-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) return;
      await refreshReviewQueue();
    } catch {
      return;
    } finally {
      setReviewQueueUpdatingId(null);
    }
  }

  async function dismissReviewItem(id: string) {
    setReviewQueueUpdatingId(id);
    try {
      const res = await fetch("/api/review-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "dismissed" }),
      });
      if (!res.ok) return;
      await refreshReviewQueue();
    } catch {
      return;
    } finally {
      setReviewQueueUpdatingId(null);
    }
  }

  async function generateReflectionPrompt() {
    setReflectionPromptLoading(true);
    try {
      const res = await fetch("/api/reflection-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateType: reflectionPromptTemplate }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        prompt: ReflectionPrompt;
      };
      setReflectionPrompt(data.prompt);
    } catch {
      return;
    } finally {
      setReflectionPromptLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6">
      <section className="w-full max-w-3xl flex-1">
        <h1 className="text-4xl font-bold tracking-widest mb-2">JARVIS</h1>
        <p className="text-gray-400 mb-8">Personal AI Operating Environment</p>

        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-xl ${
                message.role === "user"
                  ? "bg-blue-600 ml-12"
                  : "bg-gray-900 mr-12"
              }`}
            >
              <p className="text-sm text-gray-300 mb-1 uppercase">
                {message.role}
              </p>
              <p>{message.content}</p>
              {message.approval && (
                <ApprovalCard
                  approval={message.approval}
                  onDecision={(decision) =>
                    submitApproval(
                      message.id,
                      message.approval!.executionId,
                      message.approval!.approvalToken,
                      decision,
                    )
                  }
                />
              )}
              {message.surfacedMemories && (
                <ResurfacedIdeasPanel
                  memories={message.surfacedMemories}
                  onShown={(visibleMemories) =>
                    reportSurfacedMemories(
                      visibleMemories,
                      message.surfacedMemoryExecutionId,
                    )
                  }
                />
              )}
            </div>
          ))}

          {loading && !streamingStarted && (
            <div className="bg-gray-900 mr-12 p-4 rounded-xl">
              JARVIS is thinking...
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="border border-red-500 bg-red-950 text-red-200 mr-12 p-4 rounded-xl"
            >
              <p className="text-sm text-red-400 mb-1 uppercase">Error</p>
              <p>{error}</p>
            </div>
          )}
          <div ref={scrollAnchorRef} />
        </div>
      </section>

      <section className="w-full max-w-3xl flex gap-3 mt-6">
        <RollbackStatusPanel
          latest={latestRollback}
          disabled={loading}
          onUndo={askUndo}
        />
      </section>

      <RuntimeCommandPanel />

      <VoiceControlPanel onVoiceDraftSubmitted={applyVoiceDraftToInput} />

      <MemoryInspectorPanel
        memories={memories}
        vaultRoot={memoryVaultRoot}
        loading={memoryLoading}
        query={memoryQuery}
        category={memoryCategory}
        project={memoryProject}
        tag={memoryTag}
        sensitivityCeiling={memorySensitivityCeiling}
        maxResults={memoryMaxResults}
        onQueryChange={setMemoryQuery}
        onCategoryChange={setMemoryCategory}
        onProjectChange={setMemoryProject}
        onTagChange={setMemoryTag}
        onSensitivityCeilingChange={setMemorySensitivityCeiling}
        onMaxResultsChange={(value) =>
          setMemoryMaxResults(
            Number.isFinite(value) ? Math.min(Math.max(value, 1), 20) : 8,
          )
        }
      />

      <ProjectContinuityPanel
        projects={projectStates}
        loading={projectStatesLoading}
      />

      <ConsentManifestPanel
        manifest={consentManifest}
        loading={consentLoading}
        updatingFeatureId={consentUpdatingFeatureId}
        onToggle={toggleConsent}
      />

      <PreferenceLedgerPanel
        current={effectivePreferences}
        history={preferences}
        loading={preferencesLoading}
        consentEnabled={preferencesConsentEnabled}
        adding={preferenceAdding}
        onAdd={addPreference}
      />

      <GoalContinuityPanel
        goals={goals}
        loading={goalsLoading}
        consentEnabled={goalsConsentEnabled}
        creating={goalCreating}
        updatingGoalId={goalUpdatingId}
        onCreate={createGoal}
        onUpdateStatus={updateGoalStatus}
        onTouch={touchGoal}
      />

      <TimelineIndexPanel
        entries={timelineEntries}
        loading={timelineLoading}
        consentEnabled={timelineConsentEnabled}
        selectedType={timelineType}
        onTypeChange={setTimelineType}
      />

      <ReflectionPromptPanel
        prompt={reflectionPrompt}
        selectedTemplate={reflectionPromptTemplate}
        loading={reflectionPromptLoading}
        consentEnabled={reflectionPromptsConsentEnabled}
        onTemplateChange={setReflectionPromptTemplate}
        onGenerate={generateReflectionPrompt}
      />

      <KeeperInterfacePanel
        keepers={keepers}
        loading={keepersLoading}
        consentEnabled={keeperInterfaceConsentEnabled}
      />

      <MemoryWeightingPreviewPanel
        weights={memoryWeights}
        loading={memoryWeightsLoading}
        consentEnabled={memoryWeightingConsentEnabled}
        selectedItemType={memoryWeightingItemType}
        onItemTypeChange={setMemoryWeightingItemType}
      />

      <ConversationCuratorPanel
        summaries={curatorSummaries}
        candidates={curatorCandidates}
        records={curatorRecords}
        audit={curatorAudit}
        loading={curatorLoading}
        consentEnabled={conversationCuratorConsentEnabled}
        submitting={curatorSubmitting}
        onAction={runCuratorAction}
      />

      <HumanReviewQueuePanel
        items={reviewItems}
        loading={reviewQueueLoading}
        consentEnabled={humanReviewQueueConsentEnabled}
        updatingId={reviewQueueUpdatingId}
        onUpdateStatus={updateReviewItemStatus}
        onDismiss={dismissReviewItem}
      />

      <MemoryCandidateReviewPanel
        candidates={memoryCandidates}
        loading={memoryCandidatesLoading}
        onReject={rejectMemoryCandidate}
      />

      <section className="w-full max-w-3xl flex gap-3 mt-3">
        <select
          aria-label="Provider"
          className="rounded-xl bg-gray-900 border border-gray-700 px-3 outline-none disabled:opacity-50"
          value={provider}
          onChange={(e) => setProvider(e.target.value as SupportedProvider)}
          disabled={loading}
        >
          {SUPPORTED_PROVIDERS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <input
          className="flex-1 rounded-xl bg-gray-900 border border-gray-700 p-4 outline-none disabled:opacity-50"
          value={input}
          onChange={(e) => updateInput(e.target.value)}
          placeholder="Message JARVIS..."
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />

        {loading ? (
          <button
            onClick={stop}
            className="rounded-xl bg-red-600 text-white px-6 font-semibold"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={sendMessage}
            disabled={!canSendTypedChatInput(input, loading)}
            className="rounded-xl bg-white text-black px-6 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </section>
      {voiceDraftInput && input.trim() && (
        <p className="w-full max-w-3xl mt-2 text-xs text-cyan-300">
          Reviewed voice draft loaded. Press Send manually.
        </p>
      )}
    </main>
  );
}
