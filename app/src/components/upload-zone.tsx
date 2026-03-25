"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileAudio, Key, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Transcript } from "@/lib/types";
import { Waveform } from "./waveform";
import { toast } from "sonner";

const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "video/mp4",
  "video/webm",
];

const MAX_SIZE = 200 * 1024 * 1024;

interface UploadZoneProps {
  onTranscribed: (transcript: Transcript, sourceFile: File) => void;
  onStreamText: (text: string) => void;
  onTranscribeStart: () => void;
  onStatusChange?: (status: { progress: number; message: string }) => void;
}

export function UploadZone({
  onTranscribed,
  onStreamText,
  onTranscribeStart,
  onStatusChange,
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vox-api-key") || "";
    }
    return "";
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (candidate: File): string | null => {
    if (
      !ACCEPTED_TYPES.includes(candidate.type) &&
      !candidate.name.match(/\.(mp3|mp4|wav|webm|ogg|flac|m4a)$/i)
    ) {
      return "Unsupported format. Use MP3, WAV, M4A, FLAC, OGG, or WebM.";
    }

    if (candidate.size > MAX_SIZE) {
      return "File too large. Maximum size is 200MB.";
    }

    return null;
  };

  const handleFile = useCallback((candidate: File) => {
    const error = validateFile(candidate);
    if (error) {
      toast.error(error);
      return;
    }
    setFile(candidate);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      const candidate = event.dataTransfer.files[0];
      if (candidate) handleFile(candidate);
    },
    [handleFile]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.files?.[0];
    if (candidate) handleFile(candidate);
  };

  const handleTranscribe = async () => {
    if (!file) return;
    if (!apiKey.trim()) {
      setShowKeyInput(true);
      toast.error("Please enter your OpenAI API key first.");
      return;
    }

    setTranscribing(true);
    setProgress(0);
    setStatusMessage("Uploading file...");
    onTranscribeStart();
    onStatusChange?.({ progress: 0, message: "Uploading file..." });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apiKey", apiKey);

      setProgress(10);
      setStatusMessage("Uploading file...");
      onStatusChange?.({ progress: 10, message: "Uploading file..." });

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
      let resultData:
        | {
            text: string;
            language?: string;
            duration?: number;
            segments?: Transcript["segments"];
          }
        | null = null;

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
            setStatusMessage(event.message);
            onStatusChange?.({
              progress: event.progress,
              message: event.message,
            });
          } else if (event.type === "partial_text") {
            onStreamText(event.text);
          } else if (event.type === "result") {
            resultData = event;
            setProgress(100);
            setStatusMessage("Complete!");
            onStatusChange?.({ progress: 100, message: "Complete!" });
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      if (!resultData) throw new Error("No transcription result received");

      localStorage.setItem("vox-api-key", apiKey);

      onTranscribed(
        {
          id: crypto.randomUUID(),
          fileName: file.name,
          fileSize: file.size,
          duration: resultData.duration || 0,
          text: resultData.text,
          createdAt: new Date().toISOString(),
          language: resultData.language,
          segments: resultData.segments,
        },
        file
      );

      setFile(null);
      toast.success("Transcription complete!");
    } catch (error) {
      onStatusChange?.({
        progress: 0,
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setTranscribing(false);
      setProgress(0);
      setStatusMessage("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            Upload desk
          </p>
          <h2 className="mt-2 font-heading text-2xl leading-none tracking-[-0.03em] sm:text-3xl">
            Start a new listening pass.
          </h2>
        </div>

        <button
          onClick={() => setShowKeyInput((visible) => !visible)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Key className="h-3.5 w-3.5" />
          <span>{apiKey ? `Key ••••${apiKey.slice(-4)}` : "Set API key"}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showKeyInput && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="h-11 rounded-2xl border border-white/10 bg-[#05070d] px-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <Button
              size="lg"
              variant="secondary"
              className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (apiKey) {
                  localStorage.setItem("vox-api-key", apiKey);
                  toast.success("API key saved");
                }
                setShowKeyInput(false);
              }}
            >
              Save key
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !file && !transcribing && inputRef.current?.click()}
        className={`relative overflow-hidden rounded-[28px] border px-5 py-5 transition-all sm:px-6 sm:py-6 ${
          transcribing
            ? "border-primary/20 bg-primary/[0.06]"
            : dragActive
              ? "border-primary/35 bg-primary/[0.08]"
              : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
        } ${!file ? "min-h-[340px] cursor-pointer" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.mp4,.wav,.webm,.ogg,.flac,.m4a"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="flex h-full min-h-[300px] flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/6">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="max-w-[15rem] text-right text-xs leading-5 text-muted-foreground">
                  <p>Whisper-ready formats</p>
                  <p>Automatic chunking for longer files</p>
                </div>
              </div>

              <div>
                <h3 className="max-w-[11ch] font-heading text-4xl leading-[0.94] tracking-[-0.04em] sm:text-5xl">
                  Drop your source audio.
                </h3>
                <p className="mt-4 max-w-[34ch] text-sm leading-7 text-muted-foreground">
                  Bring in interviews, lectures, podcasts, or field recordings.
                  Vox will stream status updates while the transcript is assembled.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-muted-foreground">
                <span>MP3, WAV, M4A, FLAC, OGG, WebM</span>
                <span>Up to 200MB</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/6">
                  <FileAudio className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-3xl leading-none tracking-[-0.03em]">
                    {file.name}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB selected for
                    transcription
                  </p>
                </div>
                {!transcribing && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setFile(null);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#05070d] p-5">
                {transcribing ? (
                  <div className="space-y-4">
                    <Waveform animate />
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-sky-300/80"
                          initial={{ width: "0%" }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                          {statusMessage || "Preparing..."}
                        </p>
                        <p className="text-sm font-medium tabular-nums text-foreground/85">
                          {Math.round(progress)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                      Ready
                    </p>
                    <p className="max-w-[28ch] text-sm leading-7 text-muted-foreground">
                      The file is staged. Start transcription when you&apos;re ready.
                    </p>
                  </div>
                )}
              </div>

              {!transcribing && (
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTranscribe();
                  }}
                  size="lg"
                  className="h-14 w-full rounded-[20px] bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Start transcription
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
