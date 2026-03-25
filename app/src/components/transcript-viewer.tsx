"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Download,
  FileAudio,
  Globe,
  Pause,
  Play,
  Share2,
  SkipForward,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Transcript, TranscriptSegment } from "@/lib/types";
import {
  formatDate,
  formatDuration,
  formatFileSize,
} from "@/lib/store";
import { toast } from "sonner";

function splitIntoParagraphs(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const paragraphs: string[] = [];
  let current = "";
  let count = 0;

  for (const sentence of sentences) {
    current += sentence;
    count += 1;
    if (count >= 4) {
      paragraphs.push(current.trim());
      current = "";
      count = 0;
    }
  }

  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs;
}

function groupSegments(segments: TranscriptSegment[]) {
  const groups: Array<{
    start: number;
    end: number;
    text: string;
    segments: TranscriptSegment[];
  }> = [];

  let current: TranscriptSegment[] = [];
  let wordCount = 0;

  for (const segment of segments) {
    current.push(segment);
    wordCount += segment.text.split(/\s+/).filter(Boolean).length;

    if (wordCount >= 60) {
      groups.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        text: current.map((item) => item.text).join(" ").trim(),
        segments: current,
      });
      current = [];
      wordCount = 0;
    }
  }

  if (current.length > 0) {
    groups.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((item) => item.text).join(" ").trim(),
      segments: current,
    });
  }

  return groups;
}

interface TranscriptViewerProps {
  transcript: Transcript;
  audioUrl: string | null;
  onBack: () => void;
}

