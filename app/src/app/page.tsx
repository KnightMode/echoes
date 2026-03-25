"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AudioLines, Sparkles, Plus, History, Clock3, ArrowRight } from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { HistorySidebar } from "@/components/history-sidebar";
import { LiveTranscript } from "@/components/live-transcript";
import { Transcript } from "@/lib/types";
import { getTranscripts, deleteTranscript, saveTranscript } from "@/lib/store";
import { toast } from "sonner";

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
    return window.innerWidth >= 1024;
  });
  const [streamingText, setStreamingText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showUpload, setShowUpload] = useState(() => {
    if (typeof window === "undefined") return true;
    return getTranscripts().length === 0;
  });
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

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

  const handleTranscribed = useCallback((t: Transcript) => {
    saveTranscript(t);
    setTranscripts((prev) => [t, ...prev]);
    setSelected(t);
    setIsTranscribing(false);
    setStreamingText("");
    setShowUpload(false);
    setProgress(100);
    setStatusMessage("Complete!");
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[40%] -right-[20%] w-[60%] h-[60%] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute -bottom-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-primary/[0.02] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center glow-amber">
              <AudioLines className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl tracking-tight">Vox</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 -mt-0.5">
                Audio Transcription
              </p>
            </div>
          </motion.div>

          <div className="flex items-center gap-2">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleNewUpload}
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </motion.button>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${
                sidebarOpen
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {transcripts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary tabular-nums">
                  {transcripts.length}
                </span>
              )}
            </motion.button>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/50 ml-2"
            >
              <Sparkles className="w-3 h-3" />
              <span>Whisper</span>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            <AnimatePresence mode="wait">
              {selected && !isTranscribing ? (
                <TranscriptViewer
                  key={`viewer-${selected.id}`}
                  transcript={selected}
                  onBack={handleNewUpload}
                />
              ) : (
                <motion.div
                  key="main"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  {/* Show upload zone */}
                  {showUpload && (
                    <>
                      {!isTranscribing && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="text-center max-w-xl mx-auto pt-4"
                        >
                          <h2 className="font-heading text-3xl md:text-4xl mb-3 tracking-tight">
                            Transform audio into
                            <span className="text-primary"> text</span>
                          </h2>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            Upload any audio file and let OpenAI Whisper transcribe it.
                            Transcripts appear live as they&apos;re generated.
                          </p>
                        </motion.div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-xl mx-auto"
                      >
                        <UploadZone
                          onTranscribed={handleTranscribed}
                          onStreamText={handleStreamText}
                          onTranscribeStart={handleTranscribeStart}
                          onStatusChange={({ progress, message }) => {
                            setProgress(progress);
                            setStatusMessage(message);
                          }}
                        />
                      </motion.div>
                    </>
                  )}

                  {/* Live streaming transcript */}
                  {isTranscribing && (
                    <LiveTranscript
                      text={streamingText}
                      progress={progress}
                      status={statusMessage}
                    />
                  )}

                  {!isTranscribing && showUpload && transcripts.length > 0 && (
                    <motion.section
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="pt-6"
                    >
                      <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-6">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">
                            Recent transcripts
                          </p>
                          <h3 className="mt-2 font-heading text-2xl tracking-tight">
                            Pick up where you left off
                          </h3>
                        </div>
                        <button
                          onClick={() => setSidebarOpen(true)}
                          className="hidden items-center gap-2 rounded-full border border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground lg:flex"
                        >
                          Open history
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {transcripts.slice(0, 3).map((transcript) => (
                          <button
                            key={transcript.id}
                            onClick={() => {
                              setSelected(transcript);
                              setShowUpload(false);
                            }}
                            className="w-full rounded-2xl border border-border/40 bg-card/40 px-5 py-4 text-left transition-all hover:border-primary/20 hover:bg-card/70"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground/90">
                                  {transcript.fileName}
                                </p>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                  {transcript.text}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                                <Clock3 className="h-3 w-3" />
                                {new Date(transcript.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.section>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* History Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <HistorySidebar
              transcripts={transcripts}
              selectedId={selected?.id ?? null}
              onSelect={(t) => {
                setSelected(t);
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
  );
}
