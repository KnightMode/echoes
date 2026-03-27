"use client";

import { m } from "framer-motion";
import { FileAudio, Clock, Globe, Copy, Trash2, ChevronRight } from "lucide-react";
import { Transcript } from "@/lib/types";
import { formatFileSize, formatDuration, formatDate } from "@/lib/store";
import { toast } from "sonner";

interface TranscriptCardProps {
  transcript: Transcript;
  index: number;
  onSelect: (t: Transcript) => void;
  onDelete: (id: string) => void;
}

export function TranscriptCard({
  transcript,
  index,
  onSelect,
  onDelete,
}: TranscriptCardProps) {
  const copyText = () => {
    navigator.clipboard.writeText(transcript.text);
    toast.success("Copied to clipboard");
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={() => onSelect(transcript)}
      className="group relative bg-card hover:bg-card/80 border border-border/50 hover:border-primary/20 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:glow-amber"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
          <FileAudio className="w-4 h-4 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm truncate group-hover:text-primary/90 transition-colors">
              {transcript.fileName}
            </h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/50 transition-all flex-shrink-0 group-hover:translate-x-0.5" />
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {transcript.text}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground/70">
            {transcript.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(transcript.duration)}
              </span>
            )}
            <span>{formatFileSize(transcript.fileSize)}</span>
            {transcript.language && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {transcript.language}
              </span>
            )}
            <span className="ml-auto">{formatDate(transcript.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyText();
          }}
          className="p-1.5 rounded-md hover:bg-secondary/80 transition-colors"
          title="Copy transcript"
        >
          <Copy className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(transcript.id);
          }}
          className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </m.div>
  );
}
