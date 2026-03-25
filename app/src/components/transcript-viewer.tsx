"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Download,
  Clock,
  FileAudio,
  Globe,
  Calendar,
  Type,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Transcript } from "@/lib/types";
import { formatFileSize, formatDuration, formatDate } from "@/lib/store";
import { toast } from "sonner";

function splitIntoParagraphs(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const paragraphs: string[] = [];
  let current = "";
  let count = 0;

  for (const sentence of sentences) {
    current += sentence;
    count++;
    if (count >= 4) {
      paragraphs.push(current.trim());
      current = "";
      count = 0;
    }
  }
  if (current.trim()) {
    paragraphs.push(current.trim());
  }
  return paragraphs;
}

interface TranscriptViewerProps {
  transcript: Transcript;
  onBack: () => void;
}

export function TranscriptViewer({ transcript, onBack }: TranscriptViewerProps) {
  const copyText = () => {
    navigator.clipboard.writeText(transcript.text);
    toast.success("Copied to clipboard");
  };

  const downloadText = () => {
    const blob = new Blob([transcript.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${transcript.fileName.replace(/\.[^/.]+$/, "")}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded transcript");
  };

  const downloadMarkdown = () => {
    const paragraphs = splitIntoParagraphs(transcript.text);
    const md = [
      `# ${transcript.fileName}`,
      "",
      `> Transcribed on ${formatDate(transcript.createdAt)} | ${formatDuration(transcript.duration)} | ${transcript.language || "Unknown language"}`,
      "",
      "---",
      "",
      ...paragraphs.map((p) => p + "\n"),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${transcript.fileName.replace(/\.[^/.]+$/, "")}-transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const wordCount = transcript.text.split(/\s+/).filter(Boolean).length;
  const paragraphs = splitIntoParagraphs(transcript.text);
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-secondary/80 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium truncate">{transcript.fileName}</h2>
        </div>
      </div>

      {/* Metadata Pills */}
      <div className="flex flex-wrap gap-2">
        {transcript.duration > 0 && (
          <MetaPill icon={<Clock className="w-3 h-3" />} label={formatDuration(transcript.duration)} />
        )}
        <MetaPill icon={<FileAudio className="w-3 h-3" />} label={formatFileSize(transcript.fileSize)} />
        {transcript.language && (
          <MetaPill icon={<Globe className="w-3 h-3" />} label={transcript.language} capitalize />
        )}
        <MetaPill icon={<Calendar className="w-3 h-3" />} label={formatDate(transcript.createdAt)} />
        <MetaPill icon={<Type className="w-3 h-3" />} label={`${wordCount.toLocaleString()} words · ${readTime} min read`} />
      </div>

      {/* Transcript Body */}
      <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
        {/* Decorative top accent */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="p-6 md:p-10">
          {/* Opening quote mark */}
          <div className="font-heading text-6xl text-primary/15 leading-none mb-2 select-none">
            &ldquo;
          </div>

          <div className="space-y-6">
            {paragraphs.map((paragraph, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
                className="text-[15px] leading-[2] text-foreground/80 font-light selection:bg-primary/20 selection:text-primary"
              >
                {i === 0 ? (
                  <>
                    <span className="font-heading text-5xl float-left mr-3 mt-1 leading-[0.85] text-primary/50">
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

          {/* Closing quote */}
          <div className="font-heading text-6xl text-primary/15 leading-none mt-4 text-right select-none">
            &rdquo;
          </div>
        </div>

        {/* Paragraph count footer */}
        <div className="px-6 md:px-10 py-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground/50">
          <span>{paragraphs.length} paragraphs</span>
          <span>Transcribed by Whisper</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={copyText}
          className="flex-1 gap-2 text-xs"
          size="sm"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy text
        </Button>
        <Button
          variant="secondary"
          onClick={downloadText}
          className="flex-1 gap-2 text-xs"
          size="sm"
        >
          <Download className="w-3.5 h-3.5" />
          Download .txt
        </Button>
        <Button
          variant="secondary"
          onClick={downloadMarkdown}
          className="flex-1 gap-2 text-xs"
          size="sm"
        >
          <Share2 className="w-3.5 h-3.5" />
          Download .md
        </Button>
      </div>
    </motion.div>
  );
}

function MetaPill({
  icon,
  label,
  capitalize,
}: {
  icon: React.ReactNode;
  label: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border/40 text-xs text-muted-foreground">
      <span className="text-primary/50">{icon}</span>
      <span className={capitalize ? "capitalize" : ""}>{label}</span>
    </div>
  );
}
