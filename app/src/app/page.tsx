"use client";

import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  Clock,
  Eye,
  FolderOpen,
  Plus,
  X,
} from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { HistorySidebar } from "@/components/history-sidebar";
import { LiveTranscript } from "@/components/live-transcript";
import { Waveform } from "@/components/waveform";
import { Transcript } from "@/lib/types";
import { deleteAudioFile, getAudioFile, saveAudioFile } from "@/lib/audio-store";
import {
  deleteTranscript,
  formatDuration,
  getTranscripts,
  saveTranscript,
} from "@/lib/store";
import { useTranscriptionQueue } from "@/lib/use-transcription";
import { toast } from "sonner";

type View = "home" | "live" | "viewer";

interface AppState {
  selected: Transcript | null;
  view: View;
  drawerOpen: boolean;
  audioUrl: string | null;
}

type AppAction =
  | { type: "SELECT"; transcript: Transcript }
  | { type: "GO_HOME" }
  | { type: "GO_LIVE" }
  | { type: "OPEN_DRAWER" }
  | { type: "CLOSE_DRAWER" }
  | { type: "SET_AUDIO_URL"; url: string | null }
  | { type: "DELETE_SELECTED"; id: string };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SELECT":
      return { ...state, selected: action.transcript, view: "viewer" };
    case "GO_HOME":
      return { ...state, selected: null, view: "home" };
    case "GO_LIVE":
      return { ...state, selected: null, view: "live" };
    case "OPEN_DRAWER":
      return { ...state, drawerOpen: true };
    case "CLOSE_DRAWER":
      return { ...state, drawerOpen: false };
    case "SET_AUDIO_URL":
      return { ...state, audioUrl: action.url };
    case "DELETE_SELECTED":
      if (state.selected?.id === action.id) return { ...state, selected: null, view: "home" };
      return state;
  }
}

const TRANSCRIPTS_KEY = "echoes-transcripts";

