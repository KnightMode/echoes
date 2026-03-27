"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileAudio, Key, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ACCEPTED_TYPES = [
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
  "audio/ogg", "audio/flac", "video/mp4", "video/webm",
];
const MAX_SIZE = 200 * 1024 * 1024;

interface UploadZoneProps {
  onStartTranscription: (file: File, apiKey: string) => void;
  disabled?: boolean;
}

export function UploadZone({ onStartTranscription, disabled }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("vox-api-key") || "";
    return "";
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp3|mp4|wav|webm|ogg|flac|m4a)$/i))
      return "Unsupported format. Use MP3, WAV, M4A, FLAC, OGG, or WebM.";
    if (f.size > MAX_SIZE) return "File too large. Maximum size is 200MB.";
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleTranscribe = () => {
    if (!file) return;
    if (!apiKey.trim()) {
      setShowKeyInput(true);
      toast.error("Please enter your OpenAI API key first.");
      return;
    }
    onStartTranscription(file, apiKey);
    setFile(null);
  };

  return (
    <div className="space-y-4">
      {/* API key bar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowKeyInput((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Key className="h-3 w-3" />
          {apiKey ? `••••${apiKey.slice(-4)}` : "API key"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showKeyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
          >
            <div className="flex gap-2 rounded-xl border border-border bg-card p-3">
              <input
                type="password" value={apiKey}
                onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..."
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <Button
                size="sm" className="h-9 rounded-lg bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  if (apiKey) { localStorage.setItem("vox-api-key", apiKey); toast.success("Saved"); }
                  setShowKeyInput(false);
                }}
              >
                Save
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => !file && !disabled && inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
          disabled ? "pointer-events-none border-border/50 bg-card/50 opacity-60"
            : dragActive ? "border-primary/50 bg-primary/[0.05]"
            : file ? "border-border bg-card"
            : "cursor-pointer border-border/80 bg-card hover:border-muted-foreground/30"
        }`}
      >
        <input
          ref={inputRef} type="file" accept=".mp3,.mp4,.wav,.webm,.ogg,.flac,.m4a"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center px-6 py-14 text-center sm:py-20"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                {disabled ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              {disabled ? (
                <>
                  <p className="text-sm font-medium">Transcription in progress</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    Wait for the current transcription to finish, or view its progress above.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop an audio file here, or click to browse</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    MP3, WAV, M4A, FLAC, OGG, WebM &middot; up to 200 MB
                  </p>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileAudio className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={(e) => { e.stopPropagation(); handleTranscribe(); }}
                className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Transcribe
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
