"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { AudioLines, Clock, Search, Trash2 } from "lucide-react";
import { Transcript } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/store";

interface HistorySidebarProps {
  transcripts: Transcript[];
  selectedId: string | null;
  onSelect: (transcript: Transcript) => void;
  onDelete: (id: string) => void;
}

export function HistorySidebar({ transcripts, selectedId, onSelect, onDelete }: HistorySidebarProps) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? transcripts.filter((t) =>
        t.fileName.toLowerCase().includes(search.toLowerCase()) ||
        t.text.toLowerCase().includes(search.toLowerCase()))
    : transcripts;

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts..."
            className="h-9 w-full rounded-lg border border-border bg-secondary pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AudioLines className="mb-3 h-5 w-5 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No matches found." : "No transcripts yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((t, i) => (
              <m.div
                key={t.id}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015 }}
                onClick={() => onSelect(t)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(t); } }}
                className={`group relative w-full cursor-pointer rounded-lg px-3 py-3 text-left transition-colors ${
                  selectedId === t.id
                    ? "bg-primary/10 text-foreground"
                    : "text-foreground/80 hover:bg-secondary"
                }`}
              >
                <p className="truncate text-sm font-medium">{t.fileName}</p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                  {t.text}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  {t.duration > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />{formatDuration(t.duration)}
                    </span>
                  )}
                  <span>{formatDate(t.createdAt)}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground/0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:text-muted-foreground"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </m.div>
            ))}
          </div>
        )}
      </div>

      {transcripts.length > 0 && (
        <div className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
          {transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""} saved locally
        </div>
      )}
    </div>
  );
}