function subscribeToTranscripts(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getTranscriptsSnapshot() {
  return localStorage.getItem(TRANSCRIPTS_KEY) || "[]";
}

function getTranscriptsServerSnapshot() {
  return "[]";
}

export default function Home() {
  const rawTranscripts = useSyncExternalStore(subscribeToTranscripts, getTranscriptsSnapshot, getTranscriptsServerSnapshot);
  const transcripts: Transcript[] = JSON.parse(rawTranscripts);

  const [state, dispatch] = useReducer(appReducer, {
    selected: null,
    view: "home" as View,
    drawerOpen: false,
    audioUrl: null,
  });

  // ── Transcription queue (persists across view changes) ──
  const transcription = useTranscriptionQueue({
    onComplete: useCallback(async (result, sourceFile) => {
      const transcript: Transcript = {
        id: crypto.randomUUID(),
        fileName: sourceFile.name,
        fileSize: sourceFile.size,
        duration: result.duration || 0,
        text: result.text,
        createdAt: new Date().toISOString(),
        language: result.language,
        segments: result.segments,
      };
      await saveAudioFile(transcript.id, sourceFile);
      saveTranscript(transcript);
      dispatch({ type: "SELECT", transcript });
    }, []),
  });

  // ── Audio loading ──
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!state.selected) {
      dispatch({ type: "SET_AUDIO_URL", url: null });
      return;
    }
    const load = async () => {
      const file = await getAudioFile(state.selected!.id);
      if (!active) return;
      if (!file) { dispatch({ type: "SET_AUDIO_URL", url: null }); return; }
      objectUrl = URL.createObjectURL(file);
      dispatch({ type: "SET_AUDIO_URL", url: objectUrl });
    };
    void load();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [state.selected]);

  // ── Handlers ──
  const handleStartTranscription = useCallback(
    (file: File, apiKey: string) => {
      if (!transcription.busy) {
        dispatch({ type: "GO_LIVE" });
      }
      transcription.enqueue(file, apiKey);
    },
    [transcription]
  );

  const handleDelete = useCallback(
    (id: string) => {
      void deleteAudioFile(id);
      deleteTranscript(id);
      dispatch({ type: "DELETE_SELECTED", id });
      toast.success("Transcript deleted");
    },
    []
  );

  const goHome = useCallback(() => dispatch({ type: "GO_HOME" }), []);
  const goLive = useCallback(() => dispatch({ type: "GO_LIVE" }), []);
  const openTranscript = useCallback((t: Transcript) => dispatch({ type: "SELECT", transcript: t }), []);

  const bgTranscribing = transcription.busy && state.view !== "live";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <button onClick={goHome} className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <AudioLines className="h-4 w-4 text-primary" />
              {transcription.busy && (
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              )}
            </div>
            <span className="text-[15px] font-bold tracking-tight">Echoes</span>
          </button>

          <div className="flex items-center gap-2">
            {state.view !== "home" && (
              <button
                onClick={goHome}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            )}
            {transcripts.length > 0 && (
              <button
                onClick={() => dispatch({ type: "OPEN_DRAWER" })}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Library
                <span className="ml-0.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                  {transcripts.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Background transcription indicator ── */}
      <AnimatePresence>
        {bgTranscribing && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky top-14 z-20 overflow-hidden border-b border-primary/20 bg-background"
          >
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-2.5">
              <div className="shrink-0">
                <Waveform animate />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">
                    Transcribing
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {transcription.activeJob?.fileName}
                  </span>
                  {transcription.queueCount > 0 && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      +{transcription.queueCount} queued
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-primary/10">
                  <m.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${transcription.activeJob?.progress ?? 0}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-[12px] font-medium tabular-nums text-primary">
                {Math.round(transcription.activeJob?.progress ?? 0)}%
              </span>
              <button
                onClick={goLive}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Eye className="h-3 w-3" />
                View
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <main className="mx-auto max-w-5xl px-5 py-8">
        <AnimatePresence mode="wait">
          {/* ─ Transcript viewer ─ */}
          {state.view === "viewer" && state.selected && (
            <m.div
              key={`viewer-${state.selected.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <TranscriptViewer
                transcript={state.selected}
                audioUrl={state.audioUrl}
                onBack={goHome}
                stickyOffset={bgTranscribing}
              />
            </m.div>
          )}

          {/* ─ Live transcription ─ */}
          {state.view === "live" && (
            <m.div
              key="live"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mx-auto max-w-2xl"
            >
              <LiveTranscript
                text={transcription.activeJob?.text ?? ""}
                progress={transcription.activeJob?.progress ?? 0}
                status={transcription.activeJob?.status ?? ""}
                fileName={transcription.activeJob?.fileName ?? ""}
                active={transcription.activeJob !== null}
                queueCount={transcription.queueCount}
              />
            </m.div>
          )}

          {/* ─ Home / Upload ─ */}
          {state.view === "home" && (
            <m.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {/* Hero — compact so upload box is visible without scrolling */}
              <div className="mx-auto max-w-2xl pb-6 pt-4 text-center sm:pt-8">
                <m.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-primary/20 to-primary/5 ring-1 ring-primary/10"
                >
                  <AudioLines className="h-6 w-6 text-primary" />
                </m.div>

                <m.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.4 }}
                  className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2.25rem]"
                >
                  Audio to text,{" "}
                  <span className="text-muted-foreground">in seconds.</span>
                </m.h1>

                <m.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground"
                >
                  Drop an audio file, watch it transcribe in real time, and get clean
                  text you can copy, download, or read alongside the original recording.
                </m.p>
              </div>

              {/* Upload zone */}
              <m.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="mx-auto max-w-2xl"
              >
                <UploadZone
                  onStartTranscription={handleStartTranscription}
                  busy={transcription.busy}
                />
              </m.div>

              {/* Recent transcripts */}
              {transcripts.length > 0 && (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="mt-16"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground">Recent</h2>
                    {transcripts.length > 4 && (
                      <button
                        onClick={() => dispatch({ type: "OPEN_DRAWER" })}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        View all
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {transcripts.slice(0, 4).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openTranscript(t)}
                        className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/25 hover:bg-card/80"
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <AudioLines className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {t.fileName.replace(/\.[^/.]+$/, "")}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                            {t.text}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground">
                            {t.duration > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(t.duration)}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              Open <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </m.div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Library drawer ── */}
      <AnimatePresence>
        {state.drawerOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => dispatch({ type: "CLOSE_DRAWER" })}
            />
            <m.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md"
            >
              <div className="flex h-full flex-col border-l border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-sm font-semibold">Library</h2>
                  <button
                    onClick={() => dispatch({ type: "CLOSE_DRAWER" })}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <HistorySidebar
                  transcripts={transcripts}
                  selectedId={state.selected?.id ?? null}
                  onSelect={(t) => { openTranscript(t); dispatch({ type: "CLOSE_DRAWER" }); }}
                  onDelete={handleDelete}
                />
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
