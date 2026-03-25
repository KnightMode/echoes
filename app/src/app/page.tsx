"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  History,
  Plus,
  Sparkles,
  Waves,
} from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { HistorySidebar } from "@/components/history-sidebar";
import { LiveTranscript } from "@/components/live-transcript";
import { Transcript } from "@/lib/types";
import { deleteAudioFile, getAudioFile, saveAudioFile } from "@/lib/audio-store";
import {
  deleteTranscript,
  formatDuration,
  getTranscripts,
  saveTranscript,
} from "@/lib/store";
import { toast } from "sonner";

function totalDuration(transcripts: Transcript[]) {
  return transcripts.reduce((sum, transcript) => sum + transcript.duration, 0);
}

export default function Home() {
  const [transcripts, setTranscripts] = useState<Transcript[]>(() => {
    if (typeof window === "undefined") return [];
    return getTranscripts();
  });
  const [selected, setSelected] = useState<Transcript | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = getTranscripts();
    return stored[0] ?? null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1100;
  });
  const [streamingText, setStreamingText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showUpload, setShowUpload] = useState(() => {
    if (typeof window === "undefined") return true;
    return getTranscripts().length === 0;
  });
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleStreamText = useCallback((text: string) => {
    setStreamingText((prev) => prev + (prev ? " " : "") + text);
  }, []);

  const handleTranscribeStart = useCallback(() => {
    setIsTranscribing(true);
    setStreamingText("");
    setSelected(null);
    setShowUpload(true);
    setProgress(0);
    setStatusMessage("Preparing audio...");
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadSelectedAudio = async () => {
      if (!selected) {
        setAudioUrl(null);
        return;
      }

      const file = await getAudioFile(selected.id);
      if (!active) return;

      if (!file) {
        setAudioUrl(null);
        return;
      }

      objectUrl = URL.createObjectURL(file);
      setAudioUrl(objectUrl);
    };

    void loadSelectedAudio();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected]);

  const handleTranscribed = useCallback(async (transcript: Transcript, sourceFile: File) => {
    await saveAudioFile(transcript.id, sourceFile);
    saveTranscript(transcript);
    setTranscripts((prev) => [transcript, ...prev]);
    setSelected(transcript);
    setIsTranscribing(false);
    setStreamingText("");
    setShowUpload(false);
    setProgress(100);
    setStatusMessage("Complete!");
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      void deleteAudioFile(id);
      deleteTranscript(id);
      setTranscripts((prev) => prev.filter((transcript) => transcript.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setShowUpload(true);
      }
      toast.success("Transcript deleted");
    },
    [selected]
  );

  const handleNewUpload = useCallback(() => {
    setSelected(null);
    setShowUpload(true);
    setStreamingText("");
    setIsTranscribing(false);
    setProgress(0);
    setStatusMessage("");
  }, []);

  const transcriptCount = transcripts.length;
  const totalMinutes = totalDuration(transcripts);
  const latestTranscript = transcripts[0] ?? null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,191,94,0.18),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(108,131,255,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="absolute left-[12%] top-[18%] h-40 w-40 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-[12%] right-[18%] h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <header className="relative z-20">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl">
              <AudioLines className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-heading text-2xl tracking-[0.02em]">Vox</p>
              <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                Whisper workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleNewUpload}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:px-4"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New transcript</span>
            </button>
            <button
              onClick={() => setSidebarOpen((open) => !open)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors sm:px-4 ${
                sidebarOpen
                  ? "border-primary/30 bg-primary/12 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Archive</span>
              {transcriptCount > 0 && (
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/75">
                  {transcriptCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-84px)]">
        <main className="min-w-0 flex-1">
          <div className="mx-auto flex min-h-[calc(100vh-84px)] max-w-[1600px] flex-col px-5 pb-10 sm:px-8">
            <AnimatePresence mode="wait">
              {selected && !isTranscribing ? (
                <motion.div
                  key={`viewer-${selected.id}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  className="grid min-h-[calc(100vh-120px)] gap-8 py-6 xl:grid-cols-[minmax(0,1.35fr)_320px]"
                >
                  <TranscriptViewer
                    transcript={selected}
                    audioUrl={audioUrl}
                    onBack={handleNewUpload}
                  />

                  <div className="hidden xl:block">
                    <div className="sticky top-6 space-y-8">
                      <div className="border-b border-white/10 pb-6">
                        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
                          Session
                        </p>
                        <p className="mt-3 max-w-[20ch] font-heading text-3xl leading-none">
                          Return to the reading room.
                        </p>
                        <p className="mt-3 max-w-[28ch] text-sm leading-6 text-muted-foreground">
                          Browse stored takes, reopen a transcript, or start a fresh
                          upload from the top bar.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Library
                          </p>
                          <p className="mt-2 font-heading text-3xl">{transcriptCount}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Audio
                          </p>
                          <p className="mt-2 font-heading text-3xl">
                            {formatDuration(totalMinutes)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid gap-8 py-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,560px)]"
                >
                  <section className="flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-8 sm:py-8">
                    <div className="space-y-10">
                      <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                          <Sparkles className="h-3 w-3 text-primary" />
                          Editorial transcription
                        </div>
                        <div className="max-w-[10ch]">
                          <h1 className="font-heading text-5xl leading-[0.92] tracking-[-0.04em] text-balance sm:text-6xl xl:text-[5.25rem]">
                            Audio, staged for reading.
                          </h1>
                        </div>
                        <p className="max-w-[36ch] text-sm leading-7 text-muted-foreground sm:text-base">
                          Upload a recording, follow the transcription live, and
                          reopen finished scripts from a calm archive instead of a
                          generic file list.
                        </p>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-3">
                        <Metric label="Transcripts" value={String(transcriptCount).padStart(2, "0")} />
                        <Metric
                          label="Audio logged"
                          value={transcriptCount > 0 ? formatDuration(totalMinutes) : "0:00"}
                        />
                        <Metric
                          label="Latest take"
                          value={latestTranscript ? latestTranscript.fileName.replace(/\.[^/.]+$/, "") : "None"}
                          compact
                        />
                      </div>
                    </div>

                    <div className="mt-10 border-t border-white/10 pt-5">
                      <div className="flex items-end justify-between gap-6">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                            Workflow
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-foreground/85">
                            <span className="inline-flex items-center gap-2">
                              <Waves className="h-4 w-4 text-primary" />
                              Upload
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Transcribe</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Read</span>
                          </div>
                        </div>
                        <div className="text-right text-xs leading-5 text-muted-foreground">
                          <p>MP3, WAV, M4A, FLAC, OGG, WebM</p>
                          <p>Up to 200MB with automatic chunking</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="flex min-h-[360px] flex-col justify-start">
                    {showUpload && (
                      <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-[30px] border border-white/10 bg-[#090b12]/80 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5"
                      >
                        <UploadZone
                          onTranscribed={handleTranscribed}
                          onStreamText={handleStreamText}
                          onTranscribeStart={handleTranscribeStart}
                          onStatusChange={({ progress: nextProgress, message }) => {
                            setProgress(nextProgress);
                            setStatusMessage(message);
                          }}
                        />
                      </motion.div>
                    )}

                    {isTranscribing && (
                      <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-[30px] border border-white/10 bg-[#090b12]/80 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5"
                      >
                        <LiveTranscript
                          text={streamingText}
                          progress={progress}
                          status={statusMessage}
                        />
                      </motion.div>
                    )}
                  </section>

                  {!isTranscribing && showUpload && transcripts.length > 0 && (
                    <section className="xl:col-span-2">
                      <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-8">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                            Recent transcripts
                          </p>
                          <p className="mt-2 font-heading text-3xl">Open a finished take.</p>
                        </div>
                        <button
                          onClick={() => setSidebarOpen(true)}
                          className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
                        >
                          Open full archive
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-6 grid gap-4 lg:grid-cols-3">
                        {transcripts.slice(0, 3).map((transcript, index) => (
                          <button
                            key={transcript.id}
                            onClick={() => {
                              setSelected(transcript);
                              setShowUpload(false);
                            }}
                            className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-5 text-left transition-all hover:border-primary/30 hover:bg-white/[0.05]"
                          >
                            <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                              Take {String(index + 1).padStart(2, "0")}
                            </p>
                            <p className="mt-4 line-clamp-2 font-heading text-3xl leading-none tracking-[-0.03em]">
                              {transcript.fileName.replace(/\.[^/.]+$/, "")}
                            </p>
                            <p className="mt-4 line-clamp-4 text-sm leading-7 text-muted-foreground">
                              {transcript.text}
                            </p>
                            <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatDuration(transcript.duration)}</span>
                              <span className="inline-flex items-center gap-1 text-foreground/80">
                                Read
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <div className="px-5 pb-10 pr-8 pt-6 2xl:pl-0">
          <AnimatePresence>
            {sidebarOpen && (
              <HistorySidebar
                transcripts={transcripts}
                selectedId={selected?.id ?? null}
                onSelect={(transcript) => {
                  setSelected(transcript);
                  setShowUpload(false);
                  setIsTranscribing(false);
                  setStreamingText("");
                }}
                onDelete={handleDelete}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="border-l border-white/10 pl-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-3 leading-none tracking-[-0.03em] ${
          compact ? "line-clamp-2 font-medium text-lg text-foreground/85" : "font-heading text-4xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
