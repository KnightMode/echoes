"use client";

import { motion } from "framer-motion";
import { FileAudio, Clock, Trash2, Search } from "lucide-react";
import { Transcript } from "@/lib/types";
import { formatDuration, formatDate } from "@/lib/store";
import { useState } from "react";

interface HistorySidebarProps {
  transcripts: Transcript[];
  selectedId: string | null;
  onSelect: (t: Transcript) => void;
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
        (t) =>
          t.fileName.toLowerCase().includes(search.toLowerCase()) ||
          t.text.toLowerCase().includes(search.toLowerCase())
      )
    : transcripts;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="border-l border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden flex-shrink-0 flex flex-col h-[calc(100vh-65px)]"
    >
      <div className="w-[320px] flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/30 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Transcript History
          </h3>

          {transcripts.length > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transcripts..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-secondary/30 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              />
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileAudio className="w-8 h-8 text-muted-foreground/20 mb-3" />
              <p className="text-xs text-muted-foreground/50">
                {search ? "No matching transcripts" : "No transcripts yet"}
              </p>
              {!search && (
                <p className="text-[10px] text-muted-foreground/30 mt-1">
                  Upload an audio file to get started
                </p>
              )}
            </div>
          ) : (
            filtered.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelect(t)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative ${
                  selectedId === t.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-secondary/40 border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedId === t.id
                        ? "bg-primary/20"
                        : "bg-secondary/60 group-hover:bg-secondary"
                    }`}
                  >
                    <FileAudio
                      className={`w-3 h-3 ${
                        selectedId === t.id
                          ? "text-primary"
                          : "text-muted-foreground/60"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        selectedId === t.id ? "text-primary" : ""
                      }`}
                    >
                      {t.fileName}
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 line-clamp-1 mt-0.5 leading-relaxed">
                      {t.text.slice(0, 80)}...
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/40">
                      {t.duration > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDuration(t.duration)}
                        </span>
                      )}
                      <span>{formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(t.id);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground/40 hover:text-destructive" />
                </button>
              </motion.button>
            ))
          )}
        </div>

        {/* Footer stats */}
        {transcripts.length > 0 && (
          <div className="p-3 border-t border-border/30 text-[10px] text-muted-foreground/40 text-center">
            {transcripts.length} transcript{transcripts.length !== 1 && "s"} · Stored locally
          </div>
        )}
      </div>
    </motion.aside>
  );
}
