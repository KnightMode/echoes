"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export function PrivacyAssuranceFab() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[45]"
    >
      <div className="relative">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label="Privacy: your data stays local"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border/80 bg-card/95 text-primary shadow-lg backdrop-blur-md transition hover:border-primary/30 hover:bg-card hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden strokeWidth={2} />
        </button>
        {open && (
          <div
            id={panelId}
            role="region"
            aria-label="Local privacy"
            className="absolute bottom-full right-0 z-[60] mb-3 max-h-[min(70vh,24rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  Your data stays on your device
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  Echoes keeps your library—transcripts, folders, and audio files—only in the
                  folder you pick on your computer. Nothing is stored on Echoes servers or synced
                  to the cloud. Your OpenAI API key stays in this browser and is used only when
                  you run transcription.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

