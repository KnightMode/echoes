"use client";

import { useEffect, useRef } from "react";
import { m } from "framer-motion";
import { CheckCircle2, FileAudio, StopCircle } from "lucide-react";
import { Waveform } from "./waveform";

function splitIntoParagraphs(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const paragraphs: string[] = [];
  let current = "";
  let count = 0;
  for (const sentence of sentences) {
    current += sentence;
    count += 1;
    if (count >= 4) { paragraphs.push(current.trim()); current = ""; count = 0; }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs;
}

interface LiveTranscriptProps {
  text: string;
  progress: number;
  status: string;
  fileName: string;
  active: boolean;
  queueCount?: number;
  onCancel?: () => void;
}

export function LiveTranscript({ text, progress, status, fileName, active, queueCount = 0, onCancel }: LiveTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const paragraphs = splitIntoParagraphs(text);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [text]);

  const done = !active && progress >= 100;

  return (
    <div className="space-y-6">
      {/* File + status */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {active ? (
              <>
                <span className="absolute inset-0 animate-ping rounded-lg bg-primary/15" />
                <FileAudio className="relative h-4 w-4 text-primary" />
              </>
            ) : done ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : (
              <FileAudio className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fileName || "Audio file"}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{status || "Preparing..."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-xl font-bold tabular-nums text-primary">
              {Math.round(progress)}%
            </span>
            {active && onCancel && (
              <button
                onClick={onCancel}
                title="Stop transcription"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <m.div
            className="h-full rounded-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {queueCount > 0 && (
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            <span className="font-medium text-primary">{queueCount}</span> more file{queueCount > 1 ? "s" : ""} queued — will start automatically
          </p>
        )}
      </div>

      {/* Waveform */}
      {active && (
        <div className="flex justify-center">
          <Waveform animate />
        </div>
      )}

      {/* Streaming text */}
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-card p-5">
        {paragraphs.length > 0 ? (
          <div className="space-y-4">
            {paragraphs.map((p) => (
              <m.p
                key={`${p.slice(0, 30)}-${p.length}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="font-reading text-[16px] leading-[1.8] text-foreground/80"
              >
                {p}
              </m.p>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">Waiting for text...</p>
            <p className="mt-1 text-[13px] text-muted-foreground/60">
              Segments will appear here as they arrive from Whisper.
            </p>
          </div>
        )}

        {active && (
          <m.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="mt-2 inline-block h-4 w-0.5 bg-primary align-middle"
          />
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
