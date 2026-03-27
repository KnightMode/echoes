"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  Clock,
  Eye,
  FolderOpen,
  HardDrive,
  Plus,
  StopCircle,
  X,
} from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { HistorySidebar } from "@/components/history-sidebar";
import { LiveTranscript } from "@/components/live-transcript";
import { LibraryStorageHint } from "@/components/library-storage-hint";
import { PrivacyAssuranceFab } from "@/components/privacy-assurance-fab";
import { Waveform } from "@/components/waveform";
import { Folder, Transcript } from "@/lib/types";
import {
  isFileSystemAccessSupported,
  pickLibraryDirectory,
  readAudioFromLibrary,
  readLibraryData,
  restoreLibraryDirectory,
} from "@/lib/fs-library";
import { migrateLegacyToDiskIfNeeded } from "@/lib/library-migrate";
import {
  addTranscript,
  createFolderEntry,
  patchTranscript,
  removeFolderAndUnassign,
  removeTranscript,
  removeTranscriptsBulk,
  setFolderForTranscripts,
} from "@/lib/library-ops";
import { ECHOES_STORAGE_EVENT, formatDuration } from "@/lib/store";
import { useTranscriptionQueue } from "@/lib/use-transcription";
import { toast } from "sonner";

type View = "home" | "live" | "viewer";

const CYCLING_WORDS = ["meetings", "interviews", "podcasts", "lectures", "voice memos", "audio"];

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

