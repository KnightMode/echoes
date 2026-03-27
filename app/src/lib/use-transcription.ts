"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { TranscriptSegment } from "./types";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptSegment[];
}

interface UseTranscriptionOptions {
  onComplete: (result: TranscriptionResult, file: File) => void;
}

export function useTranscription({ onComplete }: UseTranscriptionOptions) {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");

  // Keep onComplete ref stable so the streaming closure always calls the latest
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const start = useCallback(async (file: File, apiKey: string) => {
    setActive(true);
    setProgress(5);
    setStatus("Uploading file...");
    setText("");
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apiKey", apiKey);

      setProgress(10);
      setStatus("Uploading file...");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

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
            setProgress(event.progress);
            setStatus(event.message);
          } else if (event.type === "partial_text") {
            setText((prev) => prev + (prev ? " " : "") + event.text);
          } else if (event.type === "result") {
            resultData = event;
            setProgress(100);
            setStatus("Complete!");
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      if (!resultData) throw new Error("No transcription result received");

      localStorage.setItem("vox-api-key", apiKey);
      onCompleteRef.current(resultData, file);
      toast.success("Transcription complete!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong.";
      setStatus(msg);
      toast.error(msg);
    } finally {
      setActive(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus("");
    setText("");
    setFileName("");
  }, []);

  return { active, progress, status, text, fileName, start, reset };
}
