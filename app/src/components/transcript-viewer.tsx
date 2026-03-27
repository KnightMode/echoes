"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { m } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Copy,
  Download,
  FileAudio,
  Globe,
  Pause,
  Play,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Transcript, TranscriptSegment } from "@/lib/types";
import { formatDate, formatDuration, formatFileSize } from "@/lib/store";
import { toast } from "sonner";

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

function groupSegments(segments: TranscriptSegment[]) {
  const groups: Array<{ start: number; end: number; text: string; segments: TranscriptSegment[]; }> = [];
  let current: TranscriptSegment[] = [];
  let wordCount = 0;
  for (const seg of segments) {
    current.push(seg);
    wordCount += seg.text.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 60) {
      groups.push({ start: current[0].start, end: current[current.length - 1].end, text: current.map((s) => s.text).join(" ").trim(), segments: current });
      current = []; wordCount = 0;
    }
  }
  if (current.length > 0) groups.push({ start: current[0].start, end: current[current.length - 1].end, text: current.map((s) => s.text).join(" ").trim(), segments: current });
  return groups;
}

interface PlayerState {
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  playbackRate: number;
  audioError: boolean;
}

type PlayerAction =
  | { type: "SET_TIME"; time: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TOGGLE_MUTE" }
  | { type: "SET_RATE"; rate: number }
  | { type: "ERROR" };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "SET_TIME": return { ...state, currentTime: action.time };
    case "PLAY": return { ...state, isPlaying: true };
    case "PAUSE": return { ...state, isPlaying: false };
    case "TOGGLE_MUTE": return { ...state, isMuted: !state.isMuted };
    case "SET_RATE": return { ...state, playbackRate: action.rate };
    case "ERROR": return { ...state, audioError: true };
  }
}

const initialPlayerState: PlayerState = {
  currentTime: 0,
  isPlaying: false,
  isMuted: false,
  playbackRate: 1,
  audioError: false,
};

interface TranscriptViewerProps {
  transcript: Transcript;
  audioUrl: string | null;
  onBack: () => void;
  stickyOffset?: boolean;
}