export default function Home() {
  const [libraryRoot, setLibraryRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const [state, dispatch] = useReducer(appReducer, {
    selected: null,
    view: "home" as View,
    drawerOpen: false,
    audioUrl: null,
  });

  const refreshLibrary = useCallback(async () => {
    const root = await restoreLibraryDirectory();
    if (!root) {
      setLibraryRoot(null);
      setTranscripts([]);
      setFolders([]);
      return;
    }
    setLibraryRoot(root);
    const data = await readLibraryData(root);
    setTranscripts(data.transcripts);
    setFolders(data.folders);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLibraryLoading(true);
      await refreshLibrary();
      if (!cancelled) setLibraryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLibrary]);

  useEffect(() => {
    const onChange = () => void refreshLibrary();
    window.addEventListener(ECHOES_STORAGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ECHOES_STORAGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refreshLibrary]);

  const handleConnectLibrary = useCallback(async () => {
    const root = await pickLibraryDirectory();
    if (!root) {
      if (!isFileSystemAccessSupported()) {
        toast.error("Folder access isn't supported in this browser. Update Safari or use Chrome/Edge.");
      }
      return;
    }
    if (!root) return;
    const migrated = await migrateLegacyToDiskIfNeeded(root);
    if (migrated) {
      toast.success("Imported your previous library from browser storage into this folder.");
    }
    await refreshLibrary();
    toast.success("Library folder connected. Transcripts and audio are saved on disk.");
  }, [refreshLibrary]);

  const selectedId = state.selected?.id;
  const displayTranscript =
    selectedId != null
      ? transcripts.find((t) => t.id === selectedId) ?? state.selected
      : null;

  const transcription = useTranscriptionQueue({
    onComplete: useCallback(
      async (result, sourceFile) => {
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
        if (!libraryRoot) {
          // Browser doesn't support folder access — show result in-memory only
          dispatch({ type: "SELECT", transcript });
          return;
        }
        await addTranscript(libraryRoot, transcript, sourceFile);
        dispatch({ type: "SELECT", transcript });
      },
      [libraryRoot]
    ),
  });

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!state.selected || !libraryRoot) {
      dispatch({ type: "SET_AUDIO_URL", url: null });
      return;
    }
    const load = async () => {
      const t = transcripts.find((x) => x.id === state.selected!.id) ?? state.selected!;
      const file = await readAudioFromLibrary(libraryRoot, t);
      if (!active) return;
      if (!file) {
        dispatch({ type: "SET_AUDIO_URL", url: null });
        return;
      }
      objectUrl = URL.createObjectURL(file);
      dispatch({ type: "SET_AUDIO_URL", url: objectUrl });
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [state.selected, libraryRoot, transcripts]);

  const handleStartTranscription = useCallback(
    async (file: File, apiKey: string) => {
      if (!libraryRoot) {
        const root = await pickLibraryDirectory();
        if (root) {
          const migrated = await migrateLegacyToDiskIfNeeded(root);
          if (migrated) toast.success("Imported your previous library into this folder.");
          await refreshLibrary();
          toast.success("Library folder connected.");
        }
        // If root is null, folder picker was cancelled or unsupported — proceed in-memory
      }
      if (!transcription.busy) {
        dispatch({ type: "GO_LIVE" });
      }
      transcription.enqueue(file, apiKey);
    },
    [transcription, libraryRoot, refreshLibrary]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!libraryRoot) return;
      const t = transcripts.find((x) => x.id === id);
      if (!t) return;
      await removeTranscript(libraryRoot, t);
      dispatch({ type: "DELETE_SELECTED", id });
      toast.success("Transcript deleted");
    },
    [libraryRoot, transcripts]
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      if (!libraryRoot || ids.length === 0) return;
      const idSet = new Set(ids);
      const toRemove = transcripts.filter((t) => idSet.has(t.id));
      if (toRemove.length === 0) return;
      await removeTranscriptsBulk(libraryRoot, toRemove);
      const openId = state.selected?.id;
      if (openId && idSet.has(openId)) {
        dispatch({ type: "DELETE_SELECTED", id: openId });
      }
      toast.success(
        `Deleted ${ids.length} transcript${ids.length === 1 ? "" : "s"}`
      );
    },
    [libraryRoot, transcripts, state.selected]
  );

  const handleBulkMove = useCallback(
    async (ids: string[], folderId: string | null) => {
      if (!libraryRoot || ids.length === 0) return;
      await setFolderForTranscripts(libraryRoot, ids, folderId);
      toast.success(
        ids.length === 1
          ? folderId == null
            ? "Moved to Root"
            : "Moved to folder"
          : `Moved ${ids.length} transcripts`
      );
    },
    [libraryRoot]
  );

  const handleMoveTranscript = useCallback(
    async (id: string, folderId: string | null) => {
      if (!libraryRoot) return;
      await patchTranscript(libraryRoot, id, {
        folderId: folderId === null ? null : folderId,
      });
      toast.success(folderId == null ? "Moved to Root" : "Moved to folder");
    },
    [libraryRoot]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!libraryRoot) return;
      const folder: Folder = {
        id: crypto.randomUUID(),
        name: name.trim() || "Untitled folder",
        createdAt: new Date().toISOString(),
      };
      await createFolderEntry(libraryRoot, folder);
      toast.success("Folder created");
    },
    [libraryRoot]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      if (!libraryRoot) return;
      await removeFolderAndUnassign(libraryRoot, id);
      toast.success("Folder removed; transcripts moved to Root");
    },
    [libraryRoot]
  );

  const [wordIndex, setWordIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWordIndex((i) => (i + 1) % CYCLING_WORDS.length), 3500);
    return () => clearInterval(id);
  }, []);

  const goHome = useCallback(() => dispatch({ type: "GO_HOME" }), []);
  const goLive = useCallback(() => dispatch({ type: "GO_LIVE" }), []);
  const handleCancel = useCallback(() => {
    transcription.cancel();
    dispatch({ type: "GO_HOME" });
  }, [transcription]);
  const openTranscript = useCallback((t: Transcript) => dispatch({ type: "SELECT", transcript: t }), []);

  const bgTranscribing = transcription.busy && state.view !== "live";
  const uploadDisabled = libraryLoading;
  const uploadDisabledReason = "Loading library…";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Background: dot grid + top glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 0%, transparent 20%, hsl(var(--background)) 80%)",
          }}
        />
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <header className="relative z-30 sticky top-0 border-b border-border/60 bg-background/80 backdrop-blur-xl">
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
            {libraryRoot ? (
              <>
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
                <button
                    onClick={() => void handleConnectLibrary()}
                    title="Change library folder"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    Change folder
                  </button>
              </>
            ) : null}
          </div>
        </div>
      </header>


      <AnimatePresence>
        {bgTranscribing && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky top-14 z-20 overflow-hidden border-b border-primary/20 bg-background"
          >
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5">
              <div className="hidden shrink-0 sm:block">
                <Waveform animate />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">Transcribing</span>
                  <span className="hidden truncate text-[13px] text-muted-foreground sm:inline">
                    {transcription.activeJob?.fileName}
                  </span>
                  {transcription.queueCount > 0 && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      +{transcription.queueCount}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-primary/10 sm:max-w-xs">
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
                title="View transcription"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20 sm:px-3"
              >
                <Eye className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">View</span>
              </button>
              <button
                onClick={handleCancel}
                title="Stop transcription"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:px-3"
              >
                <StopCircle className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <AnimatePresence mode="wait">
          {state.view === "viewer" && displayTranscript && (
            <m.div
              key={`viewer-${displayTranscript.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <TranscriptViewer
                transcript={displayTranscript}
                audioUrl={state.audioUrl}
                folders={folders}
                onBack={goHome}
                stickyOffset={bgTranscribing}
                onMoveToFolder={(folderId) =>
                  void handleMoveTranscript(displayTranscript.id, folderId)
                }
                onCreateFolderAndMove={(name) => {
                  void (async () => {
                    if (!libraryRoot) return;
                    const f: Folder = {
                      id: crypto.randomUUID(),
                      name: name.trim() || "Untitled folder",
                      createdAt: new Date().toISOString(),
                    };
                    await createFolderEntry(libraryRoot, f);
                    await patchTranscript(libraryRoot, displayTranscript.id, { folderId: f.id });
                    toast.success(`Saved to "${f.name}"`);
                  })();
                }}
              />
            </m.div>
          )}

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
                onCancel={handleCancel}
              />
            </m.div>
          )}

          {state.view === "home" && (
            <m.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mx-auto max-w-2xl pb-6 pt-2 text-center sm:pt-4">
                {/* Ripple icon centerpiece */}
                <m.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center"
                >
                  {[0, 1, 2].map((i) => (
                    <m.span
                      key={i}
                      className="absolute inset-0 rounded-[22px] border border-primary/30"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5 + i * 0.55, opacity: 0 }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        delay: i * 0.65,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-b from-primary/20 to-primary/5 ring-1 ring-primary/15">
                    <AudioLines className="h-9 w-9 text-primary" />
                  </div>
                </m.div>

                <m.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2.25rem]"
                >
                  Transcribe{" "}
                  <span className="relative inline-grid [grid-template-areas:'stack']">
                    <AnimatePresence mode="wait">
                      <m.span
                        key={wordIndex}
                        initial={{ opacity: 0, filter: "blur(6px)", y: 6 }}
                        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                        exit={{ opacity: 0, filter: "blur(6px)", y: -6 }}
                        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        className="[grid-area:stack] text-primary"
                      >
                        {CYCLING_WORDS[wordIndex]}
                      </m.span>
                    </AnimatePresence>
                  </span>
                </m.h1>

                <m.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground"
                >
                  Drop an audio file and get an accurate transcript in seconds — everything stays on your computer.
                </m.p>
              </div>

              <m.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="mx-auto max-w-2xl"
              >
                <UploadZone
                  onStartTranscription={handleStartTranscription}
                  busy={transcription.busy}
                  disabled={uploadDisabled}
                  disabledReason={uploadDisabledReason}
                />
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground/60">
                  <HardDrive className="h-3 w-3 shrink-0" />
                  {libraryRoot ? (
                    <span>
                      Saving to{" "}
                      <button
                        onClick={() => void handleConnectLibrary()}
                        className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {libraryRoot.name}
                      </button>
                    </span>
                  ) : (
                    <span>You&apos;ll be asked to choose a save folder on first upload</span>
                  )}
                </div>
                {libraryRoot && transcripts.length > 0 && (
                  <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="mt-6"
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Recent</h2>
                      {transcripts.length > 4 && (
                        <button
                          onClick={() => dispatch({ type: "OPEN_DRAWER" })}
                          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          View all <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {transcripts.slice(0, 4).map((t, i) => (
                        <button
                          key={t.id}
                          onClick={() => openTranscript(t)}
                          className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 ${
                            i > 0 ? "border-t border-border/60" : ""
                          }`}
                        >
                          <AudioLines className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                            {t.fileName.replace(/\.[^/.]+$/, "")}
                          </span>
                          {t.duration > 0 && (
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground/50">
                              {formatDuration(t.duration)}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </m.div>
                )}
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {state.drawerOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => dispatch({ type: "CLOSE_DRAWER" })}
            />
            <m.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md"
            >
              <div className="flex h-full flex-col border-l border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex h-8 items-center gap-1.5">
                    <h2 className="text-sm font-semibold">Library</h2>
                    <LibraryStorageHint />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConnectLibrary()}
                      className="text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      Change folder
                    </button>
                    <button
                      onClick={() => dispatch({ type: "CLOSE_DRAWER" })}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <HistorySidebar
                    transcripts={transcripts}
                    folders={folders}
                    selectedId={state.selected?.id ?? null}
                    onSelect={(t) => {
                      openTranscript(t);
                      dispatch({ type: "CLOSE_DRAWER" });
                    }}
                    onDelete={(id) => void handleDelete(id)}
                    onMoveTranscript={(id, folderId) => void handleMoveTranscript(id, folderId)}
                    onBulkDelete={(ids) => void handleBulkDelete(ids)}
                    onBulkMove={(ids, folderId) => void handleBulkMove(ids, folderId)}
                    onCreateFolder={(name) => void handleCreateFolder(name)}
                    onDeleteFolder={(id) => void handleDeleteFolder(id)}
                  />
                </div>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>

      <PrivacyAssuranceFab />
    </div>
  );
}
