"use client";

import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileAudio, X, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Waveform } from "./waveform";
import { Transcript } from "@/lib/types";
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
  onTranscribed: (transcript: Transcript) => void;
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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp3|mp4|wav|webm|ogg|flac|m4a)$/i)) {
      return "Unsupported format. Use MP3, WAV, M4A, FLAC, OGG, or WebM.";
    }
    if (f.size > MAX_SIZE) {
      return "File too large. Maximum size is 200MB.";
    }
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const error = validateFile(f);
    if (error) {
      toast.error(error);
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
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

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Transcription failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let resultData: { text: string; language?: string; duration?: number } | null = null;

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

      const transcript: Transcript = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileSize: file.size,
        duration: resultData.duration || 0,
        text: resultData.text,
        createdAt: new Date().toISOString(),
        language: resultData.language,
      };

      onTranscribed(transcript);
      setFile(null);
      toast.success("Transcription complete!");
    } catch (err) {
      onStatusChange?.({
        progress: 0,
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setTranscribing(false);
      setProgress(0);
      setStatusMessage("");
    }
  };

  return (
    <div className="space-y-4">
      {/* API Key Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Key className="w-3 h-3" />
          {apiKey ? "API key saved" : "Set OpenAI API key"}
        </button>
        {apiKey && (
          <span className="text-xs text-primary/60">
            ••••{apiKey.slice(-4)}
          </span>
        )}
      </div>

      <AnimatePresence>
        {showKeyInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pb-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (apiKey) {
                    localStorage.setItem("vox-api-key", apiKey);
                    toast.success("API key saved");
                  }
                  setShowKeyInput(false);
                }}
              >
                Save
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Zone */}
      <motion.div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !file && !transcribing && inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ${
          transcribing
            ? "border-primary/30 bg-primary/[0.03]"
            : dragActive
            ? "border-primary bg-primary/5 glow-amber"
            : file
            ? "border-border bg-card cursor-default"
            : "border-border/50 hover:border-primary/40 hover:bg-card/50 cursor-pointer"
        } ${!file ? "py-14" : "py-5"} px-6`}
        whileHover={!file && !transcribing ? { scale: 1.005 } : {}}
        whileTap={!file && !transcribing ? { scale: 0.995 } : {}}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.mp4,.wav,.webm,.ogg,.flac,.m4a"
          className="hidden"
          onChange={handleInputChange}
        />

        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary/70" />
              </div>
              <div className="text-center">
                <p className="text-foreground/90 font-medium mb-1">
                  Drop your audio file here
                </p>
                <p className="text-xs text-muted-foreground">
                  MP3, WAV, M4A, FLAC, OGG, WebM — up to 200MB
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                {!transcribing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="p-2 rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {transcribing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <Waveform animate />
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {statusMessage || "Preparing..."}
                      </p>
                      <p className="text-xs text-primary/70 tabular-nums font-medium">
                        {Math.round(progress)}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {!transcribing && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTranscribe();
                  }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-amber font-medium"
                  size="lg"
                >
                  Transcribe
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
