import { getTranscriptionGuardFailure, transcribeWithGuard } from "./guard";
import type {
  TranscriptionInput,
  TranscriptionJob,
  TranscriptionJobTelemetryEvent,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

export interface TranscriptionJobManagerOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: TranscriptionJobTelemetryEvent,
  ) => void | Promise<void>;
  onCompletedResult?: (input: {
    job: TranscriptionJob;
    result: TranscriptionResult;
  }) => void | Promise<void>;
}

export interface StartTranscriptionJobInput {
  provider: TranscriptionProvider;
  input: TranscriptionInput;
  source: "ptt_capture";
}

interface ActiveTranscriptionJob {
  jobId: string;
  input: TranscriptionInput;
  abortController: AbortController;
}

export class InMemoryTranscriptionJobManager {
  private readonly jobs = new Map<string, TranscriptionJob>();
  private active: ActiveTranscriptionJob | null = null;

  constructor(private readonly opts: TranscriptionJobManagerOptions = {}) {}

  async startJob(input: StartTranscriptionJobInput): Promise<TranscriptionJob> {
    if (this.active) {
      const rejected = this.createJob(input.provider.id, input.source);
      this.finishJob(rejected, "rejected", {
        error: `Transcription job already active: ${this.active.jobId}`,
      });
      await this.emit("transcription_job_rejected", rejected, false);
      return { ...rejected };
    }

    const job = this.createJob(input.provider.id, input.source);
    const abortController = new AbortController();
    this.active = { jobId: job.id, input: input.input, abortController };

    const guardFailure = getTranscriptionGuardFailure(input.provider);
    if (guardFailure) {
      this.finishJob(job, "rejected", {
        error: guardFailure.reason ?? "provider_unavailable",
      });
      this.clearActive(job.id);
      await this.emit("transcription_job_rejected", job, false);
      return { ...job };
    }

    job.status = "running";
    job.startedAt = this.now();
    await this.emit("transcription_job_started", job, true);

    try {
      const result = await transcribeWithGuard(input.provider, input.input, {
        signal: abortController.signal,
      });
      if (this.isCancelled(job)) {
        return { ...job };
      }
      const completed = result.status === "completed";
      this.applyResult(job, result);
      if (completed) {
        await this.opts.onCompletedResult?.({ job: { ...job }, result });
      }
      await this.emit(
        completed ? "transcription_job_completed" : "transcription_job_failed",
        job,
        completed,
      );
      return { ...job };
    } catch (error) {
      if (this.isCancelled(job)) {
        return { ...job };
      }
      this.finishJob(job, "failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      await this.emit("transcription_job_failed", job, false);
      return { ...job };
    } finally {
      if (!this.isCancelled(job)) {
        this.clearActive(job.id);
      }
    }
  }

  async cancel(jobId: string): Promise<TranscriptionJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || this.active?.jobId !== jobId) return job ? { ...job } : null;

    this.finishJob(job, "cancelled");
    this.active.abortController.abort();
    this.clearActive(jobId);
    await this.emit("transcription_job_cancelled", job, false);
    return { ...job };
  }

  getJob(jobId: string): TranscriptionJob | null {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  getActiveJob(): TranscriptionJob | null {
    if (!this.active) return null;
    return this.getJob(this.active.jobId);
  }

  hasTransientAudioReferences(): boolean {
    return this.active?.input.chunks !== undefined;
  }

  listJobs(): TranscriptionJob[] {
    return Array.from(this.jobs.values(), (job) => ({ ...job }));
  }

  private createJob(
    providerId: string,
    source: TranscriptionJob["source"],
  ): TranscriptionJob {
    const job: TranscriptionJob = {
      id: this.newId(),
      providerId,
      status: "queued",
      createdAt: this.now(),
      source,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  private applyResult(
    job: TranscriptionJob,
    result: TranscriptionResult,
  ): void {
    if (result.status === "completed") {
      this.finishJob(job, "completed");
      return;
    }

    this.finishJob(job, "failed", {
      error: result.errorMessage ?? result.reason ?? "transcription_failed",
    });
  }

  private finishJob(
    job: TranscriptionJob,
    status: TranscriptionJob["status"],
    opts: { error?: string } = {},
  ): void {
    const completedAt = this.now();
    job.status = status;
    job.completedAt = completedAt;
    job.durationMs = Math.max(
      0,
      completedAt - (job.startedAt ?? job.createdAt),
    );
    job.error = opts.error;
  }

  private isCancelled(job: TranscriptionJob): boolean {
    return this.jobs.get(job.id)?.status === "cancelled";
  }

  private clearActive(jobId: string): void {
    if (this.active?.jobId === jobId) {
      this.active = null;
    }
  }

  private async emit(
    eventType: TranscriptionJobTelemetryEvent["eventType"],
    job: TranscriptionJob,
    success: boolean,
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      jobId: job.id,
      providerId: job.providerId,
      status: job.status,
      source: job.source,
      success,
      durationMs: job.durationMs,
      error: telemetryError(eventType, job.error),
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? globalThis.crypto.randomUUID();
  }
}

function telemetryError(
  eventType: TranscriptionJobTelemetryEvent["eventType"],
  error: string | undefined,
): string | undefined {
  if (!error) return undefined;
  if (
    error === "provider_disabled" ||
    error === "provider_unavailable" ||
    error === "not_configured" ||
    error === "not_installed" ||
    error === "transcription_failed"
  ) {
    return error;
  }
  if (eventType === "transcription_job_rejected") {
    return "active_job_exists";
  }
  if (eventType === "transcription_job_cancelled") {
    return "job_cancelled";
  }
  return "transcription_failed";
}
