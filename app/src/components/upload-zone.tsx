"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ExternalLink, FileAudio, Key, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isValidApiKey } from "@/lib/validate-api-key";

const ACCEPTED_TYPES = [
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
  "audio/ogg", "audio/flac", "video/mp4", "video/webm",
  "video/x-ms-wmv",
];
const MAX_SIZE = 250 * 1024 * 1024;
const API_KEY_KEY = "echoes-api-key";

function subscribeToStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getApiKeySnapshot() {
  return localStorage.getItem(API_KEY_KEY) || "";
}

function getApiKeyServerSnapshot() {
  return "";
}

interface UploadZoneProps {
  onStartTranscription: (file: File, apiKey: string) => void;
  busy?: boolean;
  /** When set, uploads are blocked until a disk library folder is chosen. */
  disabled?: boolean;
  disabledReason?: string;
}

export function UploadZone({
  onStartTranscription,
  busy,
  disabled = false,
  disabledReason = "Choose a library folder first.",
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const storedKey = useSyncExternalStore(subscribeToStorage, getApiKeySnapshot, getApiKeyServerSnapshot);
  const [localKey, setLocalKey] = useState<string | null>(null);
  const apiKey = localKey ?? storedKey;
  const [showKeyInput, setShowKeyInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp3|mp4|wav|webm|ogg|flac|m4a|wmv)$/i))
      return "Unsupported format. Use MP3, WAV, M4A, FLAC, OGG, WebM, or WMV.";
    if (f.size > MAX_SIZE) return "File too large. Maximum size is 250MB.";
    return null;
  };

  const handleFile = useCallback((f: File) => {
    if (disabled) {
      toast.error(disabledReason);
      return;
    }
    const err = validateFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
  }, [disabled, disabledReason]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (disabled) {
      toast.error(disabledReason);
      return;
    }
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile, disabled, disabledReason]);

  const handleTranscribe = () => {
    if (!file) return;
    if (disabled) {
      toast.error(disabledReason);
      return;
    }
    if (!apiKey.trim()) {
      setShowKeyInput(true);
      toast.error("Please enter your OpenAI API key first.");
      return;
    }
    onStartTranscription(file, apiKey);
    setFile(null);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!file) inputRef.current?.click();
    }
  }, [file]);

  return (
    <div className="space-y-4">
      {/* API key bar */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setShowKeyInput((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
            apiKey
              ? "text-green-500 hover:bg-green-500/10"
              : "text-primary hover:bg-primary/10"
          }`}
        >
          <Key className="h-3 w-3" />
          {apiKey ? `••••${apiKey.slice(-4)}` : "API key"}
        </button>
        <ApiKeyPrivacyHint hasKey={!!apiKey} />
      </div>

      <AnimatePresence initial={false}>
        {showKeyInput && (
          <m.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex gap-2">
                <input
                  type="password" value={apiKey}
                  onChange={(e) => setLocalKey(e.target.value)} placeholder="sk-..."
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <Button
                  size="sm" className="h-9 rounded-lg bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    const trimmed = apiKey.trim();
                    if (!trimmed) { toast.error("Please enter an API key."); return; }
                    if (!isValidApiKey(trimmed)) {
                      toast.error("Invalid key. OpenAI keys start with sk- followed by at least 20 characters.");
                      return;
                    }
                    localStorage.setItem(API_KEY_KEY, trimmed);
                    setLocalKey(trimmed);
                    setShowKeyInput(false);
                  }}
                >
                  Save
                </Button>
              </div>
              {!apiKey && (
                <div className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">
                  <p className="font-medium text-foreground">How to get an OpenAI API key</p>
                  <ol className="mt-2 space-y-1.5 pl-1">
                    <li>1. Sign up or log in at{" "}
                      <a href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline">
                        platform.openai.com <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </li>
                    <li>2. Go to{" "}
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline">
                        API Keys <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      {" "}and click <strong className="text-foreground">Create new secret key</strong>
                    </li>
                    <li>3. Copy the key (starts with <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">sk-</code>) and paste it above</li>
                  </ol>
                  <p className="mt-2 text-muted-foreground/70">
                    Your key is stored only in your browser and sent directly to OpenAI — never to any server.
                  </p>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => !disabled && !file && inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
          disabled
            ? "cursor-not-allowed border-border/50 bg-muted/30 opacity-80"
            : dragActive ? "border-primary/50 bg-primary/[0.05]"
            : file ? "border-border bg-card"
            : "cursor-pointer border-border/80 bg-card hover:border-muted-foreground/30"
        }`}
      >
        <input
          ref={inputRef} type="file" accept=".mp3,.mp4,.wav,.webm,.ogg,.flac,.m4a,.wmv"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {disabled && (
          <div className="absolute inset-0 z-10 flex cursor-not-allowed items-center justify-center rounded-2xl bg-background/60 px-4 backdrop-blur-[2px]">
            <p className="text-center text-[13px] font-medium text-muted-foreground">{disabledReason}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!file ? (
            <m.div
              key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center px-6 py-8 text-center sm:py-12"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Drop an audio file here, or click to browse</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                MP3, WAV, M4A, FLAC, OGG, WebM, WMV &middot; up to 250 MB
              </p>
              {busy && (
                <p className="mt-2 text-[12px] text-primary">
                  A transcription is in progress — new files will be queued automatically.
                </p>
              )}
            </m.div>
          ) : (
            <m.div
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
                {busy ? "Add to Queue" : "Transcribe"}
              </Button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ApiKeyPrivacyHint({ hasKey }: { hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-flex shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label="API key privacy info"
        className={`rounded-full p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${
          hasKey
            ? "text-green-500 hover:bg-green-500/10"
            : "text-primary hover:bg-primary/10"
        }`}
      >
        <ShieldCheck className="h-3 w-3" aria-hidden />
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          className="absolute right-0 top-full z-[60] mt-1.5 w-[min(17rem,calc(100vw-2.5rem))] rounded-lg border border-border bg-popover px-3 py-2.5 text-[11px] leading-relaxed text-popover-foreground shadow-lg"
        >
          <p className="font-medium text-foreground">Your key stays private</p>
          <p className="mt-1 text-muted-foreground">
            Stored only in your browser&apos;s localStorage and sent directly to OpenAI for transcription — never to Echoes servers.
          </p>
        </div>
      )}
    </div>
  );
}