export function TranscriptViewer({ transcript, audioUrl, onBack, stickyOffset }: TranscriptViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [player, dispatch] = useReducer(playerReducer, initialPlayerState);
  const wordCount = transcript.text.split(/\s+/).filter(Boolean).length;
  const paragraphs = splitIntoParagraphs(transcript.text);
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const segments = useMemo(() => transcript.segments ?? [], [transcript.segments]);
  const groupedSegments = useMemo(() => groupSegments(segments), [segments]);
  const groupRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const activeGroupIndex = useMemo(() => {
    for (let i = 0; i < groupedSegments.length; i++) {
      const g = groupedSegments[i];
      if (player.currentTime >= g.start && player.currentTime < g.end) return i;
    }
    return -1;
  }, [player.currentTime, groupedSegments]);

  // Auto-scroll to active segment when it changes
  useEffect(() => {
    if (activeGroupIndex < 0) return;
    const el = groupRefs.current.get(activeGroupIndex);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeGroupIndex]);

  const copyText = () => { navigator.clipboard.writeText(transcript.text); toast.success("Copied"); };
  const downloadText = () => {
    const blob = new Blob([transcript.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${transcript.fileName.replace(/\.[^/.]+$/, "")}.txt`; a.click();
    URL.revokeObjectURL(url); toast.success("Downloaded");
  };

  const togglePlay = async () => { if (!audioRef.current) return; audioRef.current.paused ? await audioRef.current.play() : audioRef.current.pause(); };
  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !audioRef.current.muted;
    dispatch({ type: "TOGGLE_MUTE" });
  };
  const cycleRate = useCallback(() => {
    if (!audioRef.current) return;
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const next = rates[(rates.indexOf(player.playbackRate) + 1) % rates.length];
    audioRef.current.playbackRate = next;
    dispatch({ type: "SET_RATE", rate: next });
  }, [player.playbackRate]);
  const seek = (s: number) => { if (!audioRef.current) return; audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + s)); };
  const jumpTo = async (seg: TranscriptSegment) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seg.start;
    dispatch({ type: "SET_TIME", time: seg.start });
    await audioRef.current.play();
  };
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    dispatch({ type: "SET_TIME", time: t });
  };
  const pct = transcript.duration > 0 ? (player.currentTime / transcript.duration) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {transcript.fileName.replace(/\.[^/.]+$/, "")}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(transcript.duration)}</span>
              <span className="inline-flex items-center gap-1"><FileAudio className="h-3 w-3" />{formatFileSize(transcript.fileSize)}</span>
              {transcript.language && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{transcript.language}</span>}
              <span>{formatDate(transcript.createdAt)}</span>
              <span>{wordCount.toLocaleString()} words &middot; {readTime} min read</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={copyText} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Copy">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={downloadText} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Download TXT">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Audio player */}
      {audioUrl && !player.audioError && (
        <div className="sticky z-20 -mx-5 border-y border-border/60 bg-background px-5" style={{ top: stickyOffset ? "7.5rem" : "3.5rem" }}>
          <audio
            ref={audioRef} src={audioUrl} preload="metadata"
            onTimeUpdate={() => dispatch({ type: "SET_TIME", time: audioRef.current?.currentTime ?? 0 })}
            onPlay={() => dispatch({ type: "PLAY" })}
            onPause={() => dispatch({ type: "PAUSE" })}
            onEnded={() => dispatch({ type: "PAUSE" })}
            onError={() => dispatch({ type: "ERROR" })}
          />
          {/* Progress line */}
          <div className="relative h-1 -mx-5 px-5">
            <div className="absolute inset-x-0 h-full bg-border/40" />
            <div className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
            <input type="range" min={0} max={transcript.duration || 0} step={0.1} value={player.currentTime}
              onChange={handleScrub} className="scrubber absolute inset-0 z-10 w-full opacity-0 cursor-pointer" />
          </div>
          <div className="flex items-center gap-2 py-2.5">
            <button onClick={() => seek(-10)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"><Rewind className="h-3.5 w-3.5" /></button>
            <button onClick={() => void togglePlay()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {player.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
            </button>
            <button onClick={() => seek(10)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"><FastForward className="h-3.5 w-3.5" /></button>
            <span className="ml-1 font-mono text-[12px] tabular-nums text-muted-foreground">
              {formatDuration(player.currentTime)} <span className="text-border">/</span> {formatDuration(transcript.duration)}
            </span>
            <div className="flex-1" />
            <button onClick={cycleRate}
              className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[11px] font-medium text-muted-foreground hover:text-foreground">
              {player.playbackRate}x
            </button>
            <button onClick={toggleMute} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
              {player.isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Transcript content */}
      <div className="mx-auto max-w-4xl pb-12 pt-4">
        {groupedSegments.length > 0 ? (
          <div className="space-y-1">
            {groupedSegments.map((group, i) => (
              <m.button
                key={`g-${group.start}`}
                ref={(el) => { if (el) groupRefs.current.set(i, el); else groupRefs.current.delete(i); }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015, duration: 0.3 }}
                onClick={() => audioUrl && void jumpTo(group.segments[0])}
                disabled={!audioUrl}
                className={`group flex w-full gap-4 rounded-xl px-4 py-3 text-left transition-colors ${
                  i === activeGroupIndex
                    ? "bg-primary/[0.07]"
                    : "hover:bg-secondary/50"
                } ${!audioUrl ? "cursor-default" : "cursor-pointer"}`}
              >
                <div className="flex w-14 shrink-0 flex-col items-start pt-1">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatDuration(group.start)}
                  </span>
                  {audioUrl && (
                    <span className="text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Jump
                    </span>
                  )}
                </div>
                <p className="min-w-0 flex-1 font-reading text-[16px] leading-[1.8] text-foreground/85 sm:text-[17px]">
                  {group.text}
                </p>
              </m.button>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {paragraphs.map((p, i) => (
              <p
                key={`p-${i}-${p.slice(0, 20)}`}
                className="font-reading text-[17px] leading-[1.85] text-foreground/85"
              >
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
