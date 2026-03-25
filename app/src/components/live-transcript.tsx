"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock3, Sparkles } from "lucide-react";

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

interface LiveTranscriptProps {
  text: string;
  progress: number;
  status: string;
}

export function LiveTranscript({
  text,
  progress,
  status,
}: LiveTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const paragraphs = splitIntoParagraphs(text);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [text]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            Live transcript
          </p>
          <h2 className="mt-2 font-heading text-3xl leading-none tracking-[-0.03em]">
            Text is arriving in sequence.
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Listening
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Processing
          </p>
          <p className="mt-3 text-sm leading-7 text-foreground/85">
            {status || "Preparing audio..."}
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-sky-300/80"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Progress
          </p>
          <p className="mt-3 font-heading text-5xl leading-none tracking-[-0.04em] text-primary">
            {Math.round(progress)}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Percent
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#05070d]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="max-h-[58vh] overflow-y-auto px-6 py-7 sm:px-8">
          {paragraphs.length > 0 ? (
            <div className="space-y-6">
              {paragraphs.map((paragraph, index) => (
                <motion.p
                  key={`${paragraph.slice(0, 40)}-${paragraph.length}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="text-[15px] leading-8 text-foreground/82"
                >
                  {index === 0 ? (
                    <>
                      <span className="float-left mr-3 mt-1 font-heading text-5xl leading-[0.85] text-primary/65">
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
          ) : (
            <div className="space-y-4">
              <p className="font-heading text-3xl leading-none tracking-[-0.03em]">
                Waiting for the first completed segment.
              </p>
              <p className="max-w-[38ch] text-sm leading-7 text-muted-foreground">
                Large files can pause between updates while the next segment is
                being transcribed. The text will keep appending here
                automatically as Whisper returns each portion.
              </p>
            </div>
          )}

          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="mt-4 inline-block h-4 w-[2px] bg-primary/70 align-middle"
          />

          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
