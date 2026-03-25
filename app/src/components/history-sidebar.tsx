"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, FileAudio, Search, Trash2 } from "lucide-react";
import { Transcript } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/store";

interface HistorySidebarProps {
  transcripts: Transcript[];
  selectedId: string | null;
  onSelect: (transcript: Transcript) => void;
  onDelete: (id: string) => void;
}

export function HistorySidebar({
  transcripts,
  selectedId,
  onSelect,
  onDelete,
}: HistorySidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? transcripts.filter(
        (transcript) =>
          transcript.fileName.toLowerCase().includes(search.toLowerCase()) ||
          transcript.text.toLowerCase().includes(search.toLowerCase())
      )
    : transcripts;

  return (
    <motion.aside
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative hidden w-[320px] shrink-0 overflow-hidden rounded-[30px] border border-white/10 bg-[#080a11]/88 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl 2xl:block"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Archive
          </p>
          <h3 className="mt-2 font-heading text-3xl leading-none tracking-[-0.03em]">
            Past takes
          </h3>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by file or phrase"
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <FileAudio className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-foreground/75">
                {search ? "No matching transcripts." : "No transcripts yet."}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Upload a recording to start building the archive.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((transcript, index) => (
                <motion.button
                  key={transcript.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => onSelect(transcript)}
                  className={`group relative w-full rounded-[22px] border px-4 py-4 text-left transition-colors ${
                    selectedId === transcript.id
                      ? "border-primary/30 bg-primary/[0.09]"
                      : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="pr-7">
                    <p className="truncate text-sm font-medium text-foreground/88">
                      {transcript.fileName}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                      {transcript.text}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {transcript.duration > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(transcript.duration)}
                        </span>
                      )}
                      <span>{formatDate(transcript.createdAt)}</span>
                    </div>
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(transcript.id);
                    }}
                    className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                    title="Delete transcript"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {transcripts.length > 0 && (
          <div className="border-t border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {transcripts.length} saved in local archive
          </div>
        )}
      </div>
    </motion.aside>
  );
}