export function TranscriptViewer({
  transcript,
  audioUrl,
  onBack,
}: TranscriptViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const wordCount = transcript.text.split(/\s+/).filter(Boolean).length;
  const paragraphs = splitIntoParagraphs(transcript.text);
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const segments = useMemo(() => transcript.segments ?? [], [transcript.segments]);
  const groupedSegments = useMemo(() => groupSegments(segments), [segments]);

  const activeSegmentId = useMemo(() => {
    const activeSegment = segments.find(
      (segment) => currentTime >= segment.start && currentTime < segment.end
    );
    return activeSegment?.id ?? null;
  }, [currentTime, segments]);

  const copyText = () => {
    navigator.clipboard.writeText(transcript.text);
    toast.success("Copied to clipboard");
  };

  const downloadText = () => {
    const blob = new Blob([transcript.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${transcript.fileName.replace(/\.[^/.]+$/, "")}-transcript.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded transcript");
  };

  const downloadMarkdown = () => {
    const markdown = [
      `# ${transcript.fileName}`,
      "",
      `> ${formatDate(transcript.createdAt)} | ${formatDuration(
        transcript.duration
      )} | ${transcript.language || "Unknown language"}`,
      "",
      "---",
      "",
      ...paragraphs.map((paragraph) => `${paragraph}\n`),
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${transcript.fileName.replace(/\.[^/.]+$/, "")}-transcript.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const togglePlayback = async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      await audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  const jumpToSegment = async (segment: TranscriptSegment) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, segment.start);
    setCurrentTime(segment.start);
    await audioRef.current.play();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 rounded-full border border-white/10 bg-white/5 p-2.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Transcript view
            </p>
            <h1 className="mt-2 truncate font-heading text-4xl leading-none tracking-[-0.04em] sm:text-5xl">
              {transcript.fileName.replace(/\.[^/.]+$/, "")}
            </h1>
            <p className="mt-3 max-w-[38rem] text-sm leading-7 text-muted-foreground">
              Read and scrub against the original audio from the same view.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            variant="secondary"
            size="lg"
            className="h-11 rounded-full border border-white/10 bg-white/5 px-4 text-foreground hover:bg-white/10"
            onClick={copyText}
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="h-11 rounded-full border border-white/10 bg-white/5 px-4 text-foreground hover:bg-white/10"
            onClick={downloadText}
          >
            <Download className="h-4 w-4" />
            TXT
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="h-11 rounded-full border border-white/10 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={downloadMarkdown}
          >
            <Share2 className="h-4 w-4" />
            Markdown
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetaBlock icon={<Clock className="h-4 w-4" />} label="Duration" value={formatDuration(transcript.duration)} />
        <MetaBlock icon={<FileAudio className="h-4 w-4" />} label="File size" value={formatFileSize(transcript.fileSize)} />
        <MetaBlock icon={<Globe className="h-4 w-4" />} label="Language" value={transcript.language || "Unknown"} />
        <MetaBlock icon={<Calendar className="h-4 w-4" />} label="Created" value={formatDate(transcript.createdAt)} />
        <MetaBlock icon={<Type className="h-4 w-4" />} label="Density" value={`${wordCount.toLocaleString()} words · ${readTime} min`} />
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Audio sync
            </p>
            <p className="mt-2 text-sm leading-7 text-foreground/85">
              Click any timed transcript block to jump to that exact moment.
            </p>
          </div>

          {audioUrl ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="lg"
                className="h-11 rounded-full border border-white/10 bg-white/5 px-4 text-foreground hover:bg-white/10"
                onClick={() => void togglePlayback()}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatDuration(currentTime)} / {formatDuration(transcript.duration)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Audio is available for transcripts created on this browser.
            </p>
          )}
        </div>

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            controls
            className="mt-4 w-full"
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        )}
      </div>

      <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#070910] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="border-b border-white/10 px-6 py-5 sm:px-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Reading room
          </p>
          <p className="mt-3 max-w-[38ch] font-heading text-3xl leading-none tracking-[-0.03em]">
            Follow the text and jump back into the source recording.
          </p>
        </div>

        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="mb-6 font-heading text-7xl leading-none text-primary/14">
            &ldquo;
          </div>

          {groupedSegments.length > 0 ? (
            <div className="space-y-5">
              {groupedSegments.map((group, index) => (
                <motion.button
                  key={`group-${group.start}-${group.end}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025, duration: 0.35 }}
                  onClick={() => void jumpToSegment(group.segments[0])}
                  disabled={!audioUrl}
                  className={`w-full rounded-[24px] border p-5 text-left transition-colors ${
                    activeSegmentId && group.segments.some((segment) => segment.id === activeSegmentId)
                      ? "border-primary/30 bg-primary/[0.08]"
                      : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  } ${!audioUrl ? "cursor-default" : ""}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {formatDuration(group.start)} - {formatDuration(group.end)}
                    </span>
                    {audioUrl && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <SkipForward className="h-3.5 w-3.5" />
                        Jump
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] leading-8 text-foreground/84 sm:text-base sm:leading-9">
                    {index === 0 ? (
                      <>
                        <span className="float-left mr-3 mt-1 font-heading text-6xl leading-[0.82] text-primary/60">
                          {group.text.charAt(0)}
                        </span>
                        {group.text.slice(1)}
                      </>
                    ) : (
                      group.text
                    )}
                  </p>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {paragraphs.map((paragraph, index) => (
                <motion.p
                  key={`${paragraph.slice(0, 48)}-${paragraph.length}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025, duration: 0.35 }}
                  className="text-[15px] leading-8 text-foreground/84 sm:text-base sm:leading-9"
                >
                  {index === 0 ? (
                    <>
                      <span className="float-left mr-3 mt-1 font-heading text-6xl leading-[0.82] text-primary/60">
                        {paragraph.charAt(0)}
                      </span>
                      {paragraph.slice(1)}
                    </>
                  ) : (
                    paragraph
                  )}
                </motion.p>
              ))}
            </div>
          )}

          <div className="mt-8 text-right font-heading text-7xl leading-none text-primary/14">
            &rdquo;
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground sm:px-8">
          <span>
            {groupedSegments.length > 0 ? `${groupedSegments.length} timed blocks` : `${paragraphs.length} formatted paragraphs`}
          </span>
          <span>Rendered from Whisper output</span>
        </div>
      </div>
    </div>
  );
}

function MetaBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        <span className="text-primary/80">{icon}</span>
        {label}
      </div>
      <p className="mt-4 text-sm leading-6 text-foreground/85">{value}</p>
    </div>
  );
}
