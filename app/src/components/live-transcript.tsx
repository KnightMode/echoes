"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock3, Zap } from "lucide-react";

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

interface LiveTranscriptProps {
  text: string;
  progress: number;
  status: string;
}

export function LiveTranscript({ text, progress, status }: LiveTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const paragraphs = splitIntoParagraphs(text);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[11px] font-medium text-primary tracking-wide">
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
          <Zap className="w-3 h-3" />
          <span>Transcript appears as each processed segment returns</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_132px]">
        <div className="rounded-2xl border border-border/50 bg-card/40 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">
            <Clock3 className="w-3 h-3" />
            Processing Status
          </div>
          <p className="mt-2 text-sm text-foreground/85">{status || "Preparing audio..."}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/80"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/40 px-4 py-3 text-right md:text-left">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">
            Progress
          </div>
          <p className="mt-2 text-3xl font-heading text-primary tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>
      </div>

      {/* Streaming text */}
      <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
        {/* Decorative top bar */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto scroll-smooth">
          {paragraphs.length > 0 ? (
            <div className="space-y-5">
              {paragraphs.map((paragraph, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-[15px] leading-[1.9] text-foreground/80 font-light"
                >
                  {i === 0 && (
                    <span className="font-heading text-4xl float-left mr-3 mt-1 leading-[0.8] text-primary/60">
                      {paragraph.charAt(0)}
                    </span>
                  )}
                  {i === 0 ? paragraph.slice(1) : paragraph}
                </motion.p>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground/80">
                The transcript canvas stays open while Whisper processes the file.
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                You&apos;ll see text appear here automatically after each completed segment.
                Large files can pause briefly between updates while the next segment is
                being transcribed.
              </p>
            </div>
          )}

          {/* Typing cursor */}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="inline-block w-[2px] h-4 bg-primary/60 ml-1 align-middle"
          />

          <div ref={endRef} />
        </div>
      </div>
    </motion.div>
  );
}
