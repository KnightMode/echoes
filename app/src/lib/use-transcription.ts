"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TranscriptSegment } from "./types";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptSegment[];
}

export interface QueuedJob {
  id: string;
  file: File;
  apiKey: string;
  fileName: string;
  fileSize: number;
}

interface ActiveJobState {
  id: string;
  fileName: string;
  progress: number;
  status: string;
  text: string;
}

interface UseTranscriptionQueueOptions {
  onComplete: (result: TranscriptionResult, file: File) => void;
}

export function useTranscriptionQueue({ onComplete }: UseTranscriptionQueueOptions) {
  const [activeJob, setActiveJob] = useState<ActiveJobState | null>(null);
  const [queue, setQueue] = useState<QueuedJob[]>([]);
  const processingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // ── Process next job from queue ──
  const processJob = useCallback(async (job: QueuedJob) => {
    processingRef.current = true;
    setActiveJob({ id: job.id, fileName: job.fileName, progress: 5, status: "Uploading file...", text: "" });

    try {
      const formData = new FormData();
      formData.append("file", job.file);
      formData.append("apiKey", job.apiKey);

      setActiveJob((prev) => prev ? { ...prev, progress: 10, status: "Uploading file..." } : prev);

      const response = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Transcription failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let resultData: TranscriptionResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "status") {
            setActiveJob((prev) => prev ? { ...prev, progress: event.progress, status: event.message } : prev);
          } else if (event.type === "partial_text") {
            setActiveJob((prev) => prev ? { ...prev, text: prev.text + (prev.text ? " " : "") + event.text } : prev);
          } else if (event.type === "result") {
            resultData = event;
            setActiveJob((prev) => prev ? { ...prev, progress: 100, status: "Complete!" } : prev);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      if (!resultData) throw new Error("No transcription result received");

      localStorage.setItem("echoes-api-key", job.apiKey);
      onCompleteRef.current(resultData, job.file);
      toast.success(`Transcribed: ${job.fileName}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong.";
      setActiveJob((prev) => prev ? { ...prev, status: msg, progress: 0 } : prev);
      toast.error(`Failed: ${job.fileName} — ${msg}`);
    } finally {
      processingRef.current = false;
      setActiveJob(null);
    }
  }, []);

  // ── Watch queue and kick off next job ──
  useEffect(() => {
    if (processingRef.current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    void processJob(next);
  }, [queue, activeJob, processJob]);

  // ── Enqueue a new job ──
  const enqueue = useCallback((file: File, apiKey: string) => {
    const job: QueuedJob = {
      id: crypto.randomUUID(),
      file,
      apiKey,
      fileName: file.name,
      fileSize: file.size,
    };
    setQueue((prev) => [...prev, job]);
    toast(`Queued: ${file.name}`, { description: processingRef.current ? "Will start when current transcription finishes." : undefined });
  }, []);

  // ── Remove a queued job ──
  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return {
    activeJob,
    queue,
    queueCount: queue.length,
    busy: processingRef.current || activeJob !== null,
    enqueue,
    removeFromQueue,
  };
}
